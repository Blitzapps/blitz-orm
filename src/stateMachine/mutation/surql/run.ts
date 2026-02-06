import type { SurrealClient } from '../../../adapters/surrealDB/client';
import { logDebug } from '../../../logger';
import { VERSION } from '../../../version';

export const runSURQLMutation = async (client: SurrealClient, mutations: string[]): Promise<any[]> => {
  const batchedMutation = `
	BEGIN TRANSACTION;
	${mutations.join(';')};
	LET $DELTAS = SELECT * FROM Delta;
	DELETE Delta;
	RETURN $DELTAS;

	LET $LOGS = SELECT * FROM LOG;
	RETURN $LOGS;
	COMMIT TRANSACTION; 
	`;

  logDebug(`>>> batchedMutation[${VERSION}]`, JSON.stringify({ batchedMutation }));
  //console.log('mutations', mutations);
  //console.log('batchedMutation', batchedMutation);
  try {
    const result = await client.query(batchedMutation);
    return result.filter(Boolean);
  } catch (error) {
    const errorRes = await client.queryRaw(batchedMutation);
    //console.log('errorRes!', JSON.stringify(errorRes, null, 2));
    const filteredErrorRes = errorRes.filter(
      (r) =>
        r.result !== 'The query was not executed due to a failed transaction' &&
        r.result !== 'There was an error when starting a new datastore transaction' &&
        r.status === 'ERR',
    );
    if (filteredErrorRes.length > 0) {
      throw new Error(`Error running SURQL mutation: ${JSON.stringify(filteredErrorRes)}`);
    }
    throw error;
  }
};
