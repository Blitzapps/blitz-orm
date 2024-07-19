import type { Surreal } from 'surrealdb.js';

export const runSURQLMutation = async (client: Surreal, mutations: string[]): Promise<any[][]> => {
	const batchedMutation = `
	BEGIN TRANSACTION;
	${mutations.join(';')};

	RETURN SELECT * FROM Delta;
	DELETE Delta; 
	COMMIT TRANSACTION;
	`;
	//console.log('batchedMutation', batchedMutation);
	return await client.query(batchedMutation);
};
