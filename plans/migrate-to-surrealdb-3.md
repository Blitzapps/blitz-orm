# Migration Plan: SurrealDB v2 -> v3

## Overview

Migrate the blitz-orm SurrealDB adapter from v2.3.7 to v3. This involves:

1. Updating the JS client library (`surrealdb` npm v2.0.0-alpha.18 -> v2.0.1)
2. Removing the legacy query adapter (`surql/`)
3. Replacing BORM link fields defined as `<future>` fields with `COMPUTED` fields
4. Replacing BORM role events with `REFERENCE` fields
5. Fixing breaking SurrealQL syntax changes (`IF/THEN/END`, function renames, etc.)
6. Updating the current query adapter (`surql2/`) and mutation builder for v3 syntax
7. Updating tests and infrastructure

## Current Architecture

```
src/adapters/surrealDB/
  schema/define.ts       -- Generates SurrealQL schema (DEFINE TABLE/FIELD/EVENT)
  client.ts              -- SurrealClient wrapper (surrealdb npm v2.0.0-alpha.18)
  enrichSchema/helpers.ts -- Query path resolution for link fields (to be removed — depends on linkMode)
  filters/filters.ts     -- SurQL filter building
  parsing/values.ts      -- Type mapping and value parsing
  helpers.ts             -- Name sanitization

src/stateMachine/query/
  surql/                 -- Legacy query adapter (linkMode: edges/refs)
  surql2/                -- Current query adapter (default, no linkMode)

src/stateMachine/mutation/
  surql/                 -- Mutation builder (shared by both query adapters)
```

The query machine (`queryMachine.ts`) routes to `surql/` when `config.query?.legacySurrealDBAdapter` is true, otherwise to `surql2/`.

---

## Phase 1: Client & Driver Update

### 1.1 Update `surrealdb` npm package

- Current: `"surrealdb": "2.0.0-alpha.18"`
- Target: `"surrealdb": "2.0.1"` (latest stable, published 2026-03-06)
- SDK v2.0.x supports SurrealDB server v2.1.0+ and v3.0

### 1.2 Breaking changes from alpha.18 to v2.0.1


| Change                                                                      | Impact on blitz-orm                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `Table` class required for query builder methods (`select`, `create`, etc.) | **No impact** — blitz-orm uses raw `.query()` strings          |
| `update()`/`upsert()` signature changed to builder pattern                  | **No impact** — blitz-orm uses raw `.query()`                  |
| Event emitter API changed (`emitter.on` → `subscribe`)                      | **No impact** — client.ts already uses `subscribe()`           |
| `query()` returns `Query<R>` (thenable) instead of direct Promise           | **No impact** — `await db.query()` still works                 |
| `version()` returns `VersionInfo` object                                    | **No impact** — client.ts already accesses `.version` property |


### 1.3 Imports confirmed still available

All existing imports work with v2.0.1:

- `BoundQuery` from `'surrealdb'` — still exported
- `Surreal` from `'surrealdb'` — still exported (named + default)
- `UnsupportedVersionError` from `'surrealdb'` — still exported
- `DateTime` from `'surrealdb'` (used in `processResults.ts`) — still exported
- `RecordId` from `'surrealdb'` (used in `jsonRefs.ts`) — still exported

### 1.4 `SurrealClient` (`client.ts`) changes

The existing client code is **compatible with v2.0.1** as-is:

- Constructor: `new Surreal()` still works (options now optional)
- `connect()` options shape unchanged (namespace, database, versionCheck, reconnect, authentication)
- `subscribe()` events unchanged
- `query()` method unchanged (thenable return)

**Recommended but not required**: Consider enabling `renewAccess: true` (default in v2.0.1) for automatic token refresh.

### 1.5 New SDK features available for future use

- Multi-session support (`newSession()`, `forkSession()`)
- Client-side transactions (`beginTransaction()`)
- Streaming import/export
- Query builder pattern with expressions API
- Diagnostics API for protocol inspection

---

## Phase 2: Remove Legacy Query Adapter (`surql/`)

### 2.1 Delete `src/stateMachine/query/surql/`

Remove the entire directory:

- `surql/build.ts` - edges link mode query builder
- `surql/buildRefs.ts` - refs link mode query builder
- `surql/machine.ts` - legacy query state machine
- `surql/run.ts` - legacy query runner
- `surql/parse.ts` - legacy result parser

### 2.2 Clean up imports and routing

`**src/stateMachine/query/queryMachine.ts**`:

- Remove `import { runSurrealDbQueryMachine } from './surql/machine'`
- Remove the `legacySurrealDBAdapter` branch (lines 139-141)
- Always route SurrealDB queries to `surql2/`

### 2.3 Remove legacy adapter configuration

- Remove `legacySurrealDBAdapter` from `BormConfig.query` type
- Remove `providerConfig` from `SurrealDBProviderObject` entirely (`linkMode` is the only field in `SurrealDBProviderConfig`). **This is a breaking API change** — consumers passing `providerConfig` will get TypeScript errors.
- Remove `SurrealDBProviderConfig` type
- Update `SurrealDBHandles` Map to no longer store `providerConfig`
- Remove `LEGACY_SURREALDB_ADAPTER` env var handling in tests
- Remove `BORM_TEST_SURREALDB_LINK_MODE` env var handling (edges mode goes away)

### 2.4 Remove `enrichSchema/helpers.ts`

- Delete `src/adapters/surrealDB/enrichSchema/helpers.ts` — `getSurrealLinkFieldQueryPath` takes a `linkMode: 'refs' | 'edges'` parameter which is being removed. Its only usage in `enrichSchema.ts` is already commented out. No non-legacy code depends on it.

### 2.5 Remove legacy test scripts and data

- Remove `tests/adapters/surrealDB/mocks/edgesSchema.surql`
- Remove `tests/adapters/surrealDB/mocks/edgesData.surql`
- Update `package.json` scripts: remove `:edges` test variants, `bench:tests:surrealdb:legacy`
- Simplify `test:surrealdb-ignoreTodo` to no longer require `BORM_TEST_SURREALDB_LINK_MODE`

---

## Phase 3: Confirmed v3 SurrealQL Syntax Changes

All items below have been verified against the official SurrealDB v3.0 migration guide and documentation.

### 3.1 Critical breaking changes affecting blitz-orm

#### 3.1.1 `<future>` removed — use `COMPUTED`

- **Old**: `DEFINE FIELD f ON TABLE t VALUE <future> { expression };`
- **New**: `DEFINE FIELD f ON TABLE t COMPUTED expression;`
- COMPUTED fields **cannot** be combined with `VALUE`, `DEFAULT`, `ASSERT`, or `READONLY`
- COMPUTED fields **must** be top-level (no nested paths like `metadata.field`)
- COMPUTED fields **cannot** target the `id` field
- COMPUTED fields are read-only and evaluated on every read
- Automatic migration available via Surrealist v2.6.1+ for schema definitions

**Codebase impact**: `define.ts:114-115` (link-to-role `<future>` fields), `define.ts:66,90` (virtual field VALUE clauses — see 4.5.0 for `dbValue` handling), all test mock `.surql` files

#### 3.1.2 `IF ... THEN ... END` removed — use `IF ... { ... }`

- **Old**: `IF condition THEN expression END;`
- **New**: `IF condition { expression };`
- **Old**: `IF cond THEN expr1 ELSE expr2 END;`
- **New**: `IF cond { expr1 } ELSE { expr2 };`
- No `THEN` keyword, no `END` keyword

**Codebase impact**: Multiple locations:

- `define.ts:183-184,192` — event generation uses `IF ($before.role) THEN ... END` (will be removed anyway per Phase 4)
- `buildSurql.ts:158,163` — FlexField projections (MUST update)
- `build.ts:105,108,178,341` — conditional mutations (MUST update)

#### 3.1.3 Function renames (double-colon to underscore)


| v2                       | v3                      |
| ------------------------ | ----------------------- |
| `type::is::record()`     | `type::is_record()`     |
| `type::is::array()`      | `type::is_array()`      |
| `type::is::bool()`       | `type::is_bool()`       |
| `type::is::string()`     | `type::is_string()`     |
| (all `type::is::`*)      | (all `type::is_*`)      |
| `type::thing()`          | `type::record()`        |
| `rand::guid()`           | `rand::id()`            |
| `duration::from::days()` | `duration::from_days()` |
| `string::is::email()`    | `string::is_email()`    |
| `time::from::millis()`   | `time::from_millis()`   |


**Codebase impact**:

- `buildSurql.ts:158,163` — uses `type::is::record()` → `type::is_record()`
- `define.ts:239` — uses `type::is::array()` in `fn::as_array` (will be removed per Phase 4.7)
- `build.ts:151,292` — uses `type::is::array()` → `type::is_array()`

#### 3.1.4 `type::record()` signature changed

- **Old**: `type::record($record: record|string, $table_name?: string) -> record`
- **New**: `type::record($table: any, $key: any) -> record`
- For converting a string to record, use the record string prefix: `r"Table:id"`
- The single-arg `type::record("Table:id")` form **WILL break** in v3.

**Codebase impact**: All `type::record(...)` calls that pass a single `"Table:id"` string must change. The current code (in `buildSurql.ts`) parameterizes the pointer as a single string (`type::record($param)` where `$param = "Table:id"`). In v3, this must be split into two params:

```typescript
// v2
const pointer = `${esc(t)}:${esc(i)}`;
const key = insertParam(mutParams, pointer);
return `type::record($${key})`;

// v3 — split table and id into separate params
const tableKey = insertParam(mutParams, t);
const idKey = insertParam(mutParams, i);
return `type::record($${tableKey}, $${idKey})`;
```

Note: The record string prefix `r"Table:id"` is a literal and **cannot be parameterized**, so it's not suitable for the dynamic query builder. Use `type::record(table, key)` with two args instead.

**Affected locations**:
- `buildSurql.ts:175-178` — RecordPointer data source. The table (`t`) and id (`i`) are already separate loop variables before being joined. Do NOT join them — pass as separate params:
  ```typescript
  // v2
  const pointers = source.thing
    .flatMap((t) => source.ids.map((i) => `${esc(t)}:${esc(i)}`))
    .map((p) => `type::record($${insertParam(mutParams, p)})`)

  // v3 — table and id are already separate, pass raw values as params
  const pointers = source.thing
    .flatMap((t) => source.ids.map((i) =>
      `type::record($${insertParam(mutParams, t)}, $${insertParam(mutParams, i)})`
    ))
  ```
- `buildSurql.ts:217-222` — BiRef/FutureBiRef filter with `thing` optimization. Same pattern — `t` and `i` are already separate in the `flatMap`

#### 3.1.5 `LET` required for parameter assignment

- **Old**: `$var = value;` (bare assignment worked)
- **New**: `LET $var = value;` (LET keyword required)
- LET now supports optional type annotations: `LET $name: string = "hello";`

**Codebase impact**: Check mutation builder for any bare `$var = ...` assignments. The existing code already uses `LET` in most places (`build.ts:105,108`).

#### 3.1.6 SCHEMAFULL tables now error on undefined fields

- **Old**: Extra fields silently filtered
- **New**: Extra fields cause errors
- Fix: Use projection/destructuring `.{ field1, field2 }` to filter fields before insert

**Codebase impact**: `define.ts:44` uses `SCHEMAFULL`. Mutation builders must ensure they only set defined fields. This was already the case since BORM generates mutations from schema, but verify edge cases.

### 3.2 Changes NOT affecting blitz-orm (no action needed)


| Change                                  | Reason not affected                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| `SEARCH ANALYZER` → `FULLTEXT ANALYZER` | blitz-orm doesn't define search indexes                    |
| MTREE → HNSW vector indexes             | blitz-orm doesn't use vector indexes                       |
| Fuzzy operators (`~`, `!~`) removed     | blitz-orm doesn't use fuzzy matching                       |
| `GROUP + SPLIT` mutual exclusion        | blitz-orm doesn't combine these                            |
| `array::range()` semantics changed      | blitz-orm doesn't use `array::range()`                     |
| Like operators removed                  | blitz-orm doesn't use like operators                       |
| `ANALYZE` statement removed             | blitz-orm doesn't use ANALYZE                              |
| Stored closures disabled                | blitz-orm doesn't store closures in records                |
| `.`* idiom behavior changed             | blitz-orm doesn't use `.*` on objects                      |
| Optional chaining `?.` → `.?.`          | blitz-orm doesn't use optional chaining in SurrealQL       |
| Set type notation `{}` vs `[]`          | blitz-orm doesn't use set types                            |
| `STRICT` moved to `DEFINE DATABASE`     | blitz-orm doesn't use strict mode                          |
| `.id` field behavior change             | blitz-orm uses `record::id()` function, not `.id` property |


### 3.3 Functions confirmed still available (no changes needed)

- `record::id()`, `record::tb()`, `record::exists()` — **confirmed available**
- `array::first()`, `array::distinct()`, `array::flatten()`, `array::complement()` — **confirmed available**
- `.map(|$i| ...)`, `.filter(|$v| ...)` lambdas — **confirmed available**
- Closures can now **capture outer scope variables** (new in v3, previously errored)
- `SELECT VALUE field FROM $this.path[*]` — **confirmed works**
- `FROM $this.path` — **confirmed works**
- `$parent`, `$this`, `$before`, `$after` — **confirmed available**
- `$input` — **new v3 variable** available in events and VALUE clauses
- `CONTAINSALL`, `CONTAINSANY`, `CONTAINSNONE` operators — **confirmed available**
- `option<...>` type wrapper — **confirmed available**
- `SCHEMAFULL` keyword — **confirmed correct spelling**
- `PERMISSIONS FULL` — **confirmed available**
- Angle bracket escaping `⟨⟩` — **confirmed available**
- `?=` (any in set equals) operator — **confirmed available**
- `CREATE ONLY`, `UPDATE`, `DELETE`, `UPSERT` — **no syntax changes**
- `RETURN VALUE` clause — **confirmed available**

### 3.4 New v3 features potentially useful


| Feature                                         | Potential use                                       |
| ----------------------------------------------- | --------------------------------------------------- |
| `REFERENCE ON DELETE CASCADE/REJECT/UNSET/THEN` | Enforce referential integrity automatically         |
| `DEFINE FIELD OVERWRITE`                        | Simplify schema re-definition during development    |
| `DEFINE TABLE IF NOT EXISTS`                    | Safer schema migrations                             |
| Closure outer scope capture                     | Simplify complex `.map()` / `.filter()` expressions |
| Client-side transactions (JS SDK)               | Potential future use for complex mutations          |
| `COUNT` index type                              | Constant-time `count()` with `GROUP ALL`            |
| `CONCURRENTLY` index builds                     | Non-blocking index creation                         |


---

## Phase 4: Schema Definition Changes (`define.ts`)

### 4.0 Switch `define.ts` to use `DRAFT_EnrichedBormSchema`

The current `defineSURQLSchema` function uses `EnrichedBormSchema` (from `enriched.ts`). Change it to use `DRAFT_EnrichedBormSchema` (from `enriched.draft.ts`) instead.

This is necessary because:
1. The draft schema is where `relation`, `plays`, `targetRole`, and `targetRoleCardinality` are added to `DRAFT_EnrichedBormLinkField` (Phase 4.9) — needed for COMPUTED field generation
2. The draft schema provides the flat `fields` map with `subTypes` on each thing, which is needed for polymorphic COMPUTED field generation (Phase 4.4)
3. It aligns `define.ts` with the same schema type used by the `surql2/` query adapter

Update the function signatures throughout:
- `defineSURQLSchema(schema: DRAFT_EnrichedBormSchema)`
- `convertBQLToSurQL(schema: DRAFT_EnrichedBormSchema)`
- `convertSchemaItems(items: ..., schema: DRAFT_EnrichedBormSchema)` — pass full schema through
- `convertSchemaItem(name, item, level, schema: DRAFT_EnrichedBormSchema)` — pass full schema through
- `convertLinkFields(linkFields, parentName, level, schema: DRAFT_EnrichedBormSchema)` — needs schema for polymorphic lookups and target role cardinality
- `convertRoles(roles, parentName, level)` — no schema needed (role fields don't need inheritance tree)

The biggest change is how link fields are defined in the SurrealDB schema.

### 4.1 Current v2 Approach

In v2, BORM uses a "refs" pattern where:

- **Role fields** on relations store record references directly (e.g., `DEFINE FIELD user ON TABLE User-Accounts TYPE option<record<User>>`)
- **Link fields** on entities pointing to roles use `<future>` computed fields that traverse through the relation
- **Events** on relations maintain bidirectional consistency (when a role field changes, the opposite entity's reference is updated)

Example (v2 - current):

```surql
-- Entity: User
DEFINE FIELD accounts ON TABLE User VALUE <future> {
  array::distinct(SELECT VALUE array::flatten(user-accounts.accounts || []) FROM ONLY $this)
};
DEFINE FIELD user-accounts ON TABLE User TYPE option<array<record<User-Accounts>>>;

-- Relation: User-Accounts
DEFINE FIELD accounts ON TABLE User-Accounts TYPE option<array<record<Account>>>;
DEFINE EVENT update_accounts ON TABLE User-Accounts WHEN $before.accounts != $after.accounts THEN { ... };
DEFINE FIELD user ON TABLE User-Accounts TYPE option<record<User>>;
DEFINE EVENT update_user ON TABLE User-Accounts WHEN $before.user != $after.user THEN { ... };
```

### 4.2 New v3 Approach

SurrealDB v3 introduces `REFERENCE` and `COMPUTED` field modifiers:

- `REFERENCE` fields automatically maintain referential integrity
- `COMPUTED` fields replace `<future>` with `COMPUTED <~(Table FIELD field)` syntax for reverse lookups
- `REFERENCE` supports `ON DELETE` options: `REJECT`, `CASCADE`, `IGNORE` (default), `UNSET`, `THEN @expression`

**New pattern:**

```surql
-- Relation: User-Accounts (role fields are REFERENCE)
DEFINE FIELD accounts ON TABLE User-Accounts TYPE option<array<record<Account>>> REFERENCE;
DEFINE FIELD user ON TABLE User-Accounts TYPE option<record<User>> REFERENCE;

-- Entity: User (link-to-relation, cardinality MANY: no wrapper needed)
DEFINE FIELD user-accounts ON TABLE User COMPUTED <~(User-Accounts FIELD user);

-- Entity: User (link-to-role, cardinality MANY, target role accounts is MANY)
-- Wrap in array::distinct(array::flatten(...)) to flatten nested arrays and deduplicate
DEFINE FIELD accounts ON TABLE User COMPUTED array::distinct(array::flatten(<~(User-Accounts FIELD user).accounts));

-- Entity: Account (link-to-relation, cardinality ONE: wrap in array::first)
DEFINE FIELD user-account ON TABLE Account COMPUTED array::first(<~(User-Accounts FIELD accounts));
```

**Array function rules for COMPUTED fields:**

The raw `<~(Table FIELD field)` expression always returns a flat array of records. When traversing to a target role (`.targetRole`), the result depends on the target role's cardinality: ONE produces a flat array, MANY produces an array of arrays. The schema COMPUTED definition must wrap the expression with the appropriate array function so the field value matches the BQL cardinality:

| Link target    | Field cardinality | Target role cardinality | Wrapper                                  | Result type       |
| -------------- | ----------------- | ----------------------- | ---------------------------------------- | ----------------- |
| `'relation'`   | MANY              | —                       | (none)                                   | `array<record>`   |
| `'relation'`   | ONE               | —                       | `array::first(...)`                      | `record \| NONE`  |
| `'role'`       | MANY              | ONE                     | `array::distinct(...)`                   | `array<record>`   |
| `'role'`       | MANY              | MANY                    | `array::distinct(array::flatten(...))`   | `array<record>`   |
| `'role'`       | ONE               | ONE                     | `array::first(...)`                      | `record \| NONE`  |
| `'role'`       | ONE               | MANY                    | **Not allowed** — schema enrichment must throw an error |                   |

**Null/empty behavior**: With these wrappers, ONE cardinality COMPUTED fields return `NONE` when no references exist (via `array::first([])`), and MANY cardinality COMPUTED fields return `[]`. This matches the behavior of regular REFERENCE fields.

```surql
-- More examples:

-- Link-to-role, cardinality MANY, target role ONE (flat result, just deduplicate)
DEFINE FIELD edited_posts_authors ON user COMPUTED array::distinct(<~(post FIELD editors).author);

-- Link-to-role, cardinality MANY, target role MANY (nested arrays, flatten + deduplicate)
DEFINE FIELD authored_posts_editors ON user COMPUTED array::distinct(array::flatten(<~(post FIELD author).editors));

-- Link-to-role, cardinality ONE, target role ONE
DEFINE FIELD theme ON space COMPUTED array::first(<~(setting FIELD space).theme);

-- Link-to-relation, cardinality ONE
DEFINE FIELD setting ON space COMPUTED array::first(<~(setting FIELD space));

-- Link-to-relation, cardinality MANY (no wrapper)
DEFINE FIELD edited_posts ON user COMPUTED <~(post FIELD editors);
```

### 4.3 COMPUTED field constraints (important!)

COMPUTED fields in v3 have strict constraints that affect the schema design:

- **Top-level only**: Cannot define COMPUTED on nested fields (e.g., `metadata.accounts` is invalid)
- **No VALUE/DEFAULT/ASSERT/READONLY**: Cannot combine with these clauses
- **No id field**: Cannot define COMPUTED on the `id` field
- **Raw expression returns arrays**: The `<~(...)` expression always returns arrays, but wrapping with `array::first()` for ONE cardinality produces a single value
- **Empty behavior depends on wrapper**: `array::first([])` returns `NONE` (for ONE cardinality), unwrapped empty `<~(...)` returns `[]` (for MANY cardinality)
- **Role traversal may nest**: `<~(T FIELD f).role` where `role` is MANY returns array of arrays (needs `array::flatten()`); where `role` is ONE returns flat array
- **Invalid combination**: Link-to-role with field cardinality ONE and target role cardinality MANY is not allowed (schema enrichment must throw)

### 4.4 Polymorphic COMPUTED fields

BORM supports polymorphic data — a thing can be extended by other things (e.g., `SpaceObj` extended by `DataField`, `SpaceDef`, `Kind`). When an entity has a link field whose opposite role is on a polymorphic thing, the COMPUTED field must reference **all** tables in the inheritance chain that carry the role field.

**Example**: `Space.objects` links to role `SpaceObj.space`. `SpaceObj` is extended by `DataField`, `SpaceDef`, `Kind`, etc. — all of which inherit the `space` role field. The COMPUTED definition must include every table:

```surql
DEFINE FIELD objects ON Space COMPUTED <~(SpaceObj FIELD space, SpaceDef FIELD space, Kind FIELD space, ...);
```

The `<~()` syntax accepts **multiple source specifications** separated by commas, each in the form `Table FIELD field`. **Tested and confirmed working** against a running SurrealDB v3 instance.

**Impact on `convertLinkFields()`**: When generating a COMPUTED field for a link-to-relation or link-to-role, the code must:

1. For link-to-relation: use `linkField.opposite.thing` (the relation name) and `linkField.opposite.path` (the self role name, same as `linkField.plays`). For link-to-role: use `linkField.relation` (the relation name), `linkField.plays` (the self role name), and `linkField.targetRole` (the target role name) — these fields are available on `DRAFT_EnrichedBormLinkFieldTargetRole` (see Phase 4.9.1).
2. Collect all things that extend the relation. The relation and its subtypes are available via `schema[relationName].subTypes`.
3. For each thing in the tree (the relation + all subtypes), add a `Table FIELD selfRole` entry
4. Join all entries with commas inside `<~(...)`
5. For link-to-role: append `.targetRole` after the closing parenthesis

```surql
-- Link-to-relation (polymorphic)
DEFINE FIELD objects ON Space COMPUTED <~(SpaceObj FIELD space, SpaceDef FIELD space, Kind FIELD space, ...);

-- Link-to-role (polymorphic, with role traversal)
DEFINE FIELD object-names ON Space COMPUTED <~(SpaceObj FIELD space, SpaceDef FIELD space, Kind FIELD space, ...).name;
```

### 4.5 Changes to `convertLinkFields()` in `define.ts`

#### 4.5.0 Virtual field `dbValue` handling

**Fix double-prefix bug in both link fields AND data fields:**

The existing code has a bug at two locations where `VALUE` is prepended to `dbValue`, but `dbValue` already includes the clause keyword (e.g., `VALUE ...` or `COMPUTED ...`):

- **Link fields** (line 90): `${baseDefinition} VALUE ${dbValue}` → `${baseDefinition} ${dbValue}`
- **Data fields** (line 66): `${baseDefinition} VALUE ${dbValue}` → `${baseDefinition} ${dbValue}`

Fix both to:

```typescript
return `${baseDefinition} ${dbValue};`;
```

Virtual link fields continue to use `dbValue` in v3. They are NOT converted to standard COMPUTED fields because they have custom expressions. The early return preserves this behavior.

**Virtual field v3 syntax migration**: If existing `dbValue` strings contain v2 syntax (`<future>`, `IF THEN END`, `type::is::record()`, etc.), they will break in v3. Update any test virtual fields that use v2 syntax. For usage outside the BORM repo, users must update their `dbValue` strings — this migration is a new major version.

#### 4.5.1 Non-virtual link fields

For link fields with `target === 'relation'`:

- **Before (v2)**: `DEFINE FIELD path ON TABLE entity TYPE option<record<Relation>>`
- **After (v3)**: `DEFINE FIELD path ON TABLE entity COMPUTED [wrapper](<~(Relation FIELD roleName))`

The wrapper depends on the field's cardinality:
- **MANY**: No wrapper — `COMPUTED <~(Relation FIELD roleName)`
- **ONE**: `COMPUTED array::first(<~(Relation FIELD roleName))`

For link fields with `target === 'role'`:

- **Before (v2)**: Define a `<future>` computed field that traverses through the relation, plus a support field to hold the relation reference
- **After (v3)**: `DEFINE FIELD path ON TABLE entity COMPUTED [wrapper](<~(Relation FIELD selfRole).targetRole)` — generates its own COMPUTED field that traverses through the relation to the target role field. No support field needed.

The wrapper depends on both the field's cardinality and the target role's cardinality (see table in 4.2):
- **MANY, target role ONE**: `COMPUTED array::distinct(<~(R FIELD self).target)`
- **MANY, target role MANY**: `COMPUTED array::distinct(array::flatten(<~(R FIELD self).target))`
- **ONE, target role ONE**: `COMPUTED array::first(<~(R FIELD self).target)`
- **ONE, target role MANY**: **Not allowed** — schema enrichment must throw an error

The `.targetRole` suffix means the COMPUTED field directly resolves to target entity records (not relation records). The array function wrapping ensures the field value matches the BQL cardinality, so the query builder does not need special handling.

A corresponding link-to-relation field on the same entity is **optional**. Each link-to-role field generates its own independent COMPUTED field definition. The schema enrichment should NOT throw if there is no corresponding link-to-relation field.

**Polymorphic handling**: Same as link-to-relation — walk the inheritance tree of the relation/thing to include all extending tables in the `<~(...)` source list. The array function wrapper goes outside the entire expression, e.g., `array::first(<~(T1 FIELD f, T2 FIELD f, ...))`.

### 4.6 Changes to `convertRoles()` in `define.ts`

For role fields on relations:

- **Before (v2)**: Define field with type + define an EVENT for bidirectional consistency
- **After (v3)**: Define field with type + `REFERENCE ON DELETE <action>`. No events needed — SurrealDB v3 handles referential integrity automatically via REFERENCE

#### 4.6.1 Add `onDelete` property to role field types

Add `onDelete: 'CASCADE' | 'UNSET' | 'IGNORE'` to both `RoleField` (in `src/types/schema/fields.ts`) and `DRAFT_EnrichedBormRoleField` (in `src/types/schema/enriched.draft.ts`). **Default: `'UNSET'`**.

The `ON DELETE` action determines what happens when a referenced entity is deleted:

- `REFERENCE ON DELETE CASCADE` — delete the relation record when the referenced entity is deleted (e.g., pages that reference an app — when the app is deleted, delete the pages)
- `REFERENCE ON DELETE UNSET` (default) — clear the role field when the referenced entity is deleted (e.g., a book references an editor — when the editor is deleted, unset the editor field on the book)
- `REFERENCE ON DELETE IGNORE` — do nothing when the referenced entity is deleted

#### 4.6.2 Generated SurrealQL

```surql
-- Example with default UNSET:
DEFINE FIELD user ON TABLE User-Accounts TYPE option<record<User>> REFERENCE ON DELETE UNSET;

-- Example with CASCADE:
DEFINE FIELD app ON TABLE Page TYPE option<record<App>> REFERENCE ON DELETE CASCADE;
```

The code reads `role.onDelete ?? 'UNSET'` and appends it to the field definition.

### 4.7 Remove utility functions

The `fn::get_mutated_edges` and `fn::as_array` functions are used by events for bidirectional consistency. With v3 `REFERENCE` fields, these events and functions are no longer needed.

Remove `addUtilityFunctions()` from `define.ts` (lines 219-241).

### 4.8 Remove `generateRoleEvent()` in `define.ts`

Events for maintaining bidirectional references are replaced by `REFERENCE` fields. Remove the entire `generateRoleEvent` function (lines 143-203). This also eliminates the `IF ... THEN ... END` syntax in `define.ts:183-184,192`.

### 4.9 Update `enrichSchemaDraft` (`enrichSchema.draft.ts`)

The draft enriched schema needs restructuring of `DRAFT_EnrichedBormLinkField` to carry the relation/role information needed by `define.ts` for COMPUTED field generation, plus `targetRoleCardinality` on the `target: 'role'` variant to determine the array function wrapper.

#### 4.9.1 Restructure `DRAFT_EnrichedBormLinkField` as discriminated union

In `src/types/schema/enriched.draft.ts`, break `DRAFT_EnrichedBormLinkField` into a discriminated union. The base type carries `relation` and `plays` (needed by `define.ts` for COMPUTED field generation). The `target: 'role'` variant adds `targetRole` and `targetRoleCardinality`.

```typescript
export type DRAFT_EnrichedBormLinkField =
  | DRAFT_EnrichedBormLinkFieldTargetRelation
  | DRAFT_EnrichedBormLinkFieldTargetRole;

interface DRAFT_BaseEnrichedBormLinkField {
  type: 'link';
  name: string;
  cardinality: DiscreteCardinality;
  /** The relation this link goes through. */
  relation: string;
  /** The role this entity plays in the relation. */
  plays: string;
  opposite: {
    thing: string;
    path: string;
    cardinality: DiscreteCardinality;
  };
}

export interface DRAFT_EnrichedBormLinkFieldTargetRelation extends DRAFT_BaseEnrichedBormLinkField {
  target: 'relation';
}

export interface DRAFT_EnrichedBormLinkFieldTargetRole extends DRAFT_BaseEnrichedBormLinkField {
  target: 'role';
  /** The target role name on the relation. */
  targetRole: string;
  /** Cardinality of the target role field on the relation.
   *  When MANY, the COMPUTED field result is nested arrays (array of arrays) requiring
   *  array::flatten() in the schema COMPUTED definition.
   *  When ONE, the COMPUTED field result is a flat array. */
  targetRoleCardinality: DiscreteCardinality;
}
```

**How `define.ts` uses these fields to generate COMPUTED expressions:**

For link-to-relation: `linkField.relation` gives the relation name and `linkField.plays` gives the self role name. Together with `schema[linkField.relation].subTypes` for polymorphic tables, this generates `COMPUTED <~(Relation FIELD selfRole, SubType1 FIELD selfRole, ...)`.

For link-to-role: additionally uses `linkField.targetRole` for the `.targetRole` suffix and `linkField.targetRoleCardinality` to select the array function wrapper (see 4.2 table).

**Why `pathToRelation` and `selfRolePath` are NOT needed for the query adapter:**

- The query adapter reads COMPUTED fields directly by name — no traversal step needed.
- The optimizer's reverse traversal uses `opposite.path` (the reverse field on the target entity) which also resolves to entity records via its own COMPUTED definition. No intermediate relation traversal is needed.

#### 4.9.2 Update `enrichLinkFields()` in `enrichSchema.draft.ts`

A link field with `target: 'role'` does **NOT** require a corresponding link-to-relation field on the same entity. Each link-to-role field is independent and has its own COMPUTED field definition.

In `enrichLinkFields()` (line 211-246), update both target types to include `relation` and `plays`:

For `target: 'relation'` (line 211-226):
```typescript
const enriched: DRAFT_EnrichedBormLinkFieldTargetRelation = {
  type: 'link',
  name: lf.path,
  cardinality: lf.cardinality,
  target: 'relation',
  relation: lf.relation,
  plays: lf.plays,
  opposite: {
    thing: lf.relation,
    path: lf.plays,
    cardinality: targetRole.cardinality,
  },
};
```

For `target: 'role'` (line 238-246):
```typescript
// Validate: link-to-role with ONE field cardinality and MANY target role cardinality
// is not allowed — it cannot be meaningfully represented as a COMPUTED field.
const targetRoleCardinality = getTargetRoleCardinality(lf.relation, lf.targetRole, schema);
if (lf.cardinality === 'ONE' && targetRoleCardinality === 'MANY') {
  throw new Error(
    `Invalid link field "${lf.path}": cardinality ONE with target role "${lf.targetRole}" ` +
    `cardinality MANY is not allowed (relation: ${lf.relation})`
  );
}

const enriched: DRAFT_EnrichedBormLinkFieldTargetRole = {
  type: 'link',
  name: lf.path,
  cardinality: lf.cardinality,
  target: 'role',
  relation: lf.relation,
  plays: lf.plays,
  targetRole: lf.targetRole,
  targetRoleCardinality,
  opposite: rolePlayer,
};
```

The `getTargetRoleCardinality` helper:
- Look up the relation (`lf.relation`) in the schema
- Find the target role field (`lf.targetRole`) on that relation
- Return its cardinality (ONE if `TYPE option<record<...>>`, MANY if `TYPE option<array<record<...>>>`)

### 4.10 Summary of `define.ts` changes


| Component                      | v2                                                   | v3                                                        |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| Role fields on relations       | `TYPE option<record<...>>` + EVENT                   | `TYPE option<record<...>> REFERENCE`                      |
| Link fields (target: relation) | `TYPE option<record<...>>`                           | `COMPUTED [wrapper](<~(Relation FIELD role, ...))` — wrapper is `array::first()` for ONE, none for MANY (see 4.2 table) |
| Link fields (target: role)     | `VALUE <future> {...}` + support field               | `COMPUTED [wrapper](<~(R FIELD self, ...).target)` — wrapper depends on both field cardinality and target role cardinality (see 4.2 table). No support field, no corresponding link-to-relation required. |
| Events                         | Complex bidirectional sync events with `IF THEN END` | Removed (handled by REFERENCE)                            |
| Utility functions              | `fn::get_mutated_edges`, `fn::as_array`              | Removed                                                   |


---

## Phase 5: Query Adapter Changes (`surql2/`)

### 5.0 Overview

The query pipeline is: **BQL Query → Logical Query → Optimized Logical Query → SurrealQL → Execute → Process Results**.

The main changes are driven by how SurrealDB v3 handles references:

- **REFERENCE fields** (role fields on relations, ref content type fields): Direct record references with automatic referential integrity. Behavior is similar to v2.
- **COMPUTED fields** (link fields on entities): Reverse-lookup fields defined as `COMPUTED <~(Table FIELD field)`. Replace v2's `<future>` pattern.

Key behavioral differences from v2:

1. ONE cardinality COMPUTED fields return a **single record or `NONE`** (via `array::first()` in the schema definition), matching regular REFERENCE field behavior
2. MANY cardinality COMPUTED fields return a **flat array or `[]`** (via `array::distinct()`/`array::flatten()` in the schema definition)
3. Link-to-role COMPUTED fields directly resolve to target entity records (via `.targetRole` in the schema definition) — no additional traversal step needed in the query
4. Because the schema handles cardinality, the query builder treats COMPUTED fields the same as REFERENCE fields for projections and filters — no `needsFlattening` concept needed

### 5.1 Type Changes in `logical.ts`

#### 5.1.1 Types to rename


| v2 Type                | v3 Type                  | Reason                         |
| ---------------------- | ------------------------ | ------------------------------ |
| `FutureRefField`       | `ComputedRefField`       | Reflects v3 COMPUTED mechanism |
| `NestedFutureRefField` | `NestedComputedRefField` | Same                           |
| `FutureBiRefFilter`    | `ComputedBiRefFilter`    | Add `targetRolePath` for link-to-role filter nesting |
| `NestedFutureFilter`   | `NestedComputedFilter`   | Same                           |


The `ProjectionField` union becomes:

```typescript
export type ProjectionField =
  | MetadataField
  | DataField
  | RefField
  | ComputedRefField      // was FutureRefField
  | NestedRefField
  | NestedComputedRefField // was NestedFutureRefField
  | FlexField;
```

The `Filter` union becomes:

```typescript
export type Filter =
  | ScalarFilter
  | ListFilter
  | RefFilter
  | BiRefFilter
  | ComputedBiRefFilter   // was FutureBiRefFilter
  | LogicalOp
  | NotOp
  | NestedFilter
  | NestedComputedFilter  // was NestedFutureFilter
  | NullFilter
  | FalsyFilter;
```

#### 5.1.2 Types to modify

`**ComputedRefField` (was `FutureRefField`)**

No `needsFlattening` needed — the schema COMPUTED definition handles cardinality via array functions (see 4.2 table). The query builder treats these the same as `RefField` for projections.

```typescript
export interface ComputedRefField extends BaseRefField {
  type: 'computed_ref';
}
```

`**NestedComputedRefField` (was `NestedFutureRefField`)**

```typescript
export interface NestedComputedRefField extends BaseNestedRefField {
  type: 'nested_computed_ref';
}
```

`**NestedComputedFilter` (was `NestedFutureFilter`)**

```typescript
export interface NestedComputedFilter extends BaseNestedFilter {
  type: 'nested_computed_ref';
}
```

`**ComputedBiRefFilter` (was `FutureBiRefFilter`)**

```typescript
export interface ComputedBiRefFilter extends BaseRefFilter {
  type: 'computed_biref';
  oppositeCardinality: 'MANY' | 'ONE';
}
```

`**NullFilter**`

Replace the `tunnel` flag with `emptyIsArray: boolean`. In v3, MANY cardinality link fields map to COMPUTED fields that return `[]` when empty (not NONE). Null checks for these use `array::len(field) = 0` instead of `field IS NONE`.

ONE cardinality COMPUTED fields return `NONE` when empty (via `array::first([])` in the schema), so they behave the same as ref fields for null checks.

```typescript
export interface NullFilter {
  type: 'null';
  op: 'IS' | 'IS NOT';
  left: string;
  /** True when the field's empty representation is `[]` instead of `NONE`.
   *  Only true for MANY cardinality link fields (COMPUTED fields without array::first wrapper). */
  emptyIsArray: boolean;
}
```

`**BaseRefFilter**`

Remove `tunnel`. Since the schema COMPUTED definition handles cardinality (ONE fields return single records via `array::first()`, MANY fields return flat arrays), COMPUTED fields behave identically to REFERENCE fields for filter patterns. The v2 `tunnel` flag controlled branching between `array::first(path)` and direct `path` access — in v3, COMPUTED ONE fields already return single records, so all biref/computed_biref cases use the same non-tunnel code path. No flag needed.

```typescript
interface BaseRefFilter {
  op: 'IN' | 'NOT IN' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE';
  left: string;
  right: string[];
  thing?: [string, ...string[]];
  cardinality: 'MANY' | 'ONE';
}
```

#### 5.1.3 Types that stay the same

- `LogicalQuery`, `DataSource`, `TableScan`, `RecordPointer`, `SubQuery` — unchanged
- `Projection`, `MetadataField`, `DataField`, `FlexField` — unchanged
- `RefField`, `NestedRefField` — unchanged
- `ScalarFilter`, `ListFilter` — unchanged
- `RefFilter`, `BiRefFilter` — remove `tunnel` field (see 5.1.2 BaseRefFilter)
- `LogicalOp`, `NotOp`, `FalsyFilter`, `Sort` — unchanged

### 5.2 Building Logical Query (`buildLogical.ts`)

#### 5.2.1 `buildSimpleFieldProjection`

The mapping of enriched schema field types to projection types:


| Enriched Field Type           | Projection Type    | Notes                                                            |
| ----------------------------- | ------------------ | ---------------------------------------------------------------- |
| `data`                        | `DataField`        | —                                                                |
| `ref` (FLEX)                  | `FlexField`        | —                                                                |
| `ref` (REF)                   | `RefField`         | —                                                                |
| `role`                        | `RefField`         | —                                                                |
| `link` (target: `'relation'`) | `ComputedRefField` | Schema handles cardinality — query builder treats same as ref    |
| `link` (target: `'role'`)     | `ComputedRefField` | Schema handles cardinality — query builder treats same as ref    |


Updated logic:

```typescript
// v2
if (field.type === 'role' || field.type === 'ref') {
  return { type: 'ref', ... };
}
return { type: 'future_ref', path: field.name, ... };

// v3
if (field.type === 'role' || field.type === 'ref') {
  return { type: 'ref', ... };
}
// Both link-to-relation and link-to-role use BQL field name (both have own COMPUTED fields).
// No needsFlattening — the schema COMPUTED definition handles cardinality.
return {
  type: 'computed_ref',
  path: field.name,
  ...
};
```

#### 5.2.2 Nested field projections


| Enriched Field Type           | Nested Projection Type       | Notes                                          |
| ----------------------------- | ---------------------------- | ---------------------------------------------- |
| `role`                        | `NestedRefField` (unchanged) | —                                              |
| `link` (target: `'relation'`) | `NestedComputedRefField`     | Schema handles cardinality                     |
| `link` (target: `'role'`)     | `NestedComputedRefField`     | Schema handles cardinality                     |


Updated logic in `buildProjection`:

```typescript
// v2
projectionFields.push({
  type: fieldSchema.type === 'role' ? 'nested_ref' : 'nested_future_ref',
  path: field.$path,  // BQL field name = SurrealDB field name in v2
  ...
});

// v3
projectionFields.push({
  type: fieldSchema.type === 'role' ? 'nested_ref' : 'nested_computed_ref',
  path: field.$path, // BQL field name = SurrealDB field name (both link types have own COMPUTED fields)
  ...
});
```

Since the schema COMPUTED definition handles cardinality (including `array::first()` for ONE, `array::flatten()` for MANY with MANY target role), the query builder treats computed fields the same as ref fields. The `oppositeThingSchema` for building sub-projections is the **target entity schema** — same as for link-to-relation. No extra nesting level or flattening is needed.

#### 5.2.3 `buildLinkFieldFilter`

**Key changes**: Remove `tunnel`, rename filter types, add `emptyIsArray` for null filters only.

In v2, `tunnel` was set for all link-to-role fields and controlled multiple code paths in the filter builder (e.g., `array::first(path)` unwrapping, omitting `?: []` null fallback). In v3, since the schema COMPUTED definition handles cardinality (ONE fields return single records via `array::first()`, MANY fields return flat arrays that are `[]` when empty), COMPUTED fields behave identically to REFERENCE fields for filter patterns. All the `tunnel`-based branching in the biref filter builder collapses to the non-tunnel code path.

The only remaining distinction is for `NullFilter`: MANY COMPUTED fields return `[]` when empty (needing `array::len() = 0`), while everything else returns `NONE` (needing `IS NONE`).

```typescript
// v2
const tunnel = field.type === 'link' && field.target === 'role';
const filterType = field.type === 'role' ? 'biref' : 'future_biref';
const nestedFilterType = field.type === 'role' ? 'nested_ref' : 'nested_future_ref';

// v3
const emptyIsArray = field.type === 'link' && field.cardinality === 'MANY';
const filterType = field.type === 'role' ? 'biref' : 'computed_biref';
const nestedFilterType = field.type === 'role' ? 'nested_ref' : 'nested_computed_ref';
```

- `tunnel` is removed from `BiRefFilter`, `ComputedBiRefFilter`, and `RefFilter` — no longer needed.
- `emptyIsArray` is only passed to `NullFilter` (for `$exists` and `$eq: null` checks).

### 5.3 Optimizing Logical Query (`optimize.ts`)

#### 5.3.1 Implement computed ref → relationship traversal (TODO at line 59)

This is the most important optimization for v3. Convert COMPUTED reference filters into efficient subquery traversals through the relation.

**Example — link-to-relation filter (Account filtered by user-accounts):**

```surql
-- Before optimization (nested WHERE on COMPUTED field)
SELECT * FROM Account WHERE ⟨user-accounts⟩[WHERE id = User-Accounts:rel1]

-- After optimization (direct record pointer traversal)
SELECT * FROM (
  SELECT VALUE accounts
  FROM type::record(⟨User-Accounts⟩, "rel1")
)
```

**Example — link-to-role filter (User filtered by accounts):**

In v3, `User.accounts` (link-to-role) has its own COMPUTED field: `COMPUTED <~(User-Accounts FIELD user).accounts`, which resolves directly to Account records.

```surql
-- Before optimization (filter on COMPUTED field)
SELECT * FROM User WHERE accounts CONTAINSANY [Account:acc1]

-- After optimization (direct record pointer traversal from the opposite entity)
-- Account must have a reverse field (e.g., "users") that resolves back to User records.
SELECT * FROM (
  SELECT VALUE users
  FROM type::record(Account, "acc1")
)
```

The optimization avoids a full table scan of User by starting from Account:acc1 and using the reverse COMPUTED field. Since the schema COMPUTED definition handles cardinality, the subquery simply reads the field value. However, when the opposite field is MANY and there are multiple source records, the outer result needs flattening (see 5.3.2).

#### 5.3.2 `convertRefFilterToRelationshipTraversal`

Update to handle `computed_biref` filters (was `future_biref`). The function resolves `getRolePlayer()` to find the opposite role field for traversal.

In v3, ALL link fields (both link-to-relation and link-to-role) have their own COMPUTED fields that resolve directly to entity records. This means the optimizer can use a simple one-step `SELECT VALUE oppositePath FROM oppositeEntity:id` for all link field types — the same pattern as v2 for role fields.

**No changes needed to `SubQuery` type**: The existing `cardinality` field already represents the opposite field's cardinality (set from `player.cardinality` in `convertRefFilterToRelationshipTraversal`). The `buildFrom` function already uses `source.cardinality === 'MANY'` to decide whether to wrap with `array::distinct(array::flatten(...))`. This logic is correct for v3.

```surql
-- cardinality ONE (each source contributes a single record):
SELECT VALUE oppositePath FROM source

-- cardinality MANY (each source contributes an array):
array::distinct(array::flatten(SELECT VALUE oppositePath FROM source))
```

**Update the SubQuery comment** (logical.ts line 36): Remove the misleading `"For COMPUTED REFERENCE it is always 'MANY'"` comment — this was about `<future>` fields which are being removed.

The same applies to `convertNestedFilterToRelationshipTraversal`.

#### 5.3.3 Priority order for filter optimization

The current priority:

```
future_biref (ONE) > future_biref (MANY) > biref (ONE) > biref (MANY)
```

Updated for v3:

```
computed_biref (ONE) > computed_biref (MANY) > biref (ONE) > biref (MANY)
```

Rationale stays the same: optimizing COMPUTED ref filters takes priority because they benefit more from subquery conversion (especially link-to-role which requires traversal).

#### 5.3.4 Nested filter optimization

Update `convertNestedFilterToRelationshipTraversal` for `nested_computed_ref` (was `nested_future_ref`).

Priority order:

```
nested_ref (ONE) > nested_ref (MANY) > nested_computed_ref (ONE) > nested_computed_ref (MANY)
```

**v2 cleanup**: The v2 code has a redundant third check (`nested_ref` without cardinality filter at optimize.ts line 101, already covered by the ONE and MANY checks above it) and lacks cardinality splitting for `nested_future_ref`. The v3 priority order removes the redundant check and adds proper cardinality splitting for `nested_computed_ref`:

```typescript
// v2 (has redundant third check, no cardinality split for nested_future_ref)
findFilter(f => f.type === 'nested_ref' && f.oppositeCardinality === 'ONE') ??
findFilter(f => f.type === 'nested_ref' && f.oppositeCardinality === 'MANY') ??
findFilter(f => f.type === 'nested_ref') ??  // redundant — remove
findFilter(f => f.type === 'nested_future_ref');

// v3
findFilter(f => f.type === 'nested_ref' && f.oppositeCardinality === 'ONE') ??
findFilter(f => f.type === 'nested_ref' && f.oppositeCardinality === 'MANY') ??
findFilter(f => f.type === 'nested_computed_ref' && f.oppositeCardinality === 'ONE') ??
findFilter(f => f.type === 'nested_computed_ref' && f.oppositeCardinality === 'MANY');
```

#### 5.3.5 `getRolePlayer` — keep link-to-role guard for role fields

The function resolves opposite role info from `field.opposite`. It has a guard at optimize.ts line 221-223 that skips optimization for role fields whose opposite link field has `target !== 'relation'`:

```typescript
if (oppositeLinkField.target !== 'relation') {
  return undefined;
}
```

**Keep this guard.** It is still correct in v3. When a role field's `opposite` falls back to `targetingRole` (because the entity has no link-to-relation field), the opposite points to the entity's link-to-role COMPUTED field, which resolves to **entity records** — not relation records. For role field filter optimization, the subquery must return relation records (since the filter operates on a relation table). Using a link-to-role path would produce wrong record types.

The guard only affects `field.type === 'role'` (biref filters). Link field (`computed_biref`) filters have `field.type === 'link'` and skip the guard entirely — they already work correctly for both link-to-relation and link-to-role because both resolve to entity records, which is the correct type when filtering on an entity table.

**Only rename type references**: Update the function signature and any type guards from `FutureBiRefFilter`/`NestedFutureFilter` to `ComputedBiRefFilter`/`NestedComputedFilter`.

### 5.4 Building SurrealQL (`buildSurql.ts`)

#### 5.4.1 `buildRefFieldProjection`

`**ref` type (REFERENCE fields)**: Unchanged.

```surql
-- fieldCardinality ONE, type ref
SELECT VALUE record::id(id) FROM $this.path
-- fieldCardinality MANY, type ref
SELECT VALUE record::id(id) FROM $this.path[*]
```

`**computed_ref` type (COMPUTED fields)**:

**Behavioral change from v2**: In v2, `future_ref` fields ALWAYS used `FROM $this.path[*]` regardless of `fieldCardinality`, because `<future>` fields always returned arrays. In v3, COMPUTED ONE fields return a single record (via `array::first` in the schema definition), so `computed_ref` with `fieldCardinality === 'ONE'` uses `FROM $this.path` (no `[*]`). This is correct because the schema COMPUTED definition guarantees the cardinality.

Since the schema COMPUTED definition handles cardinality (ONE fields return single records via `array::first()`, MANY fields return flat arrays), the projection patterns are the same as for `ref` fields:

```surql
-- fieldCardinality ONE (schema returns single record via array::first)
SELECT VALUE record::id(id) FROM $this.path

-- fieldCardinality MANY (schema returns flat array)
SELECT VALUE record::id(id) FROM $this.path[*]
```

Updated code:

```typescript
const buildRefFieldProjection = (field: RefField | ComputedRefField, level: number) => {
  const { path, alias } = field;
  const escapedPath = esc(path);
  const escapedAlias = esc(alias || path);
  // Both ref and computed_ref use the same pattern — schema handles cardinality
  let subQuery: string;
  if (field.fieldCardinality === 'ONE') {
    subQuery = `SELECT VALUE record::id(id) FROM $this.${escapedPath}`;
  } else {
    subQuery = `SELECT VALUE record::id(id) FROM $this.${escapedPath}[*]`;
  }
  if (field.resultCardinality === 'ONE') {
    return indent(`array::first(${subQuery}) AS ${escapedAlias}`, level);
  }
  return indent(`(${subQuery}) AS ${escapedAlias}`, level);
};
```

#### 5.4.2 `buildNestedFieldProjection`

`**nested_ref` type**: Unchanged.

```surql
FROM $this.path       -- fieldCardinality ONE
FROM $this.path[*]    -- fieldCardinality MANY
```

`**nested_computed_ref` type** (was `nested_future_ref`):

**Behavioral change from v2**: Same as 5.4.1 — in v2, `nested_future_ref` ALWAYS used `FROM $this.path[*]` regardless of `fieldCardinality`. In v3, `nested_computed_ref` with `fieldCardinality === 'ONE'` uses `FROM $this.path` (no `[*]`).

Since the schema handles cardinality, the patterns are the same as for `nested_ref`:

```surql
-- fieldCardinality ONE (schema returns single record via array::first)
FROM $this.path

-- fieldCardinality MANY (schema returns flat array)
FROM $this.path[*]
```

Updated logic:

```typescript
if (field.fieldCardinality === 'ONE') {
  // Both nested_ref ONE and nested_computed_ref ONE — single value
  lines.push(indent(`FROM $this.${esc(field.path)}`, level + 1));
} else {
  // Both nested_ref MANY and nested_computed_ref MANY — flat array
  lines.push(indent(`FROM $this.${esc(field.path)}[*]`, level + 1));
}
```

#### 5.4.3 `buildFilter` — null check changes

```typescript
case 'null': {
  if (filter.emptyIsArray) {
    // MANY COMPUTED fields return [] when empty, not NONE
    if (filter.op === 'IS') {
      return `array::len(${_prefix}${esc(filter.left)}) = 0`;
    }
    return `array::len(${_prefix}${esc(filter.left)}) > 0`;
  }
  return `${_prefix}${esc(filter.left)} ${filter.op} NONE`;
}
```

`emptyIsArray` is true only for MANY cardinality link fields (COMPUTED fields that return `[]` when empty). ONE cardinality COMPUTED fields return `NONE` when empty (via `array::first([])` in the schema), so they use the same `IS NONE` pattern as ref fields.

**Bug fix**: The v2 code has a bug — when `tunnel: true`, it always returns `array::len(path) = 0` regardless of whether `op` is `'IS'` or `'IS NOT'`. This means `{ $exists: true }` on a link-to-role field incorrectly generates the "is empty" check instead of "is non-empty". The v3 code above fixes this by branching on `filter.op`.

#### 5.4.4 `buildFilter` — reference value filter simplification

The `biref` and `computed_biref` (was `future_biref`) cases are handled together. **Key change: remove all `tunnel` branching.** The v2 code had 6 `tunnel`-conditioned branches (buildSurql.ts lines 243-270) that used `array::first(path)` for link-to-role fields. In v3, since COMPUTED ONE fields already return single records and COMPUTED MANY fields already return flat arrays, all cases use the same non-tunnel code path.

Specifically, these v2 tunnel patterns collapse:

```typescript
// v2 tunnel ONE: array::first(path) && record::id(array::first(path)) = $param
// v3 (same as non-tunnel): path && record::id(path) = $param

// v2 tunnel MANY: $param IN path.map(|$i| record::id($i))
// v3 (same as non-tunnel): $param IN (path ?: []).map(|$i| record::id($i))
```

**`?: []` null fallback**: The non-tunnel code path uses `(path ?: []).map(...)` as a null safety fallback. For MANY COMPUTED fields that always return `[]` (never NONE), this `?: []` is unnecessary but harmless. Keep it for simplicity — it also handles REFERENCE fields that can be NONE.

The optimizer should have already converted most of these to subquery traversals (see 5.3.1), but the filter builder must handle the un-optimized fallback correctly.

#### 5.4.5 `buildFilter` — FlexField IF/THEN/END syntax update

The FlexField projections in `buildSurql.ts:158,163` use `IF ... THEN ... END`. Update to `IF ... { ... }`:

```typescript
// v2 (line 158)
`(IF ${escapedPath} THEN IF type::is::record(${escapedPath}) { record::id(${escapedPath}) } ELSE { ${escapedPath} } END) AS ${escapedAlias}`

// v3
`(IF ${escapedPath} { IF type::is_record(${escapedPath}) { record::id(${escapedPath}) } ELSE { ${escapedPath} } }) AS ${escapedAlias}`

// v2 (line 163)
`(IF ${escapedPath} THEN ${escapedPath}.map(|$i| IF type::is::record($i) { record::id($i)} ELSE { $i }) END) AS ${escapedAlias}`

// v3
`(IF ${escapedPath} { ${escapedPath}.map(|$i| IF type::is_record($i) { record::id($i)} ELSE { $i }) }) AS ${escapedAlias}`
```

#### 5.4.6 `buildFrom` — subquery data source

No structural changes needed. The existing code already uses `source.cardinality` to decide the subquery wrapping pattern:

```surql
-- cardinality ONE (each source record contributes a single record):
FROM (
  SELECT VALUE oppositePath
  FROM source
  WHERE filter
)

-- cardinality MANY (each source record contributes an array — need outer flatten):
FROM array::distinct(array::flatten(
  SELECT VALUE oppositePath
  FROM source
  WHERE filter
))
```

**Clean up dead code**: Remove the no-op expression `source.oppositePath;` at `buildSurql.ts:185`.

#### 5.4.7 `buildFilter` — nested filter for COMPUTED fields

Since the schema handles cardinality, COMPUTED fields behave the same as REFERENCE fields for nested filters. No flattening is needed in the query builder:

```surql
-- v3: accounts is COMPUTED array::distinct(array::flatten(<~(User-Accounts FIELD user).accounts))
-- Field already returns a flat array of Account records
-- ONE cardinality (single record, dot-access):
account.name = "X"

-- MANY cardinality (flat array, WHERE filter):
accounts[WHERE name = "X"]
```

```typescript
case 'nested_computed_ref': {
  const computedPath = `${_prefix}${esc(filter.path)}`;
  // Same pattern as nested_ref — schema handles cardinality
  if (filter.cardinality === 'ONE') {
    return buildFilter(filter.filter, mutParams, `${computedPath}.`);
  }
  const subFilter = buildFilter(filter.filter, mutParams);
  if (!subFilter) return undefined;
  return `${computedPath}[WHERE ${subFilter}]`;
}
```

### 5.5 Processing Results (`processResults.ts`)

#### 5.5.1 Minimal changes expected

The result processor receives shaped results from SurrealQL. The query already handles:

- `array::first()` for ONE cardinality unwrapping
- `array::flatten()` for link-to-role fields with MANY target role cardinality
- Array access patterns in projections

So the result shape reaching `processResults` should be the same as in v2.

#### 5.5.2 Empty array handling

COMPUTED fields return `[]` instead of `NONE` when no references exist. The existing code already handles this:

```typescript
// Already in processResults.ts — works for v3
if (!returnNulls && (isNullish(value) || isEmptyArray(value))) {
  continue;
}
// ...
newResult[alias] = isEmptyArray(value) ? null : (tryConvertDate(value) ?? null);
```

Verify this handles all edge cases with v3 COMPUTED fields, but no structural changes are needed.

#### 5.5.3 DateTime import

The `DateTime` class is still exported from the `surrealdb` npm package v2.0.1. No changes needed.

#### 5.5.4 No changes to `run.ts` or `query.ts`

The query pipeline orchestration and execution remain the same.

### 5.6 Summary of changes by file


| File                | Scope       | Description                                                                                                                                                                                                |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logical.ts`        | Moderate    | Rename 4 types, remove `tunnel` from `BaseRefFilter`, replace `tunnel` with `emptyIsArray` in `NullFilter`, update SubQuery comment                                                                        |
| `buildLogical.ts`   | Moderate    | Update field type mapping, remove `tunnel`, add `emptyIsArray` for null filters only. No `needsFlattening` — schema handles cardinality.                                                                   |
| `optimize.ts`       | Significant | Update type names (including `future_ref` at line 248 in `optimizeProjectionField`), implement computed ref → relationship traversal optimization (TODO at line 59), keep `getRolePlayer` link-to-role guard for role fields, fix redundant nested_ref check |
| `buildSurql.ts`     | Moderate    | Remove all `tunnel` branching in biref filters, update null checks with `emptyIsArray`, fix IF/THEN/END → IF { }, rename `type::is::record` → `type::is_record`. Projections/filters simplified — computed fields treated same as ref fields. |
| `processResults.ts` | Minimal     | Verify empty array handling (ONE computed returns NONE, MANY computed returns []), DateTime import unchanged                                                                                                |
| `run.ts`            | None        | No changes                                                                                                                                                                                                 |
| `query.ts`          | None        | No changes                                                                                                                                                                                                 |


### 5.7 Phase dependency

Phase 5 does **not** depend on `targetRoleCardinality` or any new enriched schema fields. Since the schema COMPUTED definition handles cardinality via array functions, the query builder only needs the field's own `cardinality` (ONE or MANY) to determine projection/filter patterns.

`relation`, `plays`, `targetRole`, and `targetRoleCardinality` on `DRAFT_EnrichedBormLinkField` are used by Phase 4 (schema generation in `define.ts`, which now uses `DRAFT_EnrichedBormSchema`) to generate COMPUTED field expressions. They are populated in Phase 4.9 (`enrichSchemaDraft` changes). The query adapter does not need these fields — it uses `opposite` for optimization.

---

## Phase 6: Mutation Builder Changes (`mutation/surql/build.ts`)

### 6.1 IF/THEN/END syntax — MUST UPDATE

The mutation builder uses `IF ... THEN ... END` in multiple places. All must be updated to `IF ... { ... }`:

```typescript
// v2 (line 105)
return `LET ${VAR} = IF (${COND}) THEN (UPDATE ${TARGET} ${SET} ${WHERE} RETURN ${OUTPUT}) END;`;
// v3
return `LET ${VAR} = IF (${COND}) { (UPDATE ${TARGET} ${SET} ${WHERE} RETURN ${OUTPUT}) };`;

// v2 (line 108)
return `LET ${VAR} = IF (${COND}) THEN (DELETE ${TARGET} ${WHERE} RETURN ${DELETE_OUTPUT}) END;`;
// v3
return `LET ${VAR} = IF (${COND}) { (DELETE ${TARGET} ${WHERE} RETURN ${DELETE_OUTPUT}) };`;

// v2 (line 178, 341)
return `IF ${VAR} THEN (UPDATE ${VAR} ${SET} RETURN VALUE id) END; ${VAR};`;
// v3
return `IF ${VAR} { (UPDATE ${VAR} ${SET} RETURN VALUE id) }; ${VAR};`;
```

### 6.2 Function renames in mutation builder

- `build.ts:151,292` — `type::is::array()` → `type::is_array()`

### 6.3 `fn::as_array` removal

BORM-generated SurrealQL queries must not rely on custom functions defined in the SurrealDB schema. All `fn::as_array` usages must be replaced with inline logic. Determine the best replacement case by case for performance.

**`build.ts:257`** — arc deletion: `fn::as_array(role) CONTAINSANY $things`

Role fields on relations are always correctly typed via `TYPE option<array<record<...>>>` or `TYPE option<record<...>>>`. With v3 REFERENCE fields, the type is enforced. Replace with direct field access using `array::flatten`:

```typescript
// v2
`DELETE FROM ${tableName} WHERE fn::as_array(${roleA}) CONTAINSANY $⟨${thingsA}⟩ AND fn::as_array(${roleB}) CONTAINSANY $⟨${thingsB}⟩ RETURN BEFORE`

// v3 — use array::flatten([field]) to normalize single record to array
`DELETE FROM ${tableName} WHERE array::flatten([${roleA}]) CONTAINSANY $⟨${thingsA}⟩ AND array::flatten([${roleB}]) CONTAINSANY $⟨${thingsB}⟩ RETURN BEFORE`
```

**`build.ts:250`** — commented-out code using `fn::as_array`. Clean up — remove the dead comment since it references the removed function.

**`filters/filters.ts:145,150`** — mutation filter building: `fn::as_array(field)[WHERE id && ...]`

This is used in `buildSuqlFilter` for `$parent.`-prefixed references. These handle role/link fields accessed from a parent context. Since the field type is known from schema, replace with `array::flatten([field])`:

```typescript
// v2 (line 145, cardinality MANY)
`fn::as_array(${keyWithoutPrefix})[WHERE id && ${nestedFilter}]`
// v3
`array::flatten([${keyWithoutPrefix}])[WHERE id && ${nestedFilter}]`

// v2 (line 150, cardinality ONE)
`fn::as_array(${keyWithoutPrefix})[WHERE id && ${nestedFilter}]`
// v3
`array::flatten([${keyWithoutPrefix}])[WHERE id && ${nestedFilter}]`
```

### 6.4 `buildEdges()` — Role field mutations

With v3 REFERENCE fields, updating a role field on a relation automatically maintains the reverse reference. The mutation builder may be simplified:

- Remove manual bidirectional update logic if SurrealDB handles it via REFERENCE
- However, verify that SurrealDB v3 REFERENCE automatically updates computed fields or if explicit updates are still needed for the role fields on relations

### 6.5 `buildArcs()` — Relation creation/deletion

The arc creation uses `CREATE ONLY tableName SET roleA = ..., roleB = ...`. This should still work with REFERENCE fields. Changes:

- Replace `fn::as_array` usage in DELETE (line 257) — use direct field access since role fields are always typed correctly
- Events are no longer triggered (they're removed), so verify REFERENCE handles what events used to do

### 6.6 `buildReferences()` — Reference field mutations

This handles direct reference field mutations (REF and FLEX content types). Should continue to work but needs testing with v3.

### 6.7 `buildThings()` — Entity mutations

The `CREATE ONLY`, `UPDATE`, `DELETE` patterns should remain the same. The Delta/output pattern using `$before`/`$after` is confirmed still available in v3.

### 6.8 SCHEMAFULL strict behavior

v3 SCHEMAFULL tables now **error on undefined fields** instead of silently filtering them. Verify that:

- All `CREATE` / `UPDATE` statements only set fields defined in the schema
- No extra fields leak through from BQL mutations to SurrealQL
- If needed, use destructuring `.{ field1, field2 }` to project before insert

---

## Phase 7: Test Updates

### 7.1 Update Docker images and test scripts

`**tests/test.sh`:**

- Change `surrealdb/surrealdb:v2.3.7` → `surrealdb/surrealdb:v3` (uses latest v3.x)
- Remove the `LINK` variable and all `BORM_TEST_SURREALDB_LINK_MODE` validation logic (lines 37-51)
- Simplify schema/data file paths from dynamic `${LINK}Schema.surql` / `${LINK}Data.surql` to static `schema.surql` / `data.surql`
- Change namespace from `test_${LINK}` to `test`
- Remove argument parsing that filters out `-link=*` (lines 19-32)
- Update the **multidb section** (lines 79-91) which also loads schema/data files — same simplification

`**tests/benchTests.sh`** and `**tests/bench.sh`:**

- These currently use `surrealdb/surrealdb:latest` (not pinned). Change to `surrealdb/surrealdb:v3` for reproducibility.
- Same changes as `test.sh`: remove linkMode logic, simplify file paths and namespace

### 7.2 Update mock schemas

After the migration there is only one set of test files for SurrealDB single-DB tests — no more `refs`/`edges` variants.

**Rename and consolidate:**

- `refsSchema.surql` → `schema.surql`
- `refsData.surql` → `data.surql`

**Remove:**

- `tests/adapters/surrealDB/mocks/edgesSchema.surql`
- `tests/adapters/surrealDB/mocks/edgesData.surql`
- `tests/adapters/surrealDB/mocks/refsSchema.computedRefs.surql`
- `tests/adapters/surrealDB/mocks/refsSchema.tree.surql`

**Update `schema.surql` (formerly `refsSchema.surql`):**

- Remove all `VALUE <future> { ... }` fields, replace with `COMPUTED <~(Table FIELD field)` syntax
- Add `REFERENCE` to all role fields on relations
- Remove all `DEFINE EVENT` statements
- Remove `fn::get_mutated_edges` and `fn::as_array` utility function definitions
- Remove support fields (e.g., `DEFINE FIELD user-accounts ON TABLE Account TYPE option<record<User-Accounts>>`)
- Update any `IF ... THEN ... END` patterns to `IF ... { ... }`

**Update `data.surql` (formerly `refsData.surql`):**

- Review if data insertion still works after schema changes
- With REFERENCE fields, inserting a role field value should automatically update the computed reverse reference
- Update any `type::record("Table:id")` single-arg calls to the v3 two-arg form `type::record(Table, "id")` (see 3.1.4)

### 7.3 Update test config

`**tests/adapters/surrealDB/mocks/config.ts`:**

- Remove `linkMode` from provider config
- Remove `BORM_TEST_SURREALDB_LINK_MODE` env var

### 7.4 Update `tests/unit/schema/define.test.ts`

- Update expected schema output to match v3 syntax:
  - `REFERENCE` on role fields
  - `COMPUTED <~(...)` for link fields
  - No events, no utility functions
  - No `IF THEN END` in generated schema
- Add tests for REFERENCE and COMPUTED field generation

### 7.5 Update `package.json` test scripts

Simplify all SurrealDB test scripts:

- Remove `:edges` variants
- Remove `BORM_TEST_SURREALDB_LINK_MODE` env var from all scripts
- Remove `LEGACY_SURREALDB_ADAPTER` references

### 7.6 Run tests

- `test:surrealdb-ignoreTodo` - all SurrealDB tests (excluding TODOs)
- Other test scripts have failed TODOs that don't need to be fixed in this migration

---

## Risk Areas

- **Computed reference behavior**: ONE cardinality COMPUTED fields return `NONE` when empty (via `array::first([])`), MANY cardinality COMPUTED fields return `[]`. The schema array function wrappers ensure the field value matches BQL cardinality.
- **SCHEMAFULL strict enforcement**: v3 errors on undefined fields in SCHEMAFULL tables. Mutation builders must only set defined fields.
- **Event removal**: Removing events means REFERENCE must fully handle all bidirectional consistency cases. Edge cases with cardinality ONE replacement need testing.
- **Mutation output**: The `$before`/`$after` variables in mutation RETURN clauses are confirmed still available in v3.
- `**fn::as_array` in mutations**: Used in `buildArcs` DELETE (line 257) and `filters.ts` (lines 145, 150) — replaced with `array::flatten([field])` inline (see Phase 6.3). Commented-out usage at `build.ts:250` must be cleaned up.
- **IF/THEN/END syntax**: Must be updated to `IF { }` across all SurrealQL generation code (buildSurql.ts, build.ts). Missing this will cause parse errors.
- **Function renames**: `type::is::record()` → `type::is_record()`, `type::is::array()` → `type::is_array()`. Missing this will cause runtime errors.
- `**type::record()` signature change**: The single-arg `type::record("Table:id")` **WILL break** in v3. Must switch to two-arg `type::record(table, id)` in both `buildSurql.ts` (RecordPointer sources and filter `thing` optimization) and any test `.surql` files that use it.
- **Optimizer subquery with MANY opposite fields**: When combining results from multiple source records where the opposite COMPUTED field is MANY, the `SubQuery` must use `array::distinct(array::flatten(...))` to flatten the array of arrays. The existing `SubQuery.cardinality` field (set from opposite field cardinality) drives this.
- **Optimizer link-to-role guard**: The `getRolePlayer` function has a guard that blocks optimization for role fields whose opposite is a link-to-role. This guard is **correct and must be kept** — removing it would cause role field filter optimization to produce wrong record types (entity records instead of relation records). Link field (`computed_biref`) filters are unaffected by the guard.
- **Invalid cardinality combination**: Link-to-role with field cardinality ONE and target role cardinality MANY must throw during schema enrichment. This combination cannot be meaningfully represented.
- **v2 null filter bug**: `tunnel: true` with `op: 'IS NOT'` generates wrong SurrealQL (`= 0` instead of `> 0`). Fixed in v3 (replaced with `emptyIsArray` which correctly branches on `filter.op`). Existing v2 tests may have been written around this buggy behavior — fix any tests that assert the wrong output.
- **COMPUTED field constraints**: Cannot be nested, cannot combine with VALUE/DEFAULT/ASSERT. Verify all generated COMPUTED fields are top-level only.
- **Benchmarks**: Do NOT modify files in `./benches/*`. Use the main branch for comparison benchmarking.
- **Virtual fields (both link and data)**: Fields with `isVirtual: true` and `dbValue.surrealDB` set use custom expressions (not standard COMPUTED). The `dbValue` includes the full clause (e.g., `VALUE ...` or `COMPUTED ...`). These are NOT converted to standard COMPUTED fields. Fix the existing double-prefix bug at both `define.ts:90` (link fields) and `define.ts:66` (data fields). If existing `dbValue` strings contain v2 syntax (`<future>`, `IF THEN END`, `type::is::record()`), they will break in v3. Update any test virtual fields; users must update theirs for the new major version.
- **Breaking API change**: Removing `providerConfig` from `SurrealDBProviderObject` and `SurrealDBProviderConfig` type is a breaking change. Users passing `providerConfig` in their config will get TypeScript errors. This migration is a new major version.
- **COMPUTED fields are read-only**: Link fields on entities become COMPUTED and must never be SET in mutations. The mutation builder works through role fields on relations (not entity link fields), so this is already the case — but verify no edge case tries to SET a COMPUTED field.
- **Projection behavioral change**: In v2, `future_ref` and `nested_future_ref` always used `FROM $this.path[*]` regardless of `fieldCardinality`. In v3, `computed_ref` and `nested_computed_ref` with `fieldCardinality === 'ONE'` use `FROM $this.path` (no `[*]`). This relies on the schema COMPUTED definition correctly wrapping ONE cardinality fields with `array::first()`.

---

## Phase Dependencies

Phases have the following dependency structure:

- **Phase 1** (Client update): Independent. Can be done first or in parallel with anything.
- **Phase 2** (Remove legacy adapter): Independent of Phases 3-6. Can be done in parallel.
- **Phase 3** (SurrealQL syntax reference): Not an implementation phase — it documents syntax changes applied in Phases 4-6.
- **Phase 4** (Schema definition): Depends on Phase 4.9 (enrichSchema changes) for `targetRoleCardinality`. Requires `DRAFT_EnrichedBormSchema` types to be updated first.
- **Phase 5** (Query adapter): Independent of Phase 4. Only needs the type renames agreed upon (Phase 5.1). Can be developed in parallel with Phase 4.
- **Phase 6** (Mutation builder): Independent of Phases 4 and 5. Only syntax changes (IF/THEN/END, function renames, fn::as_array removal). Can be developed in parallel.
- **Phase 7** (Tests): Depends on all other phases being complete.

**Recommended execution order**: Phases 1 + 2 first (cleanup), then Phases 4 + 5 + 6 in parallel (agree on type names from 5.1 upfront), then Phase 7 (integration testing).

---

## Appendix: Complete List of Code Locations Requiring Changes

### SurrealQL syntax fixes (IF/THEN/END, function renames)


| File                                          | Lines    | Change                                                               |
| --------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `src/stateMachine/query/surql2/buildSurql.ts` | 158      | `IF...THEN...END` → `IF { }`, `type::is::record` → `type::is_record` |
| `src/stateMachine/query/surql2/buildSurql.ts` | 163      | `IF...THEN...END` → `IF { }`, `type::is::record` → `type::is_record` |
| `src/stateMachine/mutation/surql/build.ts`    | 105      | `IF...THEN...END` → `IF { }`                                         |
| `src/stateMachine/mutation/surql/build.ts`    | 108      | `IF...THEN...END` → `IF { }`                                         |
| `src/stateMachine/mutation/surql/build.ts`    | 151      | `type::is::array` → `type::is_array`                                 |
| `src/stateMachine/mutation/surql/build.ts`    | 178      | `IF...THEN...END` → `IF { }`                                         |
| `src/stateMachine/mutation/surql/build.ts`    | 292      | `type::is::array` → `type::is_array`                                 |
| `src/stateMachine/mutation/surql/build.ts`    | 341      | `IF...THEN...END` → `IF { }`                                         |
| `src/adapters/surrealDB/schema/define.ts`     | 219-241  | Remove `addUtilityFunctions()` entirely (includes `fn::as_array` with `type::is::array`) |
| `src/adapters/surrealDB/filters/filters.ts`   | 145, 150 | Replace `fn::as_array()` with `array::flatten([field])`              |
| `src/stateMachine/mutation/surql/build.ts`    | 250      | Remove commented-out `fn::as_array()` code                           |
| `src/stateMachine/mutation/surql/build.ts`    | 257      | Replace `fn::as_array()` with `array::flatten([field])`              |
| `src/stateMachine/query/surql2/buildSurql.ts` | 175-178  | `type::record($param)` → `type::record($table, $id)` (RecordPointer) |
| `src/stateMachine/query/surql2/buildSurql.ts` | 217-222  | `type::record($param)` → `type::record($table, $id)` (filter thing)  |
| `src/stateMachine/query/surql2/buildSurql.ts` | 185      | Remove dead code `source.oppositePath;` (no-op expression)            |
| `src/stateMachine/query/surql2/optimize.ts`   | 248      | `future_ref` → `computed_ref` in `optimizeProjectionField` type check |


### Schema definition changes (define.ts)


| Lines                  | Change                                                    |
| ---------------------- | --------------------------------------------------------- |
| Function signature     | Switch from `EnrichedBormSchema` to `DRAFT_EnrichedBormSchema`, pass schema through to `convertLinkFields` |
| 66                     | Fix virtual data field: `VALUE ${dbValue}` → `${dbValue}` (remove double-prefixed VALUE) |
| 90                     | Fix virtual link field: `VALUE ${dbValue}` → `${dbValue}` (remove double-prefixed VALUE) |
| 114-115                | `VALUE <future> {...}` → `COMPUTED <~(Table FIELD field)` for link-to-relation, `COMPUTED <~(Table FIELD selfRole).targetRole` for link-to-role |
| 143-203                | Remove `generateRoleEvent()` entirely                     |
| 219-241                | Remove `addUtilityFunctions()` entirely                   |
| Role field definitions | Add `REFERENCE ON DELETE <action>` keyword (read `onDelete` prop, default `'UNSET'`) |


### Type system changes (logical.ts, buildLogical.ts)


| Change                                      | Scope                                    |
| ------------------------------------------- | ---------------------------------------- |
| `future_ref` → `computed_ref`               | All type references                      |
| `nested_future_ref` → `nested_computed_ref` | All type references                      |
| `future_biref` → `computed_biref`           | All type references                      |
| Remove `tunnel` from `BaseRefFilter`        | `RefFilter`, `BiRefFilter`, `ComputedBiRefFilter` — no replacement needed |
| `tunnel` → `emptyIsArray` in `NullFilter`   | True for MANY cardinality link fields only |
| Update `SubQuery` comment                   | Remove misleading `<future>` reference   |
| Keep `getRolePlayer` link-to-role guard     | optimize.ts — guard is correct for role field (biref) filters, only rename type references |
| `future_ref` → `computed_ref` in `optimizeProjectionField` | optimize.ts line 248 — update type check |
| Restructure `DRAFT_EnrichedBormLinkField`   | Discriminated union with `relation`, `plays`, `targetRole`, `targetRoleCardinality` (Phase 4.9) |
| Add `onDelete`                              | `RoleField` and `DRAFT_EnrichedBormRoleField` — `'CASCADE' \| 'UNSET' \| 'IGNORE'`, default `'UNSET'` |
| Remove `providerConfig`                     | `SurrealDBProviderObject`, `SurrealDBHandles` — remove `SurrealDBProviderConfig` type entirely. **Breaking API change** — new major version. |


