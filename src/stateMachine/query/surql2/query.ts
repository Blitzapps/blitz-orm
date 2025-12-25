import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { logDebug } from '../../../logger';
import type { BormConfig } from '../../../types';
import { VERSION } from '../../../version';
import type { SurqlParams } from './buildSurql';

export const query = async (props: {
  client: SimpleSurrealClient;
  queries: string[];
  config: BormConfig;
  params: SurqlParams;
}): Promise<any[][]> => {
  const { client, queries, config, params } = props;
  const batchedQuery = `BEGIN TRANSACTION;
${queries.join(';')};
COMMIT TRANSACTION;`;
  console.log('\n> batchedQuery\n', batchedQuery);

  if (config.query?.debugger) {
    logDebug(`batchedQuery[${VERSION}]`, JSON.stringify({ batchedQuery }));
  }

  const result = await client.query(batchedQuery, params);
  console.log('> result', JSON.stringify(result, null, 2));
  return result as any[][];
};
