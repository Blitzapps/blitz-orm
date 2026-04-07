# Fix: RecordId identification breaks in production (minified) builds

## Problem

`isRecordId()` in `src/adapters/surrealdb/mutation/processResults.ts:277` relies on
`constructor.name === 'RecordId'` to detect SurrealDB `RecordId` objects. In production builds
(e.g. Next.js `next start` with `output: 'standalone'`), bundlers minify class names, so
`constructor.name` becomes `"a"`, `"t"`, etc. instead of `"RecordId"`.

When the check fails, `extractRecordId` falls through to `String(value)` which returns the full
`"Table:id"` string (e.g. `"File:x__YhhVtoqvanzS_w5UFtY0"`). The table prefix is not stripped,
so downstream code receives IDs like `"File:xxx"` instead of `"xxx"`.

### Impact

Any code that uses the `$id` from a BORM mutation response will get prefixed IDs in production
but clean IDs in dev. In the Blitz app this causes file URL lookups to 404 because the frontend
requests `/api/files/File:xxx/url` instead of `/api/files/xxx/url`.

### Affected code paths

1. **`isRecordId()`** (line 277) — used by `extractRecordId`, `extractTableName`, and
   `processValue` to detect RecordId objects.
2. **`processValue()`** (line 185) — strips RecordId from nested field values (e.g. linked
   record references in query results).
3. **`extractRecordId()`** (line 231) — extracts the plain ID from a RecordId.
4. **`extractTableName()`** (line 262) — extracts the table name from a RecordId.

Note: `resolveJsonRecordLinks` in `src/bql/mutation/jsonRefs.ts:72` uses `instanceof RecordId`
instead, which has different failure modes (cross-realm issues) but is not affected by
minification.

## Fix

Replace the `constructor.name` check in `isRecordId()` with the `instanceof` operator, importing
`RecordId` from the `surrealdb` package (already a dependency, already imported elsewhere in the
codebase).

### Steps

#### 1. Import `RecordId` in `processResults.ts`

Add at the top of `src/adapters/surrealdb/mutation/processResults.ts`:

```ts
import { RecordId } from 'surrealdb';
```

#### 2. Replace `isRecordId` implementation

Replace the current implementation (lines 277–287):

```ts
const isRecordId = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return value instanceof RecordId;
};
```

#### 3. Add unit tests for `processRecord` with RecordId values

Create `src/adapters/surrealdb/mutation/processResults.test.ts` covering:

- **RecordId object as `id` field** → should extract plain ID without table prefix.
- **RecordId object as a nested value** (e.g. a link field) → should resolve to plain ID.
- **String `"Table:id"` as `id` field** → should strip prefix.
- **String `"Table:⟨id⟩"` as a nested value** → should strip prefix and angle brackets.
- **Plain string ID** → should pass through unchanged.
- **Object with `{ tb, id }` shape** (structural fallback) → should be detected as RecordId.

#### 4. Rebuild and verify

Run `pnpm build` and confirm the published `dist/index.mjs` uses `instanceof` instead of
`constructor.name`. Then verify in a downstream Next.js app that mutation `$id` values no longer
include the table prefix in production builds.
