import { nanoid } from 'nanoid';
import type { SurrealClient } from '../../../adapters/surrealDB/client';
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
  client: SurrealClient,
) => {
  const id = nanoid(3);
  if (bql.length === 0) {
    return [];
  }
  const start = performance.now();
  const bqlQueries = bql.map((q) => BQLQueryParser.parse(q));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/bqlQueries'],
    `> runSurrealDbQueryMachine2/bqlQueries ${id}\n`,
    JSON.stringify(bqlQueries),
  );
  const logicalQueries = bqlQueries.map((q) => buildLogicalQuery(q, schema, !config.query?.noMetadata));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/logicalQueries'],
    `> runSurrealDbQueryMachine2/logicalQueries ${id}\n`,
    JSON.stringify(logicalQueries),
  );
  const optimizedQueries = logicalQueries.map((q) => optimizeLogicalQuery(q, schema));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/optimizedQueries'],
    `> runSurrealDbQueryMachine2/optimizedQueries ${id}\n`,
    JSON.stringify(optimizedQueries),
  );
  const params: SurqlParams = {};
  const surqlQueries = optimizedQueries.map((q) => buildSurql(q, params));
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/params'],
    `> runSurrealDbQueryMachine2/params ${id}\n`,
    JSON.stringify(params),
  );
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/surqlQueries'],
    `> runSurrealDbQueryMachine2/surqlQueries ${id}\n`,
    JSON.stringify(surqlQueries),
  );
  const queryStart = performance.now();
  const result = await query({ client, queries: surqlQueries, config, params });
  const queryEnd = performance.now();
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/queryDuration'],
    `> runSurrealDbQueryMachine2/queryDuration ${id}\n`,
    `${(queryEnd - queryStart).toFixed(2)}ms`,
  );
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/result'],
    `> runSurrealDbQueryMachine2/result ${id}\n`,
    JSON.stringify(result),
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
    `> runSurrealDbQueryMachine2/finalResult ${id}\n`,
    JSON.stringify(finalResult),
  );
  const end = performance.now();
  log(
    ['runSurrealDbQueryMachine2', 'runSurrealDbQueryMachine2/duration'],
    `> runSurrealDbQueryMachine2/duration ${id}\n`,
    `${(end - start).toFixed(2)}ms`,
  );
  return finalResult;
};
