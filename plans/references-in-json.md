# References in JSON Data Fields

## Context

Allow `{ $ref: 'ThingType:id' }` objects inside JSON data fields to be stored as SurrealDB record links during mutation, and resolved back to plain IDs during query. This enables JSON fields to hold lightweight references to other records without defining full `refFields` in the schema.

**Mutation input:**
```js
{ $thing: 'Account', profile: { company: { $ref: 'Company:co1' } } }
```
**Query output:**
```js
{ profile: { company: 'co1' } }
```

**Rules:**
- `$ref` object must have ONLY `$ref` prop; if other props exist → normal object
- `$ref` value must be `ThingType:id` where ThingType exists in the schema; otherwise → normal object
- Array refs preserve order and are NOT deduplicated

---

## Implementation

### Step 1: Create `src/stateMachine/mutation/bql/jsonRefs.ts`

Two exported functions:

#### `processJsonRefs(value: any, schema: EnrichedBormSchema): string`

Recursively walks a JSON value. When it finds a valid `$ref` object, it emits a bare SurrealDB record link (`Company:⟨co1⟩`) instead of a quoted JSON string. All other values are serialized normally.

```
isValidRef(obj, schema):
  - Object with exactly 1 key "$ref"
  - Value is string matching "ThingType:id"
  - ThingType exists in schema.entities or schema.relations
  → returns { thing, id } or null

serializeWithRefs(value, schema):
  - null → "null"
  - string → JSON.stringify(value)
  - number/boolean → String(value)
  - array → "[item1, item2, ...]" (recursive, preserving order)
  - object with valid $ref → "ThingType:⟨id⟩" (bare record link)
  - other object → '{"key": value, ...}' (recursive)
```

#### `resolveJsonRecordLinks(value: any): any`

Recursively walks a JSON value returned from SurrealDB. Converts record link objects (`{ id: string, tb: string }` with exactly 2 keys) back to plain ID strings.

```
resolveJsonRecordLinks(value):
  - array → map recursively
  - object with keys {id, tb} only → return value.id
  - other object → recurse into each property
  - primitives → return as-is
```

### Step 2: Modify mutation path — `src/adapters/surrealDB/parsing/values.ts`

Add optional `schema` parameter to `parseValueSurrealDB`:

```typescript
export const parseValueSurrealDB = (value: unknown, ct?: string, schema?: EnrichedBormSchema): any => {
```

Update the `JSON` case (currently just `return value`):

```typescript
case 'JSON':
  if (schema && typeof value === 'string') {
    const parsed = JSON.parse(value);
    return processJsonRefs(parsed, schema);
  }
  return value;
```

The value is already a JSON string at this point (stringified in `stringify.ts`). We parse it, process `$ref` objects, and return a custom-serialized string with bare record links.

### Step 3: Pass schema to `parseValueSurrealDB` — `src/stateMachine/mutation/surql/build.ts`

Line ~42: change `parseValueSurrealDB(value, dataFieldSchema.contentType)` to:

```typescript
parseValueSurrealDB(value, dataFieldSchema.contentType, schema)
```

`schema` is already available as a parameter of `buildSURQLMutation`.

### Step 4: Modify query path — `src/stateMachine/query/surql2/processResults.ts`

In `transformResultObject()`, the data field handling at line ~130–136 currently calls `tryConvertDate(value)` for all data fields. Add a JSON-specific check using the field's `contentType`:

```typescript
if (field.type === 'data') {
  if (!returnNulls && isNullish(value)) {
    continue;
  }
  if (field.contentType === 'JSON') {
    newResult[alias] = resolveJsonRecordLinks(value) ?? null;
    continue;
  }
  newResult[alias] = tryConvertDate(value) ?? null;
  continue;
}
```

The `DRAFT_EnrichedBormDataField` type already has a `contentType` property, so no type changes are needed.

Import `resolveJsonRecordLinks` from `../../mutation/bql/jsonRefs`.

### Step 5: Tests — `tests/unit/mutations/jsonRefs.ts`

Using the existing `Account` entity with `profile` (JSON field), and existing `Company`, `User`, `Space` entities.

| Test | Description |
|------|-------------|
| `j1[json-refs] Single reference in JSON field` | Create Account with `profile: { company: { $ref: 'Company:co1' } }`, query, expect `profile.company === 'co1'` |
| `j2[json-refs] Array of references in JSON field` | Create Account with `profile: { team: [{ $ref: 'User:u1' }, { $ref: 'User:u2' }] }`, verify order preserved |
| `j3[json-refs] Mixed references and plain data` | Create Account with `profile: { workspace: { $ref: 'Space:sp1' }, settings: { theme: 'dark' }, tags: ['a'], count: 42 }`, verify refs resolved and plain data untouched |

Register in both:
- `tests/unit/mutations/allMutation.test.ts`
- `tests/unit/allTests.test.ts`

This ensures the new tests run under `pnpm test:surrealdb-ignoreTodo` (which executes `allTests.test.ts`).

---

## Files to Modify

| File | Action |
|------|--------|
| `src/stateMachine/mutation/bql/jsonRefs.ts` | **NEW** — `processJsonRefs()` + `resolveJsonRecordLinks()` |
| `src/adapters/surrealDB/parsing/values.ts` | Add `schema` param, process `$ref` in JSON case |
| `src/stateMachine/mutation/surql/build.ts` | Pass `schema` to `parseValueSurrealDB` |
| `src/stateMachine/query/surql2/processResults.ts` | Add JSON case using `field.contentType` to resolve record links |
| `tests/unit/mutations/jsonRefs.ts` | **NEW** — 3 test cases |
| `tests/unit/mutations/allMutation.test.ts` | Register new tests |
| `tests/unit/allTests.test.ts` | Register new tests |

## Verification

1. Run `pnpm test:surrealdb-ignoreTodo` — all tests must pass (includes existing + new tests)
2. Run `pnpm test:surrealdb-query:refs` — 67 passed, 12 failed (no regression; the 12 failures are pre-existing `TODO:{S}` / `TODO:{TS}` tests)
3. Verify the 3 new `j[json-refs]` test cases pass
4. Verify existing JSON tests (`b1b` tests in `basic.ts`) still pass (no regression)
