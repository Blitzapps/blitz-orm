import type { SurrealClient } from '../../../adapters/surrealDB/client';
import { log } from '../../../logger';
import type { BormConfig, DBHandles } from '../../../types';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import { buildLogicalMutation, validateValues } from './buildLogical';
import { buildMutationSurql, type SurqlParams } from './buildSurql';
import { applyDefaults } from './defaults';
import { applyHooks } from './hooks';
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
  log(['runSurql', 'runSurql/parsed'], parsed);

  // 2. Infer $op for every node in the tree
  const withOp = inferOp(parsed, schema);

  // 2.5 Infer $thing for nested blocks using schema context
  inferThingFromSchema(withOp, schema);
  log(['runSurql', 'runSurql/withOp'], withOp);

  // 3. Apply defaults (compute defaults for create nodes, convert string dates)
  const withDefaults = applyDefaults(withOp, schema);

  // 4. Apply hooks (transforms + validations; no pre-query)
  const hooked = applyHooks(withDefaults, schema, config);
  log(['runSurql', 'runSurql/hooked'], hooked);

  // 5. Build logical
  const logical = buildLogicalMutation(hooked, schema);
  log(['runSurql', 'runSurql/logical'], JSON.stringify(logical, null, 2));

  // 5.1 Validate values
  validateValues(logical, schema);

  // 6. Optimize
  const optimized = optimizeLogicalMutation(logical, schema);

  // 7. Build SurQL
  const params: SurqlParams = {};
  const { surql, stmtMap } = buildMutationSurql(optimized, params, config, schema);
  log(['buildSurql', 'buildSurql/surql'], surql);
  log(['buildSurql', 'buildSurql/params'], params);

  // 8. Execute
  const rawResults = await executeMutation(client, surql, params);
  log(['runSurql', 'runSurql/rawResults'], rawResults);

  // 9. Process results
  const results = processResults(rawResults, stmtMap, optimized, schema, config);
  log(['processResults', 'processResults/output'], results);
  return results;
};
