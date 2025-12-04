import { uid } from 'radash';
import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { log } from '../../../logger';
import type { BormConfig } from '../../../types';
import { VERSION } from '../../../version';

export const run = async (props: {
  client: SimpleSurrealClient;
  queries: string[];
  config: BormConfig;
}): Promise<any[][]> => {
  const { client, queries, config } = props;
  const batchedQuery = `
	BEGIN TRANSACTION;
	${queries.join(';')};
	COMMIT TRANSACTION;
	`;
  const id = uid(3);

  log('runSURQLQuery', `[${VERSION}] runSURQLQuery/batchedQuery ${id}`, JSON.stringify({ batchedQuery }));
  //console.log('batchedQuery!', batchedQuery);

  const startTime = performance.now();
  const res = await client.query(batchedQuery);
  // log('runSURQLQuery', `[${VERSION}] runSURQLQuery/result ${id}`, JSON.stringify({ res }));
  // log('runSURQLQuery', `[${VERSION}] runSURQLQuery/query time ${id}`, performance.now() - startTime);
  return res as any[][];
};
