import type { SurrealClient } from '../../../adapters/surrealDB/client';
import { logDebug } from '../../../logger';
import type { BormConfig } from '../../../types';
import { VERSION } from '../../../version';

export const run = async (props: {
  client: SurrealClient;
  queries: string[];
  config: BormConfig;
}): Promise<any[][]> => {
  const { client, queries, config } = props;
  const batchedQuery = `
	BEGIN TRANSACTION;
	${queries.join(';')};
	COMMIT TRANSACTION;
	`;

  if (config.query?.debugger) {
    logDebug(`batchedQuery[${VERSION}]`, JSON.stringify({ batchedQuery }));
  }
  //console.log('batchedQuery!', batchedQuery);

  return await client.query(batchedQuery);
};
