import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { log } from '../../../logger';
import type { BormConfig } from '../../../types';
import { BQLQueryParser } from '../../../types/requests/parser';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import { buildLogicalQuery } from './buildLogical';
import { buildSurql, type SurqlParams } from './buildSurql';
import { optimizeLogicalQuery } from './optimize';
import { processResults } from './processResults';
import { query } from './query';

export const runSurrealDbQueryMachine2 = async (
  bql: unknown[],
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
  client: SimpleSurrealClient,
) => {
  if (bql.length === 0) {
    return [];
  }
  const bqlQueries = bql.map((q) => BQLQueryParser.parse(q));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/bqlQueries'],
    '> runSurrealDbQueryMachine2/bqlQueries\n',
    JSON.stringify(bqlQueries),
  );
  const logicalQueries = bqlQueries.map((q) => buildLogicalQuery(q, schema, !config.query?.noMetadata));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/logicalQueries'],
    '> runSurrealDbQueryMachine2/logicalQueries\n',
    JSON.stringify(logicalQueries),
  );
  const optimizedQueries = logicalQueries.map((q) => optimizeLogicalQuery(q, schema));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/optimizedQueries'],
    '> runSurrealDbQueryMachine2/optimizedQueries\n',
    JSON.stringify(optimizedQueries),
  );
  const params: SurqlParams = {};
  const surqlQueries = optimizedQueries.map((q) => buildSurql(q, params));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/params'],
    '> runSurrealDbQueryMachine2/params\n',
    JSON.stringify(params),
  );
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/surqlQueries'],
    '> runSurrealDbQueryMachine2/surqlQueries\n',
    JSON.stringify(surqlQueries),
  );
  const result = await query({ client, queries: surqlQueries, config, params });
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/result'],
    '> runSurrealDbQueryMachine2/result\n',
    JSON.stringify(surqlQueries),
  );
  const finalResult = processResults({
    batch: bqlQueries,
    results: result,
    schema,
    metadata: !config.query?.noMetadata,
    returnNulls: !!config.query?.returnNulls,
  });
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/finalResult'],
    '> runSurrealDbQueryMachine2/finalResult\n',
    JSON.stringify(finalResult),
  );
  return finalResult;
};
