import type { Surreal } from 'surrealdb.js';

export const run = async (props: { client: Surreal; queries: string[] }): Promise<any[][]> => {
	const { client, queries } = props;
	const batchedQuery = `
	BEGIN TRANSACTION;
	${queries.join(';')};
	COMMIT TRANSACTION;
	`;
	return await client.query(batchedQuery);
};
