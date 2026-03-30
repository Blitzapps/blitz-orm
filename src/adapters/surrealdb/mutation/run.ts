import { log } from '../../../logger';
import type { BormConfig, DBHandles } from '../../../types';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { SurrealClient } from '../client';
import { buildLogicalMutation, validateValues } from './buildLogical';
import { buildMutationSurql, type SurqlParams } from './buildSurql';
import { applyDefaultsAndHooks } from './hooks';
import { inferOp } from './inferOp';
import { inferThingFromSchema } from './inferThing';
import { optimizeLogicalMutation } from './optimize';
import { parseBQLMutation } from './parse';
import { processResults } from './processResults';
import { executeMutation } from './query';

const getClient = (handles: DBHandles): SurrealClient => {
  const entry = handles.surrealDB?.values().next().value;
  if (!entry?.client) {
    throw new Error('No SurrealDB client available');
  }
  return entry.client;
};

export const runSurrealDbMutationMachine2 = async (
  bql: unknown,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
  handles: DBHandles,
): Promise<any[]> => {
  const client = getClient(handles);

  // 1. Parse (validates and normalizes raw input with Zod)
  const parsed = parseBQLMutation(bql, schema);
  log(['runSurql', 'runSurql/parsed'], `> runSurql/parsed\n`, parsed);

  // 2. Infer $op for every node in the tree
  const withOp = inferOp(parsed, schema);

  // 2.5 Infer $thing for nested blocks using schema context
  inferThingFromSchema(withOp, schema);
  log(['runSurql', 'runSurql/withOp'], `> runSurql/withOp\n`, withOp);

  // 3. Apply defaults + hooks in a single top-down pass
  //    For each node: apply defaults → apply transforms → infer $thing/$op for new children → recurse → validate
  const hooked = applyDefaultsAndHooks(withOp, schema, config);
  log(['runSurql', 'runSurql/hooked'], `> runSurql/hooked\n`, hooked);

  // 4. Build logical
  const logical = buildLogicalMutation(hooked, schema);
  log(['runSurql', 'runSurql/logical'], `> runSurql/logical\n`, logical);

  // 4.1 Validate values
  validateValues(logical, schema);

  // 5. Optimize
  const optimized = optimizeLogicalMutation(logical, schema);
  log(['runSurql', 'runSurql/optimized'], `> runSurql/optimized\n`, optimized);

  // 6. Build SurQL
  const params: SurqlParams = {};
  const { surql, stmtMap } = buildMutationSurql(optimized, params, config, schema);
  log(['buildSurql', 'buildSurql/surql'], `> buildSurql/surql\n`, surql);
  log(['buildSurql', 'buildSurql/params'], `> buildSurql/params\n`, params);

  // 7. Execute
  const rawResults = await executeMutation(client, surql, params);
  log(['runSurql', 'runSurql/rawResults'], `> runSurql/rawResults\n`, rawResults);

  // 8. Process results
  const results = processResults(rawResults, stmtMap, optimized, schema, config);
  log(['processResults', 'processResults/output'], `> processResults/output\n`, results);
  return results;
};
