# Plan: Restructure Files — Colocate Query & Mutation Adapters by Database

## Problem

Query and mutation adapters for the same database are split across two separate directory trees:

```
src/stateMachine/
  query/
    surql2/    ← SurrealDB query adapter
    tql/       ← TypeDB query adapter
    bql/       ← shared BQL query logic
  mutation/
    surql2/    ← SurrealDB mutation adapter
    surql/     ← SurrealDB legacy mutation adapter
    tql/       ← TypeDB mutation adapter
    bql/       ← shared BQL mutation logic
```

Additionally, shared database utilities live in a third location:

```
src/adapters/
  surrealDB/   ← client, helpers, parsing, filters, schema, types
  typeDB/      ← helpers, schema, transactions, parsing
```

This makes it hard to share code between query and mutation for the same database, and forces developers to jump between distant directories when working on a single database adapter.

## Proposed Structure

Reorganize by database first, then by concern:

```
src/
  adapters/
    surrealdb/
      client.ts                     ← (from adapters/surrealDB/client.ts)
      helpers.ts                    ← (from adapters/surrealDB/helpers.ts)
      schema/
        define.ts                   ← (from adapters/surrealDB/schema/define.ts)
      parsing/
        values.ts                   ← (from adapters/surrealDB/parsing/values.ts)
        parseFlexVal.ts             ← (from adapters/surrealDB/parsing/parseFlexVal.ts)
      types/
        base.ts                     ← (from adapters/surrealDB/types/base.ts)
      filters/
        filters.ts                  ← (from adapters/surrealDB/filters/filters.ts)
      query/                        ← (from stateMachine/query/surql2/)
        run.ts
        buildLogical.ts
        buildSurql.ts
        logical.ts
        optimize.ts
        processResults.ts
        query.ts
      mutation/                     ← (from stateMachine/mutation/surql2/)
        run.ts
        buildLogical.ts
        buildSurql.ts
        defaults.ts
        hooks.ts
        inferOp.ts
        inferThing.ts
        logical.ts
        optimize.ts
        parse.ts
        processResults.ts
        query.ts
      mutation-legacy/              ← (from stateMachine/mutation/surql/)
        machine.ts
        build.ts
        parse.ts
        run.ts
      pipeline/                     ← (from adapters/surrealDB/pipeline/)
        postprocess/
          query/
            cleanQueryRes.ts
    typedb/
      index.ts                      ← (from adapters/typeDB/index.ts)
      helpers.ts                    ← (from adapters/typeDB/helpers.ts)
      parseFlexVal.ts               ← (from adapters/typeDB/parseFlexVal.ts)
      openTx.ts                     ← (from adapters/typeDB/openTx.ts)
      commitTx.ts                   ← (from adapters/typeDB/commitTx.ts)
      revert.ts                     ← (from adapters/typeDB/revert.ts)
      schema/
        define.ts                   ← (from adapters/typeDB/schema/define.ts)
      query/                        ← (from stateMachine/query/tql/)
        machine.ts
        run.ts
        build.ts
        parse.ts
        filters.ts
      mutation/                     ← (from stateMachine/mutation/tql/)
        machine.ts
        run.ts
        build.ts
        parse.ts
    index.ts                        ← (from adapters/index.ts) adapter context config
  bql/                              ← (from stateMachine/{query,mutation}/bql/)
    query/                          ← (from stateMachine/query/bql/)
      enrich.ts
      clean.ts
    mutation/                       ← (from stateMachine/mutation/bql/)
      enrich.ts
      flatter.ts
      parse.ts
      stringify.ts
      preQuery.ts
      intermediary.ts
      jsonRefs.ts
      enrichSteps/
        computeFields.ts
        enrichChildren.ts
        preHookDependencies.ts
        preHookTransformations.ts
        preHookValidations.ts
        preValidate.ts
        replaces.ts
        rootMeta.ts
        splitIds.ts
        unlinkAll.ts
      guards/
        dependenciesGuard.ts
        preQueryGuard.ts
      shared/
        doActions.ts
        get$bzId.ts
        getOp.ts
        getOppositePlayers.ts
        getTriggeredActions.ts
        validateOp.ts
  stateMachine/
    query/
      queryMachine.ts               ← stays (orchestrator, routes to adapters)
      postHook.ts                   ← stays
    mutation/
      mutationMachine.ts            ← stays (orchestrator, routes to adapters)
```

## Key Decisions

1. **Database-first grouping**: Each database adapter (`surrealdb/`, `typedb/`) contains its client, schema, parsing, query adapter, and mutation adapter all together.

2. **BQL is a top-level sibling of adapters/**: The BQL enrichment/parsing logic is database-agnostic and shared across all adapters. It moves to `src/bql/{query,mutation}/`, making it a peer of `adapters/` and `stateMachine/`.

3. **Orchestrators stay in stateMachine/**: `queryMachine.ts` and `mutationMachine.ts` are routers that dispatch to the correct adapter. They stay in `stateMachine/`.

4. **Legacy SurrealDB mutation adapter**: Moved to `adapters/surrealdb/mutation-legacy/` to keep it colocated but clearly marked as legacy.

5. **Lowercase directory names**: Normalize `surrealDB` → `surrealdb`, `typeDB` → `typedb` for consistency.

## Steps

### Phase 1: Delete dead files

- [ ] 1.1. Delete all `.old`, `.older`, and `.ts-old` backup files across `src/`:
  - `src/adapters/surrealDB/index.ts.old`
  - `src/logger.ts.old`
  - `src/pipeline/control/dispatchPipeline.ts.old`
  - `src/pipeline/pipeline.ts.old`
  - `src/pipeline/postprocess/fieldsOperator.ts.old`
  - `src/pipeline/postprocess/idOperator.ts.old`
  - `src/pipeline/postprocess/parseTQLRes.ts.old`
  - `src/pipeline/preprocess/mutation/attributePreeHooks.ts.old`
  - `src/pipeline/preprocess/mutation/buildTQLMutation.ts.old`
  - `src/pipeline/preprocess/mutation/enrichBQLMutation.ts.old`
  - `src/pipeline/preprocess/mutation/hooks/utils.ts.old`
  - `src/pipeline/preprocess/mutation/nodePreeHooks.ts.old`
  - `src/pipeline/preprocess/mutation/parseBQLMutation.ts.old`
  - `src/pipeline/preprocess/mutation/preQuery.ts.old`
  - `src/pipeline/preprocess/mutation/validationHooks.ts-old`
  - `src/pipeline/preprocess/query/buildTQLQuery.ts.old`
  - `src/pipeline/preprocess/query/enrichBQLQuery.ts.old`
  - `src/pipeline/transaction/runTQLMutation.ts.old`
  - `src/pipeline/transaction/runTQLQuery.ts.old`
  - `src/pipeline/transaction/runTQLQuery.ts.older`
  - `src/stateMachine/mutation/machine.ts.old`
  - `src/stateMachine/mutation/surql/build.ts.old`
  - `src/stateMachine/mutation/surql/parse.ts.old`
- [ ] 1.2. Delete `src/stateMachine/mutation/surql/surrealDB.md` (stale documentation)
- [ ] 1.3. Run `tsc --noEmit` to confirm nothing referenced the deleted files

### Phase 2: Move BQL files

- [ ] 2.1. Move `src/stateMachine/query/bql/*` → `src/bql/query/`
- [ ] 2.2. Move `src/stateMachine/mutation/bql/*` → `src/bql/mutation/`
- [ ] 2.3. Update all import paths referencing moved BQL files (see full list in "Files That Need Import Updates")
- [ ] 2.4. Run `tsc --noEmit` to verify no broken imports
- [ ] 2.5. Run `pnpm run test:surrealdb-ignoreTodo` to verify tests pass

### Phase 3: Move SurrealDB files

- [ ] 3.1. Rename `src/adapters/surrealDB/` → `src/adapters/surrealdb/` (includes client, helpers, schema, parsing, filters, pipeline, types — all move with the rename)
- [ ] 3.2. Move `src/stateMachine/query/surql2/*` → `src/adapters/surrealdb/query/`
- [ ] 3.3. Move `src/stateMachine/mutation/surql2/*` → `src/adapters/surrealdb/mutation/`
- [ ] 3.4. Move `src/stateMachine/mutation/surql/*` → `src/adapters/surrealdb/mutation-legacy/`
- [ ] 3.5. Update all import paths referencing moved SurrealDB files (see full list in "Files That Need Import Updates")
- [ ] 3.6. Run `tsc --noEmit` to verify no broken imports
- [ ] 3.7. Run `pnpm run test:surrealdb-ignoreTodo` to verify tests pass

### Phase 4: Move TypeDB files

- [ ] 4.1. Move `src/stateMachine/query/tql/*` → `src/adapters/typedb/query/`
- [ ] 4.2. Move `src/stateMachine/mutation/tql/*` → `src/adapters/typedb/mutation/`
- [ ] 4.3. Rename `src/adapters/typeDB/` → `src/adapters/typedb/` (if not already done by above moves)
- [ ] 4.4. Update all import paths referencing moved TypeDB files (see full list in "Files That Need Import Updates")
- [ ] 4.5. Run `tsc --noEmit` to verify no broken imports

### Phase 5: Clean up

- [ ] 5.1. Remove empty directories (`stateMachine/query/surql2/`, `stateMachine/query/tql/`, `stateMachine/query/bql/`, `stateMachine/mutation/surql2/`, `stateMachine/mutation/surql/`, `stateMachine/mutation/tql/`, `stateMachine/mutation/bql/`)
- [ ] 5.2. Verify build passes (`npm run build` or `tsc --noEmit`)
- [ ] 5.3. Run `pnpm run test:surrealdb-ignoreTodo` to verify all tests pass
- [ ] 5.4. Look for opportunities to extract shared code between query and mutation within each adapter (e.g., shared `buildLogical`, `optimize`, `processResults` patterns)

## Files That Need Import Updates

### Phase 2 — BQL moves

**Files that import from BQL (need path updates):**

| File | Old import | New import |
|------|------------|------------|
| `src/stateMachine/query/queryMachine.ts` | `./bql/enrich`, `./bql/clean` | `../../bql/query/enrich`, `../../bql/query/clean` |
| `src/stateMachine/query/postHook.ts` | `./bql/clean` (if applicable) | `../../bql/query/clean` |
| `src/stateMachine/mutation/mutationMachine.ts` | `./bql/enrich`, `./bql/parse`, etc. | `../../bql/mutation/enrich`, `../../bql/mutation/parse`, etc. |
| `src/stateMachine/query/surql2/processResults.ts` | `../../mutation/bql/jsonRefs` | `../../../bql/mutation/jsonRefs` |
| `src/stateMachine/query/tql/machine.ts` | `../bql/enrich`, `../bql/clean` | `../../../bql/query/enrich`, `../../../bql/query/clean` |
| `src/stateMachine/mutation/surql/machine.ts` | `../bql/*` | `../../../bql/mutation/*` |
| `src/stateMachine/mutation/surql2/run.ts` | `../bql/*` (if applicable) | `../../../bql/mutation/*` |
| `src/adapters/surrealDB/parsing/values.ts` | `stateMachine/mutation/bql/jsonRefs` | `../../bql/mutation/jsonRefs` |

**Intra-BQL imports (moved files referencing each other):**

| File (at new location) | Old import | New import |
|------|------------|------------|
| `bql/mutation/enrich.ts` | `../../query/bql/enrich` (enrichFilter) | `../query/enrich` |
| `bql/mutation/flatter.ts` | `adapters/surrealDB/parsing/values` | `../../adapters/surrealDB/parsing/values` (updated to `surrealdb` in Phase 3) |
| `bql/mutation/jsonRefs.ts` | `adapters/surrealDB/helpers` | `../../adapters/surrealDB/helpers` (updated to `surrealdb` in Phase 3) |

### Phase 3 — SurrealDB moves

**Orchestrators & top-level files:**

| File | Imports from | New import |
|------|-------------|------------|
| `src/stateMachine/query/queryMachine.ts` | `surql2/run`, `adapters/surrealDB/client` | `adapters/surrealdb/query/run`, `adapters/surrealdb/client` |
| `src/stateMachine/mutation/mutationMachine.ts` | `surql2/run`, `surql/machine` | `adapters/surrealdb/mutation/run`, `adapters/surrealdb/mutation-legacy/machine` |
| `src/define/index.ts` | `adapters/surrealDB/schema/define` | `adapters/surrealdb/schema/define` |
| `src/index.ts` | `adapters/surrealDB/client` | `adapters/surrealdb/client` |
| `src/types/config/surrealdb.ts` | `adapters/surrealDB/client`, `adapters/surrealDB/types/base` | `adapters/surrealdb/client`, `adapters/surrealdb/types/base` |
| `src/types/config/typedb.ts` | `adapters/surrealDB/types/base` | `adapters/surrealdb/types/base` |
| `src/types/requests/mutations.ts` | `adapters/surrealDB/types/base` | `adapters/surrealdb/types/base` |
| `src/enrichSchema.draft.ts` | `adapters/surrealDB/helpers` | `adapters/surrealdb/helpers` |

**BQL files (now at `src/bql/`, importing SurrealDB-specific code):**

| File | Imports from | New import |
|------|-------------|------------|
| `src/bql/mutation/flatter.ts` | `adapters/surrealDB/parsing/values` | `adapters/surrealdb/parsing/values` |
| `src/bql/mutation/jsonRefs.ts` | `adapters/surrealDB/helpers` | `adapters/surrealdb/helpers` |

**Intra-adapter imports (moved files referencing each other — become relative):**

| File (at new location) | Old import | New import |
|------|-------------|------------|
| `adapters/surrealdb/mutation/logical.ts` | `query/surql2/logical` | `../query/logical` |
| `adapters/surrealdb/mutation/optimize.ts` | `query/surql2/optimize` | `../query/optimize` |
| `adapters/surrealdb/mutation/buildSurql.ts` | `query/surql2/buildSurql` | `../query/buildSurql` |
| `adapters/surrealdb/mutation/buildLogical.ts` | `query/surql2/buildLogical` | `../query/buildLogical` |
| `adapters/surrealdb/query/processResults.ts` | `bql/mutation/jsonRefs` (after Phase 2) | `../../../bql/mutation/jsonRefs` |
| `adapters/surrealdb/query/buildSurql.ts` | `adapters/surrealDB/helpers` | `../helpers` |
| `adapters/surrealdb/query/query.ts` | `adapters/surrealDB/client` | `../client` |
| `adapters/surrealdb/query/run.ts` | `adapters/surrealDB/client` | `../client` |
| `adapters/surrealdb/mutation/buildSurql.ts` | `adapters/surrealDB/helpers` | `../helpers` |
| `adapters/surrealdb/mutation/query.ts` | `adapters/surrealDB/client` | `../client` |
| `adapters/surrealdb/mutation/run.ts` | `adapters/surrealDB/client` | `../client` |
| `adapters/surrealdb/schema/define.ts` | `../helpers`, `../parsing/values` | no change needed (already relative within adapter) |
| `adapters/surrealdb/pipeline/postprocess/query/cleanQueryRes.ts` | `../../../types/base` | no change needed (already relative within adapter) |

**Legacy adapter imports (moved files):**

| File (at new location) | Old import | New import |
|------|-------------|------------|
| `adapters/surrealdb/mutation-legacy/build.ts` | `adapters/surrealDB/filters/filters`, `adapters/surrealDB/helpers`, `adapters/surrealDB/parsing/values` | `../filters/filters`, `../helpers`, `../parsing/values` |
| `adapters/surrealdb/mutation-legacy/machine.ts` | `adapters/surrealDB/client` | `../client` |
| `adapters/surrealdb/mutation-legacy/run.ts` | `adapters/surrealDB/client` | `../client` |

**Test files:**

| File | Imports from | New import |
|------|-------------|------------|
| `tests/unit/mutations/hooksUnit.ts` | `stateMachine/mutation/surql2/hooks`, `stateMachine/mutation/surql2/parse` | `adapters/surrealdb/mutation/hooks`, `adapters/surrealdb/mutation/parse` |
| `tests/unit/enrichSchema.test.ts` | `adapters/surrealDB/*` | `adapters/surrealdb/*` |
| `tests/unit/surrealClient.test.ts` | `adapters/surrealDB/*` | `adapters/surrealdb/*` |

### Phase 4 — TypeDB moves

| File | Imports from | New import |
|------|-------------|------------|
| `src/stateMachine/query/queryMachine.ts` | `tql/machine` | `adapters/typedb/query/machine` |
| `src/stateMachine/mutation/mutationMachine.ts` | `tql/machine` | `adapters/typedb/mutation/machine` |
| `src/define/index.ts` | `adapters/typeDB/schema/define` | `adapters/typedb/schema/define` |
| `adapters/typedb/query/run.ts` | `adapters/typeDB/helpers` | `../helpers` |
| `adapters/typedb/mutation/build.ts` | `adapters/typeDB/parseFlexVal` | `../parseFlexVal` |
| `adapters/typedb/mutation/run.ts` | `adapters/typeDB/helpers` | `../helpers` |

### Note: BQL–SurrealDB coupling

`flatter.ts` and `jsonRefs.ts` in `bql/mutation/` import directly from `adapters/surrealDB/`. This means BQL is not fully database-agnostic. For now, just update the paths. Consider extracting these into a shared utility in a future cleanup.

## Risk Mitigation

- **Do each phase as a separate commit** so it's easy to bisect if something breaks.
- **Use `git mv`** to preserve file history.
- **Run `tsc --noEmit` after each phase** (not just at the end) to catch broken imports early.
- **Search for string references** (not just imports) — some files may reference adapter paths in comments, error messages, or dynamic imports.
