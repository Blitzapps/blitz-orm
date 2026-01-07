import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
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
  const logicalQueries = bqlQueries.map((q) => buildLogicalQuery(q, schema, !config.query?.noMetadata));
  const optimizedQueries = logicalQueries.map((q) => optimizeLogicalQuery(q, schema));
  const params: SurqlParams = {};
  const surqlQueries = optimizedQueries.map((q) => buildSurql(q, params));
  const result = await query({ client, queries: surqlQueries, config, params });
  const finalResult = processResults({
    batch: bqlQueries,
    results: result,
    schema,
    metadata: !config.query?.noMetadata,
    returnNulls: !!config.query?.returnNulls,
  });
  return finalResult;
};
