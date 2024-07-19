import type { Surreal } from 'surrealdb.js';

export const runSURQLMutation = async (client: Surreal, mutations: string[]): Promise<any[][]> => {
	const batchedMutation = `
	BEGIN TRANSACTION;
	${mutations.join(';')};
	LET $DELTAS = SELECT * FROM Delta;
	DELETE Delta;
	RETURN $DELTAS;
	COMMIT TRANSACTION;`;
	//console.log('batchedMutation', batchedMutation);
	return await client.query(batchedMutation);
};
