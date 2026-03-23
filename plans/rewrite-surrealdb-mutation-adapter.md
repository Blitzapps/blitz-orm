# Plan: Rewrite SurrealDB Mutation Adapter

## Overview

Create a new SurrealDB mutation adapter at `src/stateMachine/mutation/surql2/` following the design pattern of the query adapter at `src/stateMachine/query/surql2/`. Keep the existing mutation adapter intact.

**Important:** Use `DRAFT_EnrichedBormSchema` (from `src/types/schema/enriched.draft.ts`) throughout the new mutation adapter, not the legacy `EnrichedBormSchema`. This matches the approach used by the query adapter in `src/stateMachine/query/surql2/`. Hooks are defined on `DRAFT_EnrichedBormSchema` — the legacy schema is not used anywhere in the new adapter.

**Schema prerequisites:** Before building the mutation adapter, `DRAFT_EnrichedBormDataField` must be made generic over `ContentType` to support typed `default` values and `validations`. The `applyDefaults` phase handles default value generation before hooks run.

## Pipeline

```
DRAFT_BQLMutation (user input)
    ↓ parse
BQLMutation (validated & normalized, $op?: optional)
    ↓ inferOp (infer $op for every node in the tree, throw on constraint violations)
BQLMutation (with $op set on every node)
    ↓ applyDefaults (compute defaults for create nodes, convert string dates)
BQLMutation (with defaults applied)
    ↓ applyHooks (transform hooks, validate hooks)
BQLMutation (transformed & validated)
    ↓ buildLogical
LogicalMutation
    ↓ optimize
LogicalMutation (optimized)
    ↓ buildSurql
SurQL string + params
    ↓ run (execute in transaction)
Raw SurrealDB results
    ↓ processResults
MutationResult (flat array)
```

## File Structure

```
src/stateMachine/mutation/surql2/
├── logical.ts          # Type definitions for LogicalMutation
├── parse.ts            # DRAFT_BQLMutation → BQLMutation parsing
├── inferOp.ts          # $op inference for every node (after parse, before defaults)
├── defaults.ts         # Default value application (after inferOp, before hooks)
├── hooks.ts            # Hook transforms and validations
├── buildLogical.ts     # BQLMutation → LogicalMutation conversion
├── optimize.ts         # LogicalMutation optimization (filter optimization)
├── buildSurql.ts       # LogicalMutation → SurQL string compilation
├── run.ts              # Pipeline orchestration
├── query.ts            # Low-level DB execution wrapper (transaction-based)
└── processResults.ts   # Raw results → MutationResult (flat array)
```

---

## Phase 0: Schema Type Changes

**File: `src/types/schema/enriched.draft.ts`**

Changes to `DRAFT_EnrichedBormDataField` and related types. These are prerequisites for the mutation adapter but also affect the query adapter and enrichment logic.

### 0.1 Make `DRAFT_EnrichedBormDataField` Generic

Make `DRAFT_EnrichedBormDataField` generic over `ContentType` so that dependent properties (`default`, `validations`) are correctly typed based on the field's content type.

```typescript
import type { ContentType, ContentTypeMapping, DiscreteCardinality } from './fields';

export interface DRAFT_EnrichedBormDataField<CT extends ContentType = ContentType> {
  type: 'data';
  name: string;
  contentType: CT;
  cardinality: DiscreteCardinality;
  unique: boolean;
  default?: DRAFT_DataFieldDefault<CT>;
  validations?: DRAFT_Validations<CT>;
  isVirtual?: boolean;
  dbValue?: { surrealDB?: string; typeDB?: string };
}
```

The default type parameter `= ContentType` ensures backwards compatibility — existing code that uses `DRAFT_EnrichedBormDataField` without a type argument continues to work.

### 0.2 Add `default` Property

Add a `default` property following the legacy `DataField` pattern. The default can be a static value or a function. The value/return type is `ContentTypeMapping[CT] | null`.

```typescript
type DRAFT_DataFieldDefault<CT extends ContentType = ContentType> =
  | { type: 'value'; value: ContentTypeMapping[CT] | null }
  | { type: 'fn'; fn: (currentNode: Record<string, unknown>) => ContentTypeMapping[CT] | null };
```

This mirrors the legacy `DataField.default` but:
- Uses `Record<string, unknown>` for `currentNode` instead of `BQLMutationBlock` (avoids coupling to the legacy mutation type).
- Allows `null` return — the function can signal "no default" by returning `null`.

### 0.3 Create Generic `DRAFT_Validations` Type

Replace the current `Validations` import with a new generic `DRAFT_Validations` type. The `enum` array and `fn` validator are typed according to `ContentType`.

```typescript
type DRAFT_Validations<CT extends ContentType = ContentType> = {
  required?: boolean;
  unique?: boolean;
  enum?: ContentTypeMapping[CT][];
  fn?: (value: ContentTypeMapping[CT]) => boolean;
};
```

This supersedes the legacy `Validations` type (from `fields.ts`) for the draft schema. The legacy type keeps `enum` as `unknown[]` and lacks `fn`; the new type is fully typed.

### 0.4 Add `hooks` to `DRAFT_EnrichedBormEntity` and `DRAFT_EnrichedBormRelation`

Add the `hooks` property to both thing types in `DRAFT_EnrichedBormSchema` so the mutation adapter can look up hooks without touching the legacy schema.

The hook types mirror the legacy `Hooks` type from `src/types/schema/base.ts`, but use `Record<string, unknown>` for node parameters (no coupling to legacy mutation types):

```typescript
type DRAFT_BormTrigger = 'onCreate' | 'onUpdate' | 'onDelete' | 'onLink' | 'onUnlink' | 'onReplace' | 'onMatch';

type DRAFT_TransformAction = {
  type: 'transform';
  fn: (
    currentNode: Record<string, unknown>,
    parentNode: Record<string, unknown>,
    context: Record<string, unknown>,
  ) => Partial<Record<string, unknown>>;
};

type DRAFT_ValidateAction = {
  type: 'validate';
  fn: (
    currentNode: Record<string, unknown>,
    parentNode: Record<string, unknown>,
    context: Record<string, unknown>,
  ) => boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

type DRAFT_Action = { name?: string; description?: string } & (DRAFT_TransformAction | DRAFT_ValidateAction);

type DRAFT_PreHook = {
  triggers?: { [K in DRAFT_BormTrigger]?: () => boolean }; // Currently argument-less; will receive the mutation node in a future update
  actions: readonly DRAFT_Action[];
};

type DRAFT_Hooks = {
  pre?: readonly DRAFT_PreHook[];
};
```

Add `hooks?: DRAFT_Hooks` to `EnrichedBormThing` (the shared base interface):

```typescript
interface EnrichedBormThing {
  name: string;
  idFields: [string, ...string[]];
  extends?: string;
  subTypes: string[];
  indexes: Index[];
  hooks?: DRAFT_Hooks;
}
```

The enrichment logic in `src/enrichSchema.draft.ts` should copy `hooks` from the source schema definition when constructing `DRAFT_EnrichedBormEntity` / `DRAFT_EnrichedBormRelation` values.

### 0.5 Update Usages

- `DRAFT_EnrichedBaseBormField` and `DRAFT_EnrichedBormField` unions still reference `DRAFT_EnrichedBormDataField` (now defaults to `ContentType`, so no changes needed in the union).
- The enrichment logic in `src/enrichSchema.draft.ts` should pass the concrete `ContentType` when constructing `DRAFT_EnrichedBormDataField` values (e.g., `DRAFT_EnrichedBormDataField<'TEXT'>`), but this is optional — the generic default handles it.
- `src/enrichSchema.draft.ts` must be updated to copy `default` and `validations` from each source data field definition when constructing `DRAFT_EnrichedBormDataField` values (source data fields in `BormSchema` already carry `default` and `validations` if defined).
- `src/enrichSchema.draft.ts` must also copy `hooks` from each source entity/relation definition onto the enriched thing.

---

## Phase 1: Type Definitions

### 1.1 `DRAFT_BQLMutation` Parser (in `parse.ts`)

A Zod parser similar to `BQLQueryParser` but for mutations. Key differences from `BQLQueryParser`:
- No `$fields`, `$excludedFields`, `$limit`, `$offset`, `$sort` props
- Has `$op: 'create' | 'update' | 'delete' | 'link' | 'unlink'` (optional, inferred from context)
- Has `$tempId: string` (optional, for cross-referencing in batches)
- Has `$filter` (shared type with query - reuse `BQLFilterParser`)
- Has `$id: string | string[]` (optional)
- Has `$thing` / `$entity` / `$relation` (at root level, at least one required)
- Allows arbitrary field keys for data/ref/role/link field mutations

**Root mutation:**
```typescript
const DRAFT_BQLMutationParser = z.object({
  $thing: z.string().optional(),
  $entity: z.string().optional(),
  $relation: z.string().optional(),
  $id: z.union([z.string(), z.array(z.string())]).optional(),
  $filter: z.union([BQLFilterParser, z.array(BQLFilterParser)]).optional(),
  $op: z.enum(['create', 'update', 'delete', 'link', 'unlink']).optional(),
  $tempId: z.string().optional(),
}).catchall(z.any())
  .superRefine(/* validate at least one of $thing/$entity/$relation */)
  .transform(/* normalize $entity/$relation → $thing */);
```

**Nested mutation block** (for children in role/link/ref fields):
```typescript
const NestedBQLMutationParser = z.object({
  $thing: z.string().optional(),
  $id: z.union([z.string(), z.array(z.string())]).optional(),
  $filter: z.union([BQLFilterParser, z.array(BQLFilterParser)]).optional(),
  $op: z.enum(['create', 'update', 'delete', 'link', 'unlink']).optional(),
  $tempId: z.string().optional(),
}).catchall(z.any());
```

**Parsed output type:**
```typescript
type BQLMutation = {
  $thing: string;
  $id?: string | string[];
  $filter?: BQLFilter | BQLFilter[];
  $op?: 'create' | 'update' | 'delete' | 'link' | 'unlink'; // required after Phase 3 (inferOp)
  $tempId?: string;
  [key: string]: any; // data/ref/role/link field values
};
```

### 1.2 `LogicalMutation` Types (in `logical.ts`)

```typescript
interface LogicalMutation {
  matches: Match[];
  subMatches: SubMatch[];
  creates: CreateMut[];
  updates: UpdateMut[];
  deletes: DeleteMut[];
}

interface Match {
  name: string;
  source: DataSource;
  filter?: Filter | Filter[];
}

// DataSource is shared with the logical query (from src/stateMachine/query/surql2/logical.ts)
export type DataSource = TableScan | RecordPointer | SubQuery;

interface SubMatch {
  name: string;
  parent: string; // name of parent Match/SubMatch/CreateMut
  path: string;   // DB field path from parent to this thing (see §6.6b for resolution rules)
  ids?: string[];
  filter?: Filter | Filter[];
}

interface CreateMut {
  name: string;
  thing: string;
  id: string;
  tempId?: string;
  op: 'create';
  values: Record<string, ValueMut>;
}

interface UpdateMut {
  name: string;
  match: string; // name of Match/SubMatch/CreateMut (CreateMut names used for cycle-breaking updates, see §6.11)
  op: 'update';
  values: Record<string, ValueMut>;
}

interface DeleteMut {
  name: string;
  match: string; // name of Match/SubMatch
  op: 'delete';
}

type ValueMut = DataFieldValueMut | RefFieldValueMut | FlexFieldValueMut | RoleFieldValueMut | NullValueMut | EmptyValueMut;

// --- Null (delete field) ---
// Setting a field to null removes it from the record.
// Applies to any field type.

interface NullValueMut {
  type: 'null';
  path: string;
}

// --- Empty (clear MANY field) ---
// Setting a MANY-cardinality role/ref/flex field to null clears it by
// setting it to an empty array (not NONE). This is distinct from NullValueMut
// which removes the field entirely (used for ONE-cardinality and data fields).

interface EmptyValueMut {
  type: 'empty';
  path: string;
}

// --- Data fields ---

type DataFieldValueMut = OneDataFieldValueMut | ManyDataFieldValueMut;

interface OneDataFieldValueMut {
  type: 'data_field';
  cardinality: 'ONE';
  path: string;      // DB field path (the field name, escaped for SurQL in buildSurql)
  value: unknown;    // never null — null is represented by NullValueMut
}

interface ManyDataFieldValueMut {
  type: 'data_field';
  cardinality: 'MANY';
  path: string;
  value: unknown[];
}

// --- Ref fields ---

type RefFieldValueMut = OneRefFieldValueMut | ManyRefFieldValueMut;

interface OneRefFieldValueMut {
  type: 'ref_field';
  cardinality: 'ONE';
  path: string;
  value: string; // "Thing:id"
}

interface ManyRefFieldValueMut {
  type: 'ref_field';
  cardinality: 'MANY';
  path: string;
  value: string[]; // ["Thing:id", ...]
}

// --- Flex fields ---

type FlexFieldValueMut = OneFlexFieldValueMut | ManyFlexFieldValueMut;

interface OneFlexFieldValueMut {
  type: 'flex_field';
  cardinality: 'ONE';
  path: string;
  value: FlexValue;
}

interface ManyFlexFieldValueMut {
  type: 'flex_field';
  cardinality: 'MANY';
  path: string;
  value: FlexValue[];
}

// FlexValue is JSON-compatible: any JSON value, with record references
// represented as RecordId instances from the 'surrealdb' package.
// import { RecordId } from 'surrealdb';
type FlexValue = string | number | boolean | null | Date | RecordId | FlexValue[] | { [key: string]: FlexValue };

// --- Role fields ---

type RoleFieldValueMut = OneRoleFieldValueMut | ManyRoleFieldValueMut;

interface OneRoleFieldValueMut {
  type: 'role_field';
  cardinality: 'ONE';
  path: string;
  ref: Ref;
}

// Two variants for MANY: replace or patch
type ManyRoleFieldValueMut = ManyRoleFieldReplaceValueMut | ManyRoleFieldPatchValueMut;

interface ManyRoleFieldReplaceValueMut {
  type: 'role_field';
  cardinality: 'MANY';
  op: 'replace';
  path: string;
  refs: Ref[];
}

interface ManyRoleFieldPatchValueMut {
  type: 'role_field';
  cardinality: 'MANY';
  op: 'patch';
  path: string;
  links: Ref[];
  unlinks: Ref[];
}

interface Ref {
  thing: string;
  id: string;
}
```

**Filter type**: Reuse the same `Filter` type from the query adapter (`src/stateMachine/query/surql2/logical.ts`). Extract the shared filter types into a common location or import directly.

---

## Phase 2: Parse `DRAFT_BQLMutation` → `BQLMutation`

**File: `parse.ts`**

The input (`ctx.bql.raw`) is `unknown` and untrusted. Validate and normalize it with `DRAFT_BQLMutationParser` (Zod) and `DRAFT_EnrichedBormSchema` for schema lookups:
1. Validate with `DRAFT_BQLMutationParser`
2. Normalize `$entity`/`$relation` → `$thing`
3. Validate `$thing` exists in schema (look up in `DRAFT_EnrichedBormSchema`)
4. Return typed `BQLMutation` (with `$op` still optional — inference happens in Phase 3)

Handles both single mutation and array of mutations (batch).

---

## Phase 3: Infer Operation

**File: `inferOp.ts`**

After parsing, traverse the entire mutation tree (all nodes, including nested role/link/ref field children) and set `$op` on every node that doesn't already have one. This runs once, before defaults and hooks, so all downstream phases can rely on `$op` always being set.

### Inference Rules

1. **Has `$id` or `$filter`, and has non-`$` fields** → `update`
2. **Has `$id`, and has NO non-`$` fields** → `link`
3. **Has `$tempId` and has non-`$` fields** → `create`
4. **Has `$tempId` and has NO non-`$` fields** → `link`
5. **None of the above** → `create`

Note: A root or nested block with only `$filter` and no `$id`, no `$tempId`, and no non-`$` fields is **ignored** — it is silently removed from the mutation tree (no create, no link, no match). If the user intends to match existing records by filter, they must provide an explicit `$op` (e.g., `$op: 'update'`, `$op: 'delete'`, `$op: 'link'`).

### Constraint Validation (throw errors if violated)

- `create`: must NOT have `$id` or `$filter`
- `create`: must NOT contain nested `update`, `delete`, or `unlink` operations — only `create` and `link` are allowed in nested fields
- `delete`: must NOT have non-`$` data fields
- `link` / `unlink`: must NOT have non-`$` data fields

These rules apply uniformly to all cardinalities including ONE-cardinality fields. For example, `{ id: 'purple' }` in a ONE-cardinality nested field (no `$id`, has `id` data field) falls to rule 5 → `create`. If a user intends `update` on a ONE-cardinality nested field, they must provide explicit `$op: 'update'`.

---

## Phase 4: Apply Defaults

**File: `defaults.ts`**

After parsing and before hooks, apply default values and convert string dates. This ensures transforms receive defaults in `currentNode`.

### 4.1 Default Value Application

For each mutation node where `$op === 'create'` (already set by Phase 3):

1. Iterate every `DRAFT_EnrichedBormDataField` in the thing's schema.
2. Skip if the field already has an explicit value in the node.
3. Skip if the field is virtual (`isVirtual === true`).
4. Skip if the field has no `default`.
5. If `default.type === 'value'`: use the static value (skip if `null`).
6. If `default.type === 'fn'`: call `fn(currentNode)` where `currentNode` is the user-provided key-value pairs. Skip if the function returns `null`.
7. Set the resolved default directly on the node object.

Default values are **only applied on `create`**, not on `update`.

### 4.2 String Date Conversion

Before hooks run, convert any string values that represent ISO 8601 dates into SurrealDB `Date` objects for data fields with `contentType: 'DATE'` or `contentType: 'DATETIME'`. This replaces the normalization that `stringify` would otherwise perform.

---

## Phase 5: Apply Hooks

**File: `hooks.ts`**

After defaults are applied and before building the logical mutation, apply schema-defined hooks (transforms and validates). No pre-query is performed — transforms receive the parsed mutation fields including computed default values.

**Note on `$fields`:** The `$fields` directive (used in the legacy adapter to request a pre-query for hook context) is **not supported** in this adapter. Tests that rely on `$fields`-based pre-queries are already marked `TODO{S}` and will be skipped.

### 5.1 Hook Types

Hooks are defined on entities/relations in `DRAFT_EnrichedBormSchema` as `DRAFT_Hooks` (defined in `src/types/schema/enriched.draft.ts`, see §0.4). The relevant types are `DRAFT_PreHook`, `DRAFT_TransformAction`, and `DRAFT_ValidateAction`.

Note: The `dbNode` parameter (4th argument) from the legacy hook signature is dropped — no pre-query is performed.

### 5.2 Operation Available Before Hooks

`$op` is already set on every node by Phase 3 (`inferOp`). No inference is needed here — hooks can read `node.$op` directly.

### 5.3 Hook Retrieval

For each mutation node, determine which hooks to trigger:
1. Look up the thing's hooks from `DRAFT_EnrichedBormSchema` (via `schema[node.$thing].hooks`)
2. Convert the node's `$op` to a trigger name: `'create'` → `'onCreate'`, `'update'` → `'onUpdate'`, etc.
3. Filter hooks: a hook applies if it has no `triggers` defined (applies to all ops), or if `triggers[currentEvent]?.()` returns `true`
4. Flatten all matching hooks' `actions` arrays

### 5.4 Transform Hook Execution

For each mutation node, execute transform actions. The `currentNode` passed to the transform function contains all explicitly provided fields plus any default values computed in Phase 4.

```typescript
function applyTransforms(
  node: BQLMutation,
  parentNode: BQLMutation | null,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): void {
  const actions = getTriggeredActions(node, schema)
    .filter(a => a.type === 'transform');

  const currentNode = { ...node }; // fields already include defaults from Phase 4
  for (const action of actions) {
    const newProps = action.fn(currentNode, parentNode ?? {}, config.mutation?.context ?? {});
    if (Object.keys(newProps).length > 0) {
      Object.assign(currentNode, newProps);
      Object.assign(node, newProps);
    }
  }
}
```

Key rules:
- Transforms execute sequentially; each sees the result of the previous one
- A transform returns a partial object merged into the node (e.g., can add new nested mutations)
- Nodes are processed in depth-first order (children before parent is fine; order within siblings follows input order)

### 5.5 Validate Hook Execution

After all transforms complete, execute validate actions. The `currentNode` contains the same fields (including defaults) as during transform:

```typescript
function applyValidations(
  node: BQLMutation,
  parentNode: BQLMutation | null,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): void {
  const actions = getTriggeredActions(node, schema)
    .filter(a => a.type === 'validate' && a.severity === 'error');

  const currentNode = { ...node };
  for (const action of actions) {
    const result = action.fn(currentNode, parentNode ?? {}, config.mutation?.context ?? {});
    if (result === false) {
      throw new Error(`[Validations:thing:${node.$thing}] ${action.message}.`);
    }
    if (result !== true) {
      throw new Error(`[Validations:thing:${node.$thing}] Validation function's output is not a boolean value.`);
    }
  }
}
```

Key rules:
- Only `severity: 'error'` validations are enforced (warning/info are ignored)
- Validation failure throws immediately
- Hook functions can also throw custom errors internally

### 5.6 Execution Flow

For each mutation node (traversed depth-first):
1. Run transform actions (defaults already present from Phase 4)
2. Run validate actions

---

## Phase 6: Build `LogicalMutation`

**File: `buildLogical.ts`**

Convert parsed and hook-processed `BQLMutation` (or `BQLMutation[]` for batches) into a `LogicalMutation`. All schema lookups (field types, cardinalities, role definitions, etc.) use `DRAFT_EnrichedBormSchema`.

### 6.1 Operation

By the time `buildLogical` runs, `$op` is already set on every node (from Phase 3). No inference is needed here — read `node.$op` directly to determine how to handle each node.

### 6.2 Match Building

For `update` and `delete` operations on existing records:
- Create a `Match` for root-level things:
  - With `$id` (string or string[]): `source` = `RecordPointer` (thing includes subtypes from schema). A single `$id: ['a', 'b']` produces one Match with two ids, not two Matches.
  - With `$filter` only: `source` = `TableScan` (thing includes subtypes)
  - With both: `source` = `RecordPointer`, `filter` = the `$filter`
- Create `SubMatch` for nested things that are being updated/deleted via parent traversal
  - `ids` populated from nested `$id` (converted to array)
  - `filter` populated from nested `$filter`
- `create` operations produce a `CreateMut`, not a Match (the thing is being created, not looked up). Only the `$thing` specified in the mutation is used — subtypes are not included for creates.

Name generation: prefix each name with the normalized table name, then a counter per prefix. Normalize the table name by keeping the original casing, replacing spaces and dashes with underscores, and removing all remaining non-alphanumeric/non-underscore characters. For things with subtypes, use the parent type's normalized name as the prefix (multiple tables may share the same prefix). It's acceptable if different things produce the same normalized prefix — they share a single counter, so there are no name conflicts.

Examples: `User` → `User_0`, `User_1`; `Space-User` → `Space_User_0`; `UserTag` → `UserTag_0`.

The prefix applies to all name types (Match, SubMatch, CreateMut, UpdateMut, DeleteMut) for the same thing. No separate `m`/`sm`/`c`/`u`/`d` global counters — just `<prefix>_<n>` per prefix.

### 6.3 Create Building

For `create` operations:
- **ID field resolution**: The id field name is determined from the schema's `idFields` array on the thing definition. Use only the first entry (`thing.idFields[0]`). If `idFields` contains more than one field (composite ID), **throw an error**: `"Composite id fields are not supported for '<thingName>'"`. (Composite ID support is not yet implemented — this guard will be replaced with proper handling in a future update.)
- **ID value resolution**: `CreateMut.id` is determined in this order:
  1. Use `$id` if explicitly provided
  2. Use the id field value if the user provided the id field by name (e.g., `{ $entity: 'User', ID: 'u1', ... }` where `ID` is the id field name from the schema)
  3. Use the id field's `DRAFT_EnrichedBormDataField.default` if defined (call the default function or use the static value) — note this will already be set on the node from Phase 4
  4. Fallback: generate a random 16-character alphanumeric ID
  - The id field must **never** appear in `CreateMut.values` — it belongs exclusively in `CreateMut.id`. This invariant must hold regardless of how the id was resolved (from `$id`, from the named field, from a default, or from the fallback generator).
- When iterating node fields to build `CreateMut.values`, always skip the id field name (determined from `thing.idFields[0]`). This applies even if Phase 4 (defaults) wrote it onto the node as a regular data field value — the id field is consumed into `CreateMut.id` and never propagated to `CreateMut.values`.
- Build `CreateMut` with all field values resolved (excluding the id field)
- Handle `$tempId` by storing the temp ID on the `CreateMut` for later reference
- Resolve `$tempId` references in link/role fields to the corresponding `CreateMut` name

### 6.4 ID Field Guard

Record IDs cannot be updated or deleted by field name. The id field name is determined from the schema (`thing.idFields[0]`) — it could be `id`, `ID`, `__id__`, etc. If the id field (not `$id`) is provided in an `update` or `delete` mutation, **throw an error**: `"Cannot mutate id field '<idFieldName>' on '<thingName>'. Use '$id' to identify the record instead."`.

Example (assuming the schema defines `idFields: ['ID']`):
```typescript
{ $entity: 'User', $id: 'u1', $op: 'update', ID: 'xyz', name: 'New Name' }
// Error: Cannot mutate id field 'ID' on 'User'. Use '$id' to identify the record instead.
```

### 6.5 Field Guards

Before processing any field value, perform the following checks:

**Unknown field guard**: If a field name (non-`$`-prefixed) does not exist in the thing's schema (not a data field, role field, link field, or ref field), **throw an error**: `"Unknown field '<fieldName>' on '<thingName>'"`.

**Virtual data field guard**: If `DRAFT_EnrichedBormDataField.isVirtual === true`, the field is computed by the DB (e.g., a SurrealDB DEFINE FIELD ... VALUE expression). Attempting to set it **throws an error**: `"Cannot mutate virtual field '<fieldName>' on '<thingName>'"`.

**Virtual link field guard**: If `DRAFT_EnrichedBormLinkField.isVirtual === true`, same error.

**Constant field guard**: If the field type is `constant` (`DRAFT_EnrichedBormConstantField`), **throw an error**: `"Cannot mutate constant field '<fieldName>' on '<thingName>'"`.

**Computed field guard**: If the field type is `computed` (`DRAFT_EnrichedBormComputedField`), the field is computed by the BORM engine (e.g., concatenating first + last name). Attempting to set it **throws an error**: `"Cannot mutate computed field '<fieldName>' on '<thingName>'"`.

These checks apply to all mutation operations (`create`, `update`).

### 6.6 Value Building

For each field in the mutation:
- Look up field schema to determine type (data/ref/flex/role/link)
- **Null values**: If the value is `null`:
  - For data fields (any cardinality) and ONE-cardinality role/ref/flex fields: emit a `NullValueMut` — this removes the field from the record (`NONE` in SurQL).
  - For MANY-cardinality role/ref/flex fields: emit an `EmptyValueMut` — this sets the field to an empty array (`[]` in SurQL), effectively unlinking all references while preserving the field.

- **Data fields**: Map value to `DataFieldValueMut` with correct cardinality. Empty string `''` is a valid value (distinct from `null`). JSON content-type fields accept objects/arrays as values. The `path` in `DataFieldValueMut` is the field name (same as the user-facing name).

- **Ref fields** (contentType: `REF`): Parse references from multiple formats:
  - Object `{ $thing, $id }` or `{ $thing, $op: 'link', $id }` → record reference
  - Object `{ $thing, $op: 'create', id, ... }` → triggers nested create, resolves to reference
  - String `'Type:id'` prefix format → `{ thing: 'Type', id: 'id' }` (strict: error if string doesn't match pattern)
  - String `'_:tempId'` → tempId reference
  - String `'Type:_:tempId'` → tempId reference with type hint
  - `null` → removes all references

- **Flex fields** (contentType: `FLEX`): Flex fields support only **link** operations for references — no `create`, `update`, `delete`, or `unlink`. Determine if each value is a plain value or a ref:
  - String matching `Type:id` pattern → `RecordId` (implicit link; only if: exactly one colon, no spaces, both parts non-empty, and `Type` exists in schema). Construct via `new RecordId(table, id)` from the `surrealdb` package.
  - String NOT matching pattern → stored as-is (plain string)
  - Object with **only** `$thing` and `$id` keys (e.g., `{ $thing: 'User', $id: 'u1' }`) → `RecordId` (explicit link)
  - Object with **only** `$thing`, `$op: 'link'`, and `$id` keys → `RecordId` (explicit link)
  - Object with **only** `$ref` key (e.g., `{ $ref: 'Type:id' }`) → `RecordId`
  - Objects with extra properties beyond the above patterns → stored as-is (plain object), even if they contain `$thing`/`$id`/`$ref` (e.g., `{ $thing: 'User', $id: 'u1', name: 'foo' }` is a plain object)
  - Primitives (number, boolean, Date) → stored as-is
  - Objects with `$op: 'create'`, `$op: 'update'`, `$op: 'delete'`, or `$op: 'unlink'` → **throw error**: `"Flex fields do not support '$op: <op>' operations. Use link operations instead."`

- **Role fields** (on relations): Determine replace vs patch based on `$op` of children:
  - Plain string or string array (e.g., `users: ['u1', 'u2']`) → `replace` with those refs
  - All children are creates/links with no existing entries → `replace`
  - Mix of `link`/`unlink` → `patch`
  - `{ $op: 'link', $id: 'x' }` or `{ $op: 'link', $id: ['x', 'y'] }` → `patch` with links
  - `{ $op: 'unlink', $id: 'x' }` or `{ $op: 'unlink', $id: ['x', 'y'] }` → `patch` with unlinks
  - `{ $op: 'unlink' }` (no $id) → `replace` with empty refs (unlink all)
  - `{ $op: 'update', ...fields }` → creates SubMatch + UpdateMut (see §6.6a)
  - `{ $op: 'delete' }` → creates SubMatch + DeleteMut (see §6.6a)
  - `{ $op: 'delete', $id: 'x' }` → creates SubMatch (with ids) + DeleteMut
  - `[{ $op: 'delete' }, { $op: 'create', id: 'new' }]` → delete then create (replace via operations)

- **Link fields** (entity → relation traversal): See §6.6b for full details.

#### 6.6a Nested `update`/`delete` in Role/Link Fields

When a child in a role or link field has `$op: 'update'` or `$op: 'delete'`, it does NOT modify the parent's role field value. Instead, it creates its own SubMatch + UpdateMut/DeleteMut to act on the child records directly.

```typescript
// Input:
{
  $thing: 'UserTag',
  $op: 'update',
  $id: 'ut1',
  users: [{ $op: 'update', name: 'NewName' }]
}

// Logical result:
// - Match UserTag_0 for UserTag:ut1
// - SubMatch User_0: parent='UserTag_0', path='users' (all users of this tag)
// - UpdateMut User_1: match='User_0', values={name: 'NewName'}
// - NO UpdateMut for UserTag_0 itself (no fields changed on the parent)
```

The parent only gets an UpdateMut if it has its own field changes (data fields, role field link/unlink/replace). If the parent only has nested `update`/`delete` children, the parent still needs a Match (or SubMatch) but no UpdateMut.

#### 6.6b Link Field → Role Field Conversion

Link fields cannot be stored directly in SurrealDB — they are computed fields that traverse through relations. All link field mutations must be converted to operations on the underlying relation and its role fields.

**Schema context**: A link field (`DRAFT_EnrichedBormLinkField`) has:
- `relation`: the intermediary relation name (e.g., `'Space-User'`, `'UserTag'`)
- `plays`: the role this entity plays in the relation (e.g., `'users'`)
- `target`: either `'role'` or `'relation'`
- `targetRole`: (only when `target === 'role'`) the target role name on the relation (e.g., `'spaces'`)
- `targetRoleCardinality`: (only when `target === 'role'`) cardinality of the target role
- `opposite.thing`: the thing type on the other side of the link
- `opposite.path`: the field path from the opposite thing back to this entity

**Two variants:**

**Variant 1: `target === 'relation'`** — The link field points at instances of the relation itself. The linked entities ARE the relation records.

Example: `User.user-tags` with `relation='UserTag'`, `plays='users'`, `target='relation'`.

```
User ──[UserTag relation]──
     └── plays: 'users'
         UserTag instances are the targets
```

Operations map directly to the relation:
- **Create child**: `{ name: 'myTag' }` → Create a new `UserTag` record, set its `users` role to include the parent entity
- **Link**: `{ $op: 'link', $id: 'tag1' }` → Update existing `UserTag:tag1`, add parent entity to its `users` role
- **Unlink**: `{ $op: 'unlink', $id: 'tag1' }` → Update `UserTag:tag1`, remove parent entity from its `users` role
- **Unlink all**: `{ $op: 'unlink' }` or `null` → Remove parent entity from the `users` role of all related UserTag records (see §6.6c for SurQL pattern)
- **Update**: `{ $op: 'update', name: 'changed' }` → SubMatch on relation through parent's computed field, then UpdateMut on matching records
- **Delete**: `{ $op: 'delete' }` → SubMatch on relation through parent's computed field, then DeleteMut
- **Replace** (plain strings): `['tag1', 'tag2']` → Replace: unlink all existing, then link tag1 and tag2

When creating a new child for `target === 'relation'`, the new relation record is created with:
- The `plays` role set to the parent entity (e.g., `users: [parentId]`)
- All user-provided fields set on the relation

**Variant 2: `target === 'role'`** — The link field points through an intermediary relation to entities playing a specific role.

Example: `User.spaces` with `relation='Space-User'`, `plays='users'`, `target='role'`, `targetRole='spaces'`.

```
User ──[Space-User relation]──> Space
     └── plays: 'users'         └── role: 'spaces'
```

Operations require creating/managing intermediary relation records:
- **Create child**: `{ id: 'sp1', name: 'My Space' }` → (1) Create `Space:sp1`, (2) Create a new `Space-User` intermediary record with `users: [parentId]` and `spaces: ['sp1']`
- **Link**: `{ $op: 'link', $id: 'sp1' }` → Create a new `Space-User` intermediary with `users: [parentId]` and `spaces: ['sp1']`
- **Batch link**: `{ $op: 'link', $id: ['sp1', 'sp2'] }` → Create one `Space-User` intermediary per target ID
- **Unlink specific**: `{ $op: 'unlink', $id: 'sp1' }` → Find `Space-User` records where `users` contains parent AND `spaces` contains `sp1`, remove parent from their `users` role (or delete the intermediary if it becomes empty). See §6.6c for the traversal strategy.
- **Unlink all**: `null` or `{ $op: 'unlink' }` → Remove parent from `users` role of all related `Space-User` records. See §6.6c for the SurQL pattern.
- **Update**: `{ $op: 'update', name: 'changed' }` → SubMatch target entities (Spaces) through the link path, then UpdateMut
- **Delete**: `{ $op: 'delete' }` → SubMatch target entities through the link path, then DeleteMut
- **Replace**: `['sp1', 'sp2']` → Unlink all existing, then create new `Space-User` intermediaries for each target

Intermediary relation ID generation: auto-generate a random ID for each new intermediary record (same scheme as §6.3: 16-character alphanumeric).

**ONE cardinality constraint on roles**: When the role being linked has `cardinality: 'ONE'`, the intermediary creation must ensure uniqueness. For example, if `Account.user` has `cardinality: ONE` and `target: 'role'`, linking a new user must first unlink any existing user from that role in the intermediary relation. This is handled by emitting a `replace` operation on the ONE-cardinality role field (not a `patch`), which overwrites the existing value.

#### 6.6c Intermediary Traversal for Unlink Operations

For unlink operations on link fields that require finding intermediary records, use the following traversal strategy:

**Strategy 1 — Use a sibling link field (preferred)**: If the entity has another link field that plays the same role in the same `relation` and has `target === 'relation'`, then a corresponding COMPUTED field exists in the SurrealDB schema. Use that COMPUTED field's path to traverse to the intermediary records directly. This is faster because it leverages SurrealDB's pre-computed field traversal.

**Strategy 2 — Filter the intermediary table (fallback)**: If no sibling link field with `target === 'relation'` exists for the same role/relation combination, fall back to querying the intermediary relation table directly using a role filter. This is slower because it performs a table scan with a filter instead of a COMPUTED field traversal:

```surql
-- Find all Space-User intermediaries linked to the parent user
LET $intermediaries = SELECT VALUE id FROM ⟨Space-User⟩ WHERE users CONTAINSANY [$parent_id];
```

For unlink-specific (also filter by target):
```surql
LET $intermediaries = SELECT VALUE id FROM ⟨Space-User⟩
  WHERE users CONTAINSANY [$parent_id]
  AND spaces CONTAINSANY [type::record($p1, $p2)];
```

Then operate on the intermediary records:
```surql
-- Remove parent from users role (or delete if relation becomes empty)
UPDATE $intermediaries SET users -= [$parent_id];
```

For `target === 'relation'` unlink-all (e.g., remove user from all UserTag records):
```surql
LET $related = SELECT VALUE id FROM UserTag WHERE users CONTAINSANY [$parent_id];
UPDATE $related SET users -= [$parent_id];
```

#### 6.6d `$thing` Inference for Nested Blocks

When a nested mutation block doesn't specify `$thing` (common case), infer it from the parent field's schema:
- **Role fields**: `$thing` is `roleField.opposite.thing` (the thing type that plays the opposite role). Also include things that extend it (subtypes) when building matches for update/delete.
- **Link fields with `target === 'role'`**: `$thing` is the thing that plays the target role (`targetRole`). Look up the relation in the schema, find the `targetRole`'s `opposite.thing`.
- **Link fields with `target === 'relation'`**: `$thing` is the relation itself (`linkField.relation`).
- **Ref fields**: `$thing` comes from the ref value's `$thing` property or from parsing the `Type:id` prefix string.

#### 6.6e SubMatch Path Resolution

The `SubMatch.path` field stores the DB field path used to traverse from parent to child in SurrealDB:

- **Role fields**: Use the role field name directly (e.g., `users`, `tags`). In `buildSurql`, escape with `sanitizeNameSurrealDB()` (wraps in angle brackets `⟨⟩` if the name contains special characters).
- **Link fields**: Use the computed field path in SurrealDB, which replaces spaces and dashes with underscores via `computedFieldNameSurrealDB()` (e.g., `user-tags` → `user_tags`). This matches how link fields are stored as COMPUTED fields in the SurrealDB schema.
- **Array traversal**: When the field has `cardinality: 'MANY'`, the SurQL path includes `[*]` for array traversal (e.g., `$user_0.users[*]`). When `cardinality: 'ONE'`, no `[*]` is needed. The `[*]` is appended in `buildSurql`, not stored in `SubMatch.path`.

### 6.7 Nested Mutation Handling

Nested mutations create a tree of matches and mutations:

```typescript
// Input:
{
  $entity: 'User',
  $id: 'u1',
  spaces: [{
    $id: 'sp1',
    dataFields: [{ $op: 'update', type: 'changed', $filter: { type: 'old' } }]
  }]
}

// LogicalMutation:
{
  matches: [
    { name: 'User_0', source: { type: 'record_pointer', thing: ['User'], ids: ['u1'] } }
  ],
  subMatches: [
    { name: 'Space_0', parent: 'User_0', path: 'spaces', ids: ['sp1'] },
    { name: 'DataField_0', parent: 'Space_0', path: 'dataFields', filter: { type: 'old' } }
  ],
  creates: [],
  updates: [
    { name: 'DataField_1', match: 'DataField_0', op: 'update', values: { type: { type: 'data_field', cardinality: 'ONE', path: 'type', value: 'changed' } } }
  ],
  deletes: []
}
```

### 6.8 Batch / TempId Resolution

For batched mutations (array input):
1. **First pass** (collection only, no state mutation): Recursively traverse the entire mutation tree (depth-first, including all nested role/link/ref field values) to collect all `$tempId` declarations. For each declared `$tempId`, record the record ID that will be used for that create — either the explicitly provided id field value, or the default value computed in Phase 4, or **generate the random fallback ID now** (in the first pass) and cache it in the `$tempId` map. The same generated ID is then used during the second pass and when building `CreateMut` nodes. Map `$tempId` → `{ thing, id }`. Nested `$tempId` declarations (e.g., on a deeply nested child) are included.
2. **Second pass**: Resolve `$tempId` references in role/ref field values throughout the tree, replacing each `_:tempId` reference with the concrete `{ thing, id }` from the first-pass map.
3. **Validate**: All referenced `$tempId` values must have matching creates. Missing declarations throw an error.
4. **Data field tempId guard**: If a `$tempId` string appears as the value of a data field (not a role/ref field), **throw an error**: `"$tempId references are not allowed in data fields."`. TempId references are only valid in role, ref, and link field values.

### 6.9 Value Validation

After building all field values (including defaults applied in Phase 4) for `create` and `update` operations, validate each data field value against its `DRAFT_Validations`.

For each data field value in a `CreateMut` or `UpdateMut`:
1. **`required`**: On `create`, if `validations.required === true` and the field has no value (and no default was applied), throw: `"[Validations] Required field '<fieldName>' is missing."`.
2. **`enum`**: If `validations.enum` is set, check that the value is in the allowed list. For `MANY` cardinality, check each element. Allow `null` values (null bypasses enum check). Throw: `"[Validations] Option '<value>' is not a valid option for field '<fieldName>'."`.
3. **`fn`**: If `validations.fn` is set, call `fn(value)`. If it returns `false`, throw: `"[Validations:attribute:<fieldName>] Failed validation function."`. For `MANY` cardinality, validate each element.

Validation order: `required` → `enum` → `fn`. Stop at the first failure.

### 6.10 Dependency Ordering

After building all mutations, order them so that referenced records exist before they are referenced. This applies across creates and updates:

- **Build a dependency graph**: For each `CreateMut` and `UpdateMut`, collect the records it references via role/ref fields. An edge `A → B` means "A references B, so B must be created/available before A".
- **Topological sort**: Order mutations so that dependencies come first.

Example:
```
Input order:
  - Update A: role field A.x references B
  - Create B: role field B.y references A

Reordered:
  - Create B: role field B.y references A  (A already exists, being updated)
  - Update A: role field A.x references B  (B now exists)
```

Updates to existing records don't need to be "created first" — they already exist. So updates referencing existing records have no ordering constraint on those records. The ordering matters primarily when a mutation references a record being created in the same batch.

### 6.11 Circular Dependency Resolution

When two `CreateMut` operations reference each other, a simple topological sort is impossible. Break the cycle by deferring one side of the reference:

1. **Detect cycles** in the dependency graph among `CreateMut` nodes.
2. **Pick an edge to break**: Choose the role/ref field with the fewest references (heuristic to minimize the deferred update).
3. **Split the create**: Remove the cyclic field from the `CreateMut` and emit a new `UpdateMut` that sets it after both creates are done.

Example:
```
Input:
  - Create A: role field A.x references B
  - Create B: role field B.y references A

Resolved:
  - Create A            (without A.x)
  - Create B: B.y references A  (A now exists)
  - Update A: set A.x to B     (B now exists)
```

The generated `UpdateMut` uses a match that points to the `CreateMut`'s output (e.g., `match: 'User_0'` where `User_0` is the name of the `CreateMut` for A). This allows `buildSurql` to reference the created record via `$User_0.id`.

---

## Phase 7: Optimize `LogicalMutation`

**File: `optimize.ts`**

### 7.1 Filter Optimization

Apply the same filter optimizations as the query adapter:
- Empty list collapse: `status IN []` → falsy
- Single-item list reduction: `IN [x]` → `= x`
- Flatten nested AND/OR
- Double negation elimination
- De Morgan's laws

Apply to all filters in `Match` and `SubMatch`.

### 7.2 Source Optimization (Match)

Apply the same source optimizations as the query adapter's `optimizeSource()`:
- **ID filter → RecordPointer**: If `Match.source` is a `TableScan` and the filter contains an id equality/IN filter, convert the source to a `RecordPointer` and remove the id filter
- **Ref filter → SubQuery**: If the filter contains a `biref`/`computed_biref` filter, convert the source to a `SubQuery` (relationship traversal) — prioritize computed_biref ONE > computed_biref MANY > biref ONE > biref MANY
- **Nested ref filter → SubQuery**: Same for `nested_ref`/`nested_computed_ref` filters
- **Index push-down**: If no source conversion applies, push indexed filters to the front of AND/OR filter lists (composite indexes first, then single indexes)

### 7.3 SubMatch Optimization

- If a `SubMatch.filter` contains the id field (looked up via `thing.idFields[0]`), extract it and merge into `SubMatch.ids`
- If `SubMatch.ids` is already set and the filter also contains the id field, remove the id filter (the explicit ids take precedence)

---

## Phase 8: Build SurQL

**File: `buildSurql.ts`**

Generate SurQL statements from the optimized `LogicalMutation`.

### 8.1 Statement Ordering

All match statements must come first (before any creates, updates, or deletes) so that subsequent mutations can reference them safely. Order:
1. **Matches** (LET statements for existing record lookups) — all of these first
2. **SubMatches** (LET statements dependent on parent matches) — after their parent match
3. **Creates and Updates** — emitted in the dependency order established by Phase 6.10/6.11. Creates come before the updates that reference them; cycle-breaking updates (from 6.11) come after all creates they depend on.
4. **Deletes** (DELETE statements, reverse order to handle children first)

### 8.2 Match → SurQL

Use `SELECT VALUE id FROM` to return only record IDs, not full records. This is efficient and sufficient since mutations operate on record IDs.

For things with subtypes, expand the query to cover all tables. Since SurrealDB stores each subtype in its own table, `SELECT VALUE id FROM User` will not return `AdminUser` records. Use a comma-separated table list in the `SELECT`:

```surql
-- Match with TableScan source (single table)
LET $User_0 = SELECT VALUE id FROM User WHERE type = $p1;

-- Match with TableScan source (thing with subtypes: User + AdminUser)
LET $User_0 = SELECT VALUE id FROM User, AdminUser WHERE type = $p1;

-- Match with RecordPointer source (single id, single table)
LET $User_0 = [type::record($p1, $p2)];

-- Match with RecordPointer source (single id, thing with subtypes)
LET $User_0 = [type::record($p1, $p2), type::record($p3, $p2)];

-- Match with RecordPointer source (multiple ids)
LET $User_0 = [type::record($p1, $p2), type::record($p3, $p4)];

-- Match with RecordPointer source and additional filter
LET $User_0 = SELECT VALUE id FROM [type::record($p1, $p2)] WHERE status = $p3;

-- Match with SubQuery source (relationship traversal)
LET $User_0 = SELECT VALUE id FROM type::record($p1, $p2).author;
```

### 8.3 SubMatch → SurQL

SubMatch paths use the field name, escaped with `sanitizeNameSurrealDB()` for role fields or `computedFieldNameSurrealDB()` for link fields. MANY cardinality fields append `[*]` for array traversal.

```surql
-- SubMatch from parent match (MANY cardinality role field)
LET $Space_0 = SELECT VALUE id FROM $User_0.⟨spaces⟩[*];

-- SubMatch with ids
LET $Space_0 = SELECT VALUE id FROM $User_0.⟨spaces⟩[*] WHERE record::id(id) IN [$p1, $p2];

-- SubMatch with filter
LET $DataField_0 = SELECT VALUE id FROM $Space_0.dataFields[*] WHERE type = $p2;

-- SubMatch with ids and filter
LET $Space_0 = SELECT VALUE id FROM $User_0.⟨spaces⟩[*] WHERE record::id(id) = $p1 AND status = $p2;

-- SubMatch from parent match (ONE cardinality role field)
LET $Space_0 = SELECT VALUE id FROM $User_0.root;
```

### 8.4 Create → SurQL

Use `INSERT` instead of `CREATE`. `INSERT` automatically fails when the record ID already exists, so no separate existence check is needed.

```surql
-- Create a record (INSERT fails if the ID already exists)
LET $User_0 = INSERT INTO type::table($p1) { id: type::record($p1, $p2), name: $p3, email: $p4 } RETURN AFTER;

-- Create with ref field (all record references parameterized)
LET $UserTag_0 = INSERT INTO type::table($p1) {
  id: type::record($p1, $p2),
  users: [type::record($p3, $p4), type::record($p5, $p6)],
  name: $p7
} RETURN AFTER;

-- Create with tempId reference (resolved to actual create variable)
LET $Account_0 = INSERT INTO type::table($p1) { id: type::record($p1, $p2), provider: $p3 } RETURN AFTER;
LET $User_0 = INSERT INTO type::table($p3) {
  id: type::record($p3, $p4),
  name: $p5,
  accounts: [$Account_0[0].id]
} RETURN AFTER;
```

### 8.5 Update → SurQL

`$User_0` is a list of record IDs (from `SELECT VALUE id FROM ...`). SurrealDB allows `UPDATE <array of record ids> SET ...` directly without a FOR loop. Use `RETURN AFTER` to capture the updated records in a single statement:

```surql
-- Update all records in the match, return updated state
LET $User_0_result = UPDATE $User_0 SET name = $p1, email = $p2 RETURN AFTER;

-- Update with NullValueMut (remove field entirely — data fields, ONE-cardinality role/ref/flex)
LET $User_0_result = UPDATE $User_0 SET email = NONE RETURN AFTER;

-- Update with EmptyValueMut (clear MANY field — set to empty array, not NONE)
LET $User_0_result = UPDATE $User_0 SET users = [] RETURN AFTER;

-- Update with role field MANY (replace, record references parameterized)
LET $User_0_result = UPDATE $User_0 SET users = [type::record($p1, $p2), type::record($p3, $p4)] RETURN AFTER;

-- Update with role field ONE (replace single reference)
LET $User_0_result = UPDATE $User_0 SET root = type::record($p1, $p2) RETURN AFTER;

-- Update with role field ONE (null — remove reference)
LET $User_0_result = UPDATE $User_0 SET root = NONE RETURN AFTER;

-- Update with role field (patch - link)
LET $User_0_result = UPDATE $User_0 SET users += [type::record($p1, $p2)] RETURN AFTER;

-- Update with role field (patch - unlink)
LET $User_0_result = UPDATE $User_0 SET users -= [type::record($p1, $p2)] RETURN AFTER;

-- Update with flex field
LET $User_0_result = UPDATE $User_0 SET flexRef = $p1 RETURN AFTER;

-- Update sub-matched records
LET $DataField_0_result = UPDATE $DataField_0 SET type = $p1 RETURN AFTER;
```

The `_result` LET variable holds the post-update record(s) used by `processResults`.

### 8.6 Delete → SurQL

Use `RETURN BEFORE` to capture the record state before deletion:

```surql
-- Delete all records in the match, return pre-delete state
LET $User_0_result = DELETE $User_0 RETURN BEFORE;

-- Delete sub-matched records
LET $DataField_0_result = DELETE $DataField_0 RETURN BEFORE;
```

The `_result` LET variable holds the pre-delete record(s) used by `processResults`.

### 8.7 Parameter Management

Same approach as query adapter (`src/stateMachine/query/surql2/buildSurql.ts`):
- Use `insertParam()` with `genAlphaId()` for unique parameter keys
- Store all values in a `SurqlParams` object
- Reference params with `$` prefix in SurQL
- **All user-provided values must go through `insertParam()`** — this includes table names and IDs in `type::record()` calls, data field values, filter values, etc. Never interpolate raw values into the SurQL string to avoid injection.

### 8.8 `ignoreNonexistingThings` Enforcement

#### When `ignoreNonexistingThings: false` (default)

Note: existence checking applies **only** to `RecordPointer` sources. A `TableScan` or `SubMatch` that matches zero records is silently treated as a no-op — only single-record or multi-record pointer lookups are asserted.

**RecordPointer (no filter)**: Emit the pointer array directly, then assert all IDs exist. Use a literal count known at query-build time, not a param:
```surql
LET $User_0 = [type::record($p1, $p2), type::record($p3, $p4)];
IF array::len($User_0) != 2 { THROW "Record not found" };
```
The count is a literal (2 in this example) since it is known at query-build time.

**RecordPointer + filter**: Separate into two steps — a pointer match (with existence assertion), then a filter sub-match derived from it:
```surql
-- Step 1: assert the pointer records exist
LET $User_0_ptr = SELECT VALUE id FROM type::record($p1, $p2);
IF array::len($User_0_ptr) != 1 { THROW "Record not found" };
-- Step 2: filter within the confirmed records
LET $User_0 = SELECT VALUE id FROM $User_0_ptr WHERE status = $p3;
```
This ensures the record IDs are valid before applying the filter, so a missing record is an error rather than a silent empty result.

**TableScan (no fixed expected count)**: A `TableScan` that returns zero results is a silent no-op when `ignoreNonexistingThings: false` — no assertion is emitted (the check only applies to RecordPointer sources):
```surql
LET $User_0 = SELECT VALUE id FROM User WHERE type = $p1;
```

**Things with subtypes**: Same — no assertion for TableScan:
```surql
LET $User_0 = SELECT VALUE id FROM User, AdminUser WHERE type = $p1;
```

#### When `ignoreNonexistingThings: true`

RecordPointer and filter can be combined in a single match — no assertions emitted, empty results are silently ignored:
```surql
-- RecordPointer + filter in one step (ignoreNonexistingThings: true)
LET $User_0 = SELECT VALUE id FROM [type::record($p1, $p2)] WHERE status = $p3;
```

### 8.9 Return Values

Each mutation statement uses `RETURN AFTER` (creates, updates) or `RETURN BEFORE` (deletes) to capture results inline. No separate pre/post SELECT statements are needed:

```surql
-- Create: RETURN AFTER gives the created record
LET $User_0 = INSERT INTO type::table($p1) { id: type::record($p1, $p2), name: $p3 } RETURN AFTER;

-- Update: RETURN AFTER gives the post-update state
LET $User_0_result = UPDATE $User_0 SET name = $p1 RETURN AFTER;

-- SubMatch update
LET $DataField_0_result = UPDATE $DataField_0 SET type = $p2 RETURN AFTER;

-- Delete: RETURN BEFORE gives the pre-delete state
LET $User_0_result = DELETE $User_0 RETURN BEFORE;
```

The `_result` suffix LET variables (and the create variable itself) are the result values consumed by `processResults`. The exact structure returned by `tx.query()` will be verified against SurrealDB v3 during implementation.

### 8.10 Unlink-All Traversal Patterns

For link field unlink-all operations that require traversing intermediary relations, the following SurQL patterns are used (generated in `buildSurql` when the logical mutation includes an unlink-all step):

**`target === 'relation'` unlink-all** (e.g., remove parent user from all UserTag records):
```surql
LET $related = SELECT VALUE id FROM UserTag WHERE users CONTAINSANY [$parent_id];
UPDATE $related SET users -= [$parent_id];
```

**`target === 'role'` unlink-all** (e.g., remove parent user from all Space-User intermediaries):
```surql
LET $intermediaries = SELECT VALUE id FROM ⟨Space-User⟩ WHERE users CONTAINSANY [$parent_id];
UPDATE $intermediaries SET users -= [$parent_id];
```

**`target === 'role'` unlink-specific** (e.g., remove link between user and a specific space):
```surql
LET $intermediaries = SELECT VALUE id FROM ⟨Space-User⟩
  WHERE users CONTAINSANY [$parent_id]
  AND spaces CONTAINSANY [type::record($p1, $p2)];
UPDATE $intermediaries SET users -= [$parent_id];
```

In all cases, `$parent_id` is the record ID of the parent entity. If a sibling link field with `target === 'relation'` exists for the same relation, use its COMPUTED path to traverse instead of querying the intermediary table directly (Strategy 1 from §6.6c).

---

## Phase 9: Execute SurQL

**File: `query.ts` and `run.ts`**

### 9.1 `query.ts` - Execution Wrapper

Execute the generated SurQL within a transaction:
```typescript
async function executeMutation(
  client: SurrealClient,
  surql: string,
  params: SurqlParams
): Promise<RawMutationResult[]> {
  const tx = await client.beginTransaction();
  try {
    const results = await tx.query(surql, params);
    await tx.commit();
    return results;
  } catch (e) {
    await tx.cancel();
    throw e;
  }
}
```

Note: `client.beginTransaction()` returns a `TransactionHandle` with `.query()`, `.commit()`, and `.cancel()` methods. The query and commit/cancel are called on the transaction handle, not on the client directly.

### 9.2 `run.ts` - Pipeline Orchestration

```typescript
async function runSurrealDbMutationMachine2(
  bql: unknown, // ctx.bql.raw — untrusted, validated by parseBQLMutation
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
  handles: DBHandles,
): Promise<any[]> {
  const client = getClient(handles);

  // 1. Parse (validates and normalizes raw input with Zod)
  const parsed = parseBQLMutation(bql, schema);

  // 2. Infer $op for every node in the tree
  const withOp = inferOp(parsed);

  // 3. Apply defaults (compute defaults for create nodes, convert string dates)
  const withDefaults = applyDefaults(withOp, schema);

  // 4. Apply hooks (transforms + validations; no pre-query)
  const hooked = applyHooks(withDefaults, schema, config);

  // 5. Build logical
  const logical = buildLogicalMutation(hooked, schema);

  // 6. Optimize
  const optimized = optimizeLogicalMutation(logical, schema);

  // 7. Build SurQL (returns statement index → logical operation mapping)
  const params: SurqlParams = {};
  const { surql, stmtMap } = buildSurql(optimized, params, config);

  // 8. Execute
  const rawResults = await executeMutation(client, surql, params);

  // 9. Process results (uses stmtMap to correlate raw results to logical operations)
  return processResults(rawResults, stmtMap, optimized, schema, config);
}
```

---

## Phase 10: Process Results

**File: `processResults.ts`**

Build the mutation result from raw SurrealDB responses.

### 10.1 Result Shape

The mutation result must be a **flat array** of objects, matching the format expected by the existing mutation machine and test assertions. Each object represents one affected record:

```typescript
type MutationResultItem = {
  // Metadata fields (present when noMetadata is false)
  $id: string;                            // record::id(id) — the record's ID
  $thing: string;                         // e.g., 'User', 'UserTag'
  $thingType: 'entity' | 'relation';      // derived from schema
  $op: 'create' | 'update' | 'delete' | 'link' | 'unlink';
  // Auto-generated intermediary relation records (e.g., Space-User created for a link field op)
  // always carry $op: 'create', regardless of the parent's op.
  $tempId?: string;                       // '_:tempName' if declared in input

  // Data fields (always present)
  id: string;                             // same as $id (the id field value)
  [fieldName: string]: any;               // all other data/link/role field values

  // Null markers
  [nulledField: string]: null;            // fields explicitly set to null in input
};
```

**`noMetadata` handling**: When `config.mutation.noMetadata === true`, strip all `$`-prefixed fields from each result object. Only the data fields, `id`, and explicit null values remain.

### 10.2 Result Ordering

Results are ordered as a flat array following the execution order:
1. Root-level creates/updates/deletes (in input order)
2. Nested creates/updates/deletes (depth-first traversal order within each root mutation)
3. Intermediary relation creates (auto-generated for link field operations)

For batch mutations (array input), each input block's results appear in input order. Within each block, nested results follow depth-first order.

For intermediary relation creates generated within the same link field operation, ordering should be consistent (e.g., same order as the input IDs). Verify against test assertions — the tests may be order-sensitive.

### 10.3 Processing

Return what the tests expect. The general approach:

1. Map raw SurrealDB results back to logical mutation operations using a **statement index → logical operation mapping** built during `buildSurql`. Since `tx.query()` returns results in statement order (not keyed by variable name), `buildSurql` must return this mapping alongside the SurQL string and params. Each entry maps a statement index to the logical operation (CreateMut/UpdateMut/DeleteMut) and its LET variable name (`$user_0`, `$user_0_result`, etc.)
2. For creates:
   - Extract the `RETURN AFTER` result from the create LET variable (e.g., `$user_0`)
   - Add metadata: `$id`, `$thing`, `$thingType: schema[thing].type`, `$op: 'create'`, `$tempId` if present
   - Auto-generated intermediary relations use `$op: 'create'`
3. For updates:
   - Extract the `RETURN AFTER` result from the `_result` LET variable (e.g., `$user_0_result`)
   - Add metadata: `$id`, `$thing`, `$thingType`, `$op: 'update'`
4. For deletes:
   - Extract the `RETURN BEFORE` result from the `_result` LET variable (e.g., `$user_0_result`)
   - Add metadata: `$id`, `$thing`, `$thingType`, `$op: 'delete'`
5. Handle date conversion (SurrealDB DateTime → JS Date)
6. Handle record link resolution (SurrealDB record IDs → plain id string, e.g., `User:u1` → `"u1"`)
7. Strip empty arrays (convert `[]` to `undefined` — matching existing behavior)
8. Apply `noMetadata` filter if configured

The exact structure returned by `tx.query()` for a multi-statement transaction will be verified against SurrealDB v3 during implementation of this phase.

---

## Phase 11: Route Mutation to New Adapter

**File: `src/stateMachine/mutation/mutationMachine.ts`**

The current mutation machine runs this pipeline for surrealDB:
```
stringify → enrich → [preQuery] → [preHookDependencies] → parseBQL → flattenBQL → adapter (runSurrealDbMutationMachine)
```

The new adapter (`surql2/run.ts`) handles parsing and hooks internally, so the enrich/parseBQL/flattenBQL steps are unnecessary. Route surrealDB mutations to the new adapter by:

### 11.1 Skip Preprocessing for SurrealDB

Add a guard after `stringify` to skip directly to `adapter` when the provider is `surrealDB`:

```typescript
stringify: invoke(
  async (ctx: MachineContext) => { ... },
  transition('done', 'adapter', guard(isSurrealDB), reduce(updateBqlReq)),
  transition('done', 'enrich', reduce(updateBqlReq)),
  errorTransition,
),
```

Where `isSurrealDB` checks `ctx.config.dbConnectors[0].provider === 'surrealDB'`.

The `stringify` step output is not used by the new adapter. Instead, the new adapter passes `ctx.bql.raw` (the original user input, typed `unknown`) directly to `parseBQLMutation`, which treats it as untrusted input and validates it with `DRAFT_BQLMutationParser` (Zod). String date conversion (ISO 8601 → SurrealDB Date) is handled in Phase 4 (`defaults.ts`) rather than by `stringify`.

### 11.2 Call New Adapter in `adapter` State

In the `adapter` state, replace the surrealDB branch:

```typescript
if (provider === 'surrealDB') {
  return runSurrealDbMutationMachine2(
    ctx.bql.raw,
    ctx.draftSchema,           // DRAFT_EnrichedBormSchema (includes hooks)
    ctx.config,
    ctx.handles,               // DBHandles for client access
  );
}
```

Import `runSurrealDbMutationMachine2` from `./surql2/run`.

`ctx.draftSchema` is read directly from `MachineContext` — the same field populated by the enrichment step for the query machine. No additional initialization is needed in the mutation machine if the enrichment step already sets it on the shared context.

### 11.3 Result Compatibility

The new adapter returns `any[]` — a flat array assigned to `ctx.bql.res` via `updateBQLRes`. This matches the existing `runSurrealDbMutationMachine` return type. The flat array format is preserved through to the caller.

---

## Implementation Order

0. **`src/types/schema/enriched.draft.ts`** - Schema type changes: generic `DRAFT_EnrichedBormDataField<CT>`, `DRAFT_DataFieldDefault<CT>`, `DRAFT_Validations<CT>` (no adapter dependencies)
1. **`logical.ts`** - Type definitions (no dependencies)
2. **`parse.ts`** - BQL parser (Phase 2; depends on shared filter types)
3. **`inferOp.ts`** - Op inference (Phase 3; depends on 2)
4. **`defaults.ts`** - Default value application and string date conversion (Phase 4; depends on 0, 2, 3, `DRAFT_EnrichedBormSchema`)
5. **`hooks.ts`** - Hook transforms, validations (Phase 5; depends on 2, 3, 4, `DRAFT_EnrichedBormSchema`)
6. **`buildLogical.ts`** - Logical mutation builder (Phase 6; depends on 0, 1, 2, 3, 4, 5, `DRAFT_EnrichedBormSchema`). Includes field guards, value validation, link field conversion.
7. **`optimize.ts`** - Optimizer (Phase 7; depends on 1, `DRAFT_EnrichedBormSchema`, can reuse query optimizer logic)
8. **`buildSurql.ts`** - SurQL compiler (Phase 8; depends on 1, config for `ignoreNonexistingThings`)
9. **`query.ts`** - DB execution wrapper (Phase 9; depends on client types)
10. **`processResults.ts`** - Result processor (Phase 10; depends on 1, `DRAFT_EnrichedBormSchema`, config for `noMetadata`)
11. **`run.ts`** - Pipeline orchestrator (Phase 11; depends on all above)

### Shared Code with Query Adapter

Extract or import shared utilities:
- `Filter` types from `logical.ts` (query adapter) → shared location or direct import
- `BQLFilterParser` from `src/types/requests/parser.ts` (already shared)
- `genAlphaId()` and `insertParam()` from query adapter's `buildSurql.ts`
- Filter optimization functions from query adapter's `optimize.ts`
- `sanitizeNameSurrealDB()` and `computedFieldNameSurrealDB()` from `src/adapters/surrealDB/helpers.ts`
- `query()` execution wrapper pattern

---

## Logging

Use `log()` from `src/logger.ts` for debug output. Do **not** use the generic `logDebug`, `logInfo`, etc. helpers in the new mutation adapter.

Each `log()` call takes two tags: the function name and a more specific sub-tag. This allows fine-grained filtering via the `BORM_LOG_TAGS` environment variable.

```typescript
import { log } from '../../../logger';

// In buildSurql:
log(['buildSurql', 'buildSurql/surql'], surql);
log(['buildSurql', 'buildSurql/params'], params);

// In run:
log(['runSurql', 'runSurql/surql'], surql);
log(['runSurql', 'runSurql/rawResults'], rawResults);

// In processResults:
log(['processResults', 'processResults/output'], results);
```

Enable with: `BORM_LOG_TAGS=buildSurql/surql` (specific) or `BORM_LOG_TAGS=buildSurql` (all buildSurql logs) or `BORM_LOG_TAGS=*` (everything).

---

## Testing Strategy

Run existing mutation tests against the new adapter to verify correctness:

```bash
pnpm run test:surrealdb-ignoreTodo
```

The test files are in `tests/unit/mutations/`:
- `basic.ts` - CRUD, link/unlink on entities and relations
- `filtered.ts` - Filter-based updates and deletes
- `refFields.ts` - Ref and flex field mutations
- `edges.ts` - Nested relation mutations
- `batched.ts` - Batch mutations with tempId
- `replaces.ts` - Replace operations on role/link fields
- `jsonRefs.ts` - JSON embedded references
- `preHooks.ts` - Hook transforms, validations, pre-query dependencies
- `errors.ts` - Error conditions and error message assertions

Tests marked with `TODO{S}` or `TODO{TS}` are automatically skipped by this test command.

---

## Appendix A: Mutation Behavior Specification (from tests)

This section documents every mutation behavior identified from the test suite. It serves as the authoritative reference for implementation correctness.

### A.1 Data Field Mutations

**Replace semantics**: Setting a data field value always replaces the existing value entirely.

```typescript
// Create
{ $entity: 'User', id: 'u1', name: 'John', email: 'john@example.com' }

// Update — replaces name, leaves email unchanged
{ $entity: 'User', $id: 'u1', name: 'Jane' }
```

**Null = delete field**: Setting a field to `null` removes it from the record.

```typescript
// Deletes the email field from the record
{ $entity: 'User', $id: 'u1', email: null }
```

**Null in multi-attribute update**: When updating multiple fields, `null` deletes only that specific field; others update normally.

```typescript
// Updates name, deletes email
{ $entity: 'User', $id: 'u1', name: 'Jane', email: null }
```

**Empty string is preserved**: `''` is distinct from `null` — it stores an empty string, not a deletion.

```typescript
// Sets email to empty string (field remains)
{ $entity: 'User', $id: 'u1', email: '' }
```

**JSON fields**: JSON fields (contentType: `JSON`) can be created empty or with structure, and updated to add/modify nested properties.

```typescript
// Create with JSON field
{ $entity: 'Account', id: 'a1', profile: { hobby: ['running'] } }

// Update JSON field (replaces entire JSON object)
{ $entity: 'Account', $id: 'a1', profile: { hobby: ['skiing'], nested: { a: 1 } } }
```

### A.2 Role Field Mutations (on relations)

Role fields connect entities to relations. They support replace and patch semantics.

**Create with role field values**: Inline children in role field create new entities and link them.

```typescript
// Creates UserTag relation with two new users linked
{
  $relation: 'UserTag',
  id: 'ut1',
  users: [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }],
  tags: [{ $id: 'tag1' }]
}
```

**String or string array = replace all references**: Providing plain IDs (strings) replaces the entire role field.

```typescript
// Replaces all users on the relation with user3 and user5
{ $relation: 'UserTag', $id: 'ut1', users: ['user3', 'user5'] }

// Replace single-cardinality role (ONE)
{ $relation: 'ThingRelation', $id: 'tr1', root: 'thing4' }
```

**`$op: 'link'` = add references (patch)**:

```typescript
// Add specific user to the role field
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'link', $id: 'u3' }] }

// Batch link with array of IDs
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'link', $id: ['u3', 'u4', 'u5'] }] }
```

**`$op: 'unlink'` with `$id` = remove specific references (patch)**:

```typescript
// Remove specific user from role field
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'unlink', $id: 'u1' }] }

// Batch unlink
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'unlink', $id: ['u1', 'u2'] }] }
```

**`$op: 'unlink'` without `$id` = unlink all**:

```typescript
// Removes all users from role field
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'unlink' }] }
```

**Mixed link/unlink in same array**:

```typescript
// Add tag-3 while removing tag-1
{
  $relation: 'UserTagGroup', $id: 'utg1',
  tags: [{ $op: 'link', $id: 'tag-3' }, { $op: 'unlink', $id: 'tag-1' }]
}
```

**Unlink all then link = replace via patch**:

```typescript
// Unlink all then link new ones (equivalent to replace)
{
  $relation: 'UserTagGroup', $id: 'utg1',
  tags: [{ $op: 'link', $id: ['tag-4', 'tag-3'] }, { $op: 'unlink' }]
}
```

**`$op: 'update'` on nested role children**: Updates all entities in the role field.

```typescript
// Update all users linked to this relation
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'update', name: 'Updated' }] }
```

**`$op: 'delete'` on nested role children**: Deletes entities in the role field.

```typescript
// Delete all users linked to this relation
{ $relation: 'UserTag', $id: 'ut1', users: [{ $op: 'delete' }] }

// Mix delete and create in same role field array
{
  $relation: 'UserTagGroup', $id: 'utg1',
  tags: [{
    $id: 'tag1',
    users: [{ $op: 'delete' }, { $thing: 'User', id: 'm1-user3' }]
  }]
}
```

**Delete + create = replace for ONE cardinality**:

```typescript
// Replace ONE-cardinality color: delete old, create new
{
  $relation: 'UserTagGroup', $id: 'utg1',
  color: [{ $op: 'delete' }, { $op: 'create', id: 'purple' }]
}
```

### A.3 Link Field Mutations (on entities)

Link fields traverse from entities through intermediary relations. The adapter must create/manage the intermediary relation automatically.

#### A.3.1 Link Field with `target === 'relation'`

When the link field targets the relation itself (e.g., `User.user-tags` → `UserTag`), operations act on the relation records directly.

**Create with nested link field children**: Creates the relation and links the parent.

```typescript
// Creates UserTag relations, each with 'users' role containing 'u1'
{ $entity: 'User', id: 'u1', 'user-tags': [{ id: 'tag1', name: 'Tag 1' }] }
```

**Link existing relation**:
```typescript
// Adds parent user to the 'users' role of existing UserTag
{ $entity: 'User', $id: 'u1', 'user-tags': [{ $op: 'link', $id: 'tag3' }] }
```

**Unlink**: Removes the parent from the relation's role (relation record is preserved).
```typescript
{ $entity: 'User', $id: 'u1', 'user-tags': [{ $op: 'unlink', $id: 'tag1' }] }
```

**Update through link**: Updates the relation records.
```typescript
{ $entity: 'User', $id: 'u1', 'user-tags': [{ $op: 'update', name: 'changed' }] }
```

**Delete through link**: Deletes the relation records.
```typescript
{ $entity: 'User', $id: 'u1', 'user-tags': [{ $op: 'delete' }] }
```

#### A.3.2 Link Field with `target === 'role'`

When the link field targets a role in an intermediary relation (e.g., `User.spaces` → `Space-User` → `Space`), operations create/manage intermediary records.

**Create with nested child**: Creates both the target entity and the intermediary relation.

```typescript
// Creates Space:sp1, then creates Space-User with users=['u1'], spaces=['sp1']
{ $entity: 'User', id: 'u1', spaces: [{ id: 'sp1', name: 'Space 1' }] }
```

**Link existing**: Creates intermediary relation linking parent to target.

```typescript
// Creates Space-User with users=['u1'], spaces=['space-1']
{ $entity: 'User', $id: 'u1', spaces: [{ $op: 'link', $id: 'space-1' }] }

// Batch: creates one Space-User per target
{ $entity: 'User', $id: 'u1', spaces: [{ $op: 'link', $id: ['space-1', 'space-2', 'space-3'] }] }
```

**Unlink**: Removes the connection (removes parent from intermediary's role, or deletes the intermediary if only these two entities were connected).

```typescript
// Unlink specific
{ $entity: 'User', $id: 'u1', spaces: [{ $op: 'unlink', $id: 'sp1' }] }

// Unlink all
{ $entity: 'User', $id: 'u1', spaces: null }
```

**Update through intermediary**: Updates the target entities (not the intermediary).

```typescript
// Updates all Spaces linked to user through Space-User
{ $entity: 'User', $id: 'u1', spaces: [{ $op: 'update', name: 'changed' }] }
```

**Delete through intermediary**: Deletes the target entities (and their intermediary relations).

```typescript
{ $entity: 'User', $id: 'u1', spaces: [{ $op: 'delete' }] }
```

**Nested creation through link field with tempId**:

```typescript
{
  $entity: 'User', $id: 'u1',
  'user-tags': [{
    name: 'a tag',
    $tempId: '_:newTagId',
    group: { color: { id: 'newColor' } }
  }]
}
```

**Link field without intermediary (direct role reference)**: When a relation's role field directly references entities (no separate intermediary entity), link/unlink operate directly.

```typescript
// Field entity linking kinds directly (no intermediary)
{ $relation: 'Field', $id: 'f1', kinds: [{ $op: 'link', $id: 'k1' }] }
{ $relation: 'Field', $id: 'f1', kinds: [{ $op: 'link', $id: ['k1', 'k2', 'k3'] }] }
```

### A.4 Ref Field Mutations (contentType: REF)

Ref fields store typed record references (must reference a valid entity/relation).

**Create with ref field**: References can be inline objects or `Type:id` prefix strings.

```typescript
// Object format
{ $entity: 'FlexRef', id: 'fr1', reference: { $thing: 'User', $op: 'create', id: 'u1', email: '...' } }

// Prefix format (MANY cardinality)
{ $entity: 'FlexRef', $id: 'fr1', references: ['User:u3', 'User:u4'] }
```

**Replace ref field**: Assigning a new value replaces the previous reference entirely.

```typescript
// ONE cardinality — replaces old reference
{ $entity: 'FlexRef', $id: 'fr1', reference: { $thing: 'User', $op: 'link', $id: 'u2' } }

// MANY cardinality — replaces entire array
{ $entity: 'FlexRef', $id: 'fr1', references: [{ $thing: 'User', $op: 'create', id: 'u5' }] }
```

**`$op: 'link'` on ref field (MANY) = add**:

```typescript
{ $entity: 'FlexRef', $id: 'fr1', references: [{ $thing: 'User', $op: 'link', $id: 'u2' }] }
```

**`$op: 'unlink'` on ref field (MANY) = remove specific**:

```typescript
{ $entity: 'FlexRef', $id: 'fr1', references: [{ $thing: 'User', $op: 'unlink', $id: 'u1' }] }
```

**`null` on ref field = delete all references**:

```typescript
{ $entity: 'FlexRef', $id: 'fr1', references: null }
```

### A.5 Flex Field Mutations (contentType: FLEX)

Flex fields can store any value type: primitives, record references, objects, or mixed arrays. **Flex fields only support link operations for references** — `create`, `update`, `delete`, and `unlink` operations are not allowed and should throw an error.

**ONE cardinality — any value type**:

```typescript
// Number
{ $entity: 'FlexRef', id: 'fr1', flexReference: 7 }

// String
{ $entity: 'FlexRef', id: 'fr2', flexReference: 'hey' }

// Entity reference via implicit link (Type:id prefix)
{ $entity: 'FlexRef', id: 'fr3', flexReference: 'User:u1' }

// Entity reference via explicit link (object with $thing and $id)
{ $entity: 'FlexRef', id: 'fr4', flexReference: { $thing: 'User', $id: 'u1' } }
```

**MANY cardinality — mixed types in array**:

```typescript
// Array with mixed primitives, refs, and dates
{
  $entity: 'FlexRef', id: 'fr1',
  flexReferences: ['hey', 'User:u1', 8, 'User:u2', new Date('2024-01-01')]
}
// Queries as: ['hey', 'u1-id', 8, 'u2-id', Date('2024-01-01')]
```

**`Type:id` prefix format in flex fields**: A string matching `Type:id` (no spaces, single colon, both parts non-empty, Type exists in schema) is treated as a record reference (implicit link). Otherwise it's a plain string.

```typescript
// These are record references (implicit links via Type:id format):
{ flexReferences: ['User:u3', 'User:u4'] }

// These are plain strings (NOT references):
{ flexReferences: [
  'hello ? yes : no',   // has spaces around colon
  'User:abc:xyz',        // multiple colons
  'things it can do: jumping', // space before colon context
  'User: hey',           // space after colon
  'User:hey ',           // trailing space
] }
```

**Parsing rules for `Type:id` prefix** (from `prefixedToObj`):
1. Must be a string
2. Pattern: `^([^:]+):([^:]+)$` — exactly one colon
3. No spaces anywhere in the string
4. Both `Type` and `id` must be non-empty
5. `Type:_:tempId` format is also supported (maps to `$tempId`)

**Objects in flex fields**: An object is treated as a reference only if it contains **exactly** `{ $thing, $id }`, `{ $thing, $op: 'link', $id }`, or `{ $ref }` — no extra properties. Any other object is stored as a plain value.

```typescript
// Plain object — no $thing/$ref keys
{ $entity: 'FlexRef', id: 'fr1', flexReferences: [{ msg: 'Hello, world!' }] }
// Stored and queried back as: [{ msg: 'Hello, world!' }]

// Plain object — has $thing and $id but also extra properties, so NOT a reference
{ $entity: 'FlexRef', id: 'fr1', flexReferences: [{ $thing: 'User', $id: 'u1', name: 'foo' }] }
// Stored as-is: [{ $thing: 'User', $id: 'u1', name: 'foo' }]

// Reference — exactly $thing and $id, no extra keys
{ $entity: 'FlexRef', id: 'fr1', flexReferences: [{ $thing: 'User', $id: 'u1' }] }
// Resolved as RecordId reference to User:u1
```

**Explicit link with `$op: 'link'`** (optional — `$op` defaults to `link` when `$thing` and `$id` are present):

```typescript
{
  $entity: 'FlexRef', $id: 'fr1',
  flexReferences: ['hey', { $thing: 'User', $op: 'link', $id: 'u3' }, 9]
}
```

**Disallowed operations on flex fields**: The following throw an error:

```typescript
// ERROR: create not allowed on flex fields
{ $entity: 'FlexRef', id: 'fr1', flexReference: { $thing: 'User', $op: 'create', id: 'u1', email: '...' } }

// ERROR: unlink not allowed on flex fields
{ $entity: 'FlexRef', $id: 'fr1', flexReferences: [{ $thing: 'User', $op: 'unlink', $id: 'u1' }] }

// ERROR: delete not allowed on flex fields
{ $entity: 'FlexRef', $id: 'fr1', flexReferences: [{ $thing: 'User', $op: 'delete', $id: 'u1' }] }

// ERROR: update not allowed on flex fields
{ $entity: 'FlexRef', $id: 'fr1', flexReferences: [{ $thing: 'User', $op: 'update', name: 'new' }] }
```

**String number format preserved**: `'8'` stays as string `'8'`, not parsed as number.

**Weird format strings preserved**: `'}) * 100'` stored as-is.

### A.6 JSON Field References (`$ref` syntax)

JSON fields (contentType: `JSON`) support embedded record references using `{ $ref: 'Type:id' }` syntax within the JSON structure.

**Single reference in JSON**:

```typescript
// Mutation
{ $entity: 'Account', id: 'a1', profile: { company: { $ref: 'Company:co1' } } }

// Query result — $ref resolved to plain ID
{ profile: { company: 'co1' } }
```

**Array of references in JSON**:

```typescript
// Mutation
{ $entity: 'Account', id: 'a1', profile: { team: [{ $ref: 'User:u1' }, { $ref: 'User:u2' }] } }

// Query result
{ profile: { team: ['u1', 'u2'] } }
```

**Mixed references and data in JSON**:

```typescript
// Mutation
{ $entity: 'Account', id: 'a1', profile: { mixed: ['Hello', { $ref: 'Space:sp1' }] } }

// Query result
{ profile: { mixed: ['Hello', 'sp1'] } }
```

**`$ref` parsing rules** (from `isValidRef`):
1. Object must have exactly one property: `$ref`
2. `$ref` value must be a string containing at least one colon
3. Split on first colon → `thing` and `id`
4. Both `thing` and `id` must be non-empty
5. `thing` must exist in schema as entity or relation
6. Serialized to SurrealDB as `Type:⟨id⟩` (with Unicode angle brackets)

### A.7 Filter-Based Mutations

**Update nested items by filter**:

```typescript
// Update DataFields matching filter within a Space within a User
{
  $entity: 'User', $id: 'u1',
  spaces: [{
    $id: 'sp1',
    dataFields: [{ $op: 'update', type: 'afterChange', $filter: { type: 'toChange' } }]
  }]
}
// Only dataFields where type='toChange' are updated
```

**Multiple filters in same mutation**:

```typescript
// Two different filter+update combos on same nested field
{
  $entity: 'User', $id: 'u1',
  spaces: [{
    $id: 'sp1',
    dataFields: [
      { $op: 'update', type: 'afterChange1', $filter: { type: 'toChange1' } },
      { $op: 'update', type: 'afterChange2', $filter: { type: 'toChange2' } }
    ]
  }]
}
```

**Filter on role field (MANY cardinality)**:

```typescript
// Filter UserTags by which users they contain
{ $entity: 'UserTag', $filter: { users: ['u1', 'u2'] }, name: 'Updated' }
```

**Filter on link field**:

```typescript
// Filter UserTags by linked group
{ $entity: 'UserTag', $filter: { group: 'utg-1' }, name: 'Updated' }
```

**Filter through role field to property**:

```typescript
// Filter UserTags where linked group has specific color
{ $entity: 'UserTag', $filter: { color: 'blue' }, name: 'Updated' }
```

**Delete by filter (nested)**:

```typescript
// Delete all dataFields under a space
{
  $entity: 'User', $id: 'u1',
  spaces: [{ $id: 'sp1', dataFields: [{ $op: 'delete' }] }]
}

// Delete specific child by $id
{
  $entity: 'User', $id: 'u1',
  spaces: [{ $id: 'sp1', dataFields: [{ $op: 'delete', $id: 'df2' }] }]
}
```

**Unlink by filter (nested)**: Removes connection but preserves the target entity.

```typescript
{
  $entity: 'User', $id: 'u1',
  spaces: [{ $id: 'sp1', dataFields: [{ $op: 'unlink' }] }]
}
```

### A.8 Batch Mutations and TempId

**TempId declaration and reference**: `$tempId` declares a temporary ID on a create; other mutations reference it via `$tempId` in link/role fields.

```typescript
// Batch: create Account with tempId, then User referencing it
[
  { $entity: 'Account', $tempId: '_:acc1', id: 'a1', provider: 'google' },
  { $entity: 'User', id: 'u1', accounts: [{ $op: 'link', $tempId: '_:acc1' }] }
]
```

**Forward references**: A mutation can reference a `$tempId` that is declared later in the batch array. The adapter resolves all tempIds after collecting all creates.

```typescript
// User references account that is created later in the batch
[
  { $entity: 'User', id: 'u1', accounts: [{ $op: 'link', $tempId: '_:acc1' }] },
  { $entity: 'Account', $tempId: '_:acc1', $op: 'create', id: 'a1', provider: 'google' }
]
```

**Same tempId referenced multiple times**: Multiple mutations can reference the same `$tempId`.

```typescript
[
  { $entity: 'User', $tempId: '_:bea', id: 'bea' },
  { $entity: 'Account', id: 'a1', user: { $op: 'link', $tempId: '_:bea' } },
  { $entity: 'Account', id: 'a2', user: { $op: 'link', $tempId: '_:bea' } }
]
```

**Nested tempIds**: TempIds work within deeply nested mutation trees.

```typescript
[
  {
    $relation: 'UserTagGroup', $tempId: '_:utg1', id: 'utg1', color: { id: 'red' },
    tags: [{ id: 'tag1', users: [{ $tempId: '_:user1', id: 'u1' }] }]
  },
  {
    $relation: 'UserTag', id: 'tag2',
    group: [{ $op: 'link', $tempId: '_:utg1' }],
    users: [{ $op: 'link', $tempId: '_:user1' }]
  }
]
```

**TempIds with normal IDs together**: Can mix tempId references and normal `$id` strings.

```typescript
// Link to both existing space and newly created space
{
  $entity: 'User', id: 'u1',
  spaces: [
    { $op: 'link', $id: 'existing-space-1' },
    { $op: 'link', $tempId: '_:space2' }
  ]
}
```

**Return value includes `$tempId`**: The mutation result includes `$tempId` fields so the caller can map temp references to actual IDs.

### A.9 Delete Operations

**Simple entity delete**:

```typescript
{ $entity: 'User', $id: 'u1', $op: 'delete' }
```

**Simple relation delete**:

```typescript
{ $relation: 'User-Accounts', $id: 'ua1', $op: 'delete' }
```

**Deep nested delete**: Cascading delete through multiple levels.

```typescript
// Delete users and their nested accounts within a tag group's tags
{
  $relation: 'UserTagGroup', $id: 'utg1',
  tags: [{ $id: 'tag1', users: [{ $op: 'delete' }] }]
}
```

**Delete with `ignoreNonexistingThings`**: When enabled, deleting/unlinking/updating non-existent records does not throw an error.

### A.10 Operation Inference Rules

When `$op` is not explicitly provided, the operation is inferred (in priority order):

| Condition | Inferred `$op` |
|-----------|----------------|
| Has `$id` or `$filter`, has non-`$` fields | `update` |
| Has `$id` or `$filter`, no non-`$` fields | `link` |
| Has `$tempId`, has non-`$` fields | `create` |
| Has `$tempId`, no non-`$` fields | `link` |
| None of the above | `create` |

These rules apply uniformly regardless of field cardinality. For ONE-cardinality nested fields, if explicit `$op` is needed (e.g., `update` an existing linked record), the user must provide it explicitly — the adapter cannot distinguish intent from data fields alone. See test comments: `// we need to specify $op = 'update' or it will be considered as 'create'`.

**Constraints on explicit `$op` values:**

| Operation | Can have `$id`? | Can have `$filter`? | Can have data fields? | Nested under create? |
|-----------|-----------------|--------------------|-----------------------|----------------------|
| `create` | ✗ (use id field) | ✗ | ✓ | ✓ |
| `update` | ✓ | ✓ | ✓ | ✗ |
| `delete` | ✓ | ✓ | ✗ | ✗ |
| `link` | ✓ (optional) | ✗ | ✗ | ✓ |
| `unlink` | ✓ (optional) | ✗ | ✗ | ✗ |

### A.11 Nested Mutation Depth

Tests confirm deeply nested mutations work (5+ levels):

```
UserTagGroup → tags (UserTag) → users (User) → spaces (Space) → dataFields (DataField) → kinds (Kind)
```

Each level can independently perform create/update/delete/link/unlink operations.

### A.12 Hybrid Intermediary and Direct Relations

When an entity has both a direct relation field and a link field through an intermediary to the same target, mutations on either side are kept consistent. For example, `User.accounts` (link through `User-Accounts` intermediary) and the direct `User-Accounts` relation both reflect the same connections.

### A.13 Hook Behaviors (from preHooks.ts tests)

**Required field validation**:
```typescript
// Missing required field on create throws:
await ctx.mutate({ $entity: 'Hook', id: 'h1' });
// Error: "[Validations] Required field \"requiredOption\" is missing."
```

**Enum validation**:
```typescript
// Invalid enum value throws:
await ctx.mutate({ $entity: 'Hook', id: 'h1', requiredOption: 'd' });
// Error: '[Validations] Option "d" is not a valid option for field "requiredOption".'
```

**Transform hooks can add nested mutations**:
```typescript
// Transform detects 'cheatCode' name and adds nested space creation
await ctx.mutate({ $entity: 'User', id: 'u1', name: 'cheatCode' });
// Result: User created with a Space also created (added by transform hook)
```

**Transform hooks receive context**:
```typescript
// config.mutation.context = { spaceId: 'secret-space' }
await ctx.mutate({ $entity: 'User', id: 'u1', name: 'cheatCode2' });
// Transform uses context.spaceId to create a specific space
```

**Pre-query (`$fields`) not supported**: Tests that rely on `$fields`-based pre-queries (cascade delete via transform that fetches current relations) are marked `TODO{S}` and are skipped by this adapter.
