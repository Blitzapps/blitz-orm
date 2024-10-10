import type { Surreal } from 'surrealdb';
import type { BormConfig } from '../../../types';

export const runSURQLMutation = async (client: Surreal, mutations: string[], config: BormConfig): Promise<any[]> => {
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

	if (config.mutation?.debugger) {
		console.log('batchedMutation', batchedMutation);
	}
	//console.log('mutations', mutations);
	//console.log('batchedMutation', batchedMutation);
	try {
		const result = await client.query(batchedMutation);
		return result.filter(Boolean);
	} catch (error) {
		const errorRes = await client.query_raw(batchedMutation);
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
