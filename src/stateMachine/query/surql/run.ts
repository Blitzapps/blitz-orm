import type { Surreal } from 'surrealdb.js';

export const run = async (props: { client: Surreal; queries: string[] }): Promise<any[][]> => {
	const { client, queries } = props;
	const batchedQuery = `
	BEGIN TRANSACTION;
	${queries.join(';')};
	COMMIT TRANSACTION;
	`;

	//console.log('batchedQuery', batchedQuery);
	return await client.query(batchedQuery);
};
