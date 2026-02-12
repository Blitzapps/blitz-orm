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

  try {
    const result = await client.query(batchedMutation);
    return result.filter(Boolean);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const isTransactionNoise =
      message === 'The query was not executed due to a failed transaction' ||
      message === 'There was an error when starting a new datastore transaction';

    if (!isTransactionNoise) {
      throw new Error(`Error running SURQL mutation: ${message}`);
    }
    throw err;
  }
};
