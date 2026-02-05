import type { SurrealClient } from '../../../adapters/surrealDB/client';
import { logDebug } from '../../../logger';
import type { BormConfig } from '../../../types';
import { VERSION } from '../../../version';
import type { SurqlParams } from './buildSurql';

export const query = async (props: {
  client: SurrealClient;
  queries: string[];
  config: BormConfig;
  params: SurqlParams;
}): Promise<any[][]> => {
  const { client, queries, config, params } = props;
  const batchedQuery = `BEGIN TRANSACTION;
${queries.join(';\n')};
COMMIT TRANSACTION;`;

  if (config.query?.debugger) {
    logDebug(`batchedQuery[${VERSION}]`, JSON.stringify({ batchedQuery }));
  }

  const result = await client.query(batchedQuery, params);
  return result as any[][];
};
