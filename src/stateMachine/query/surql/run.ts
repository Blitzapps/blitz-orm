import type { Surreal } from 'surrealdb';
import type { BormConfig } from '../../../types';

export const run = async (props: { client: Surreal; queries: string[]; config: BormConfig }): Promise<any[][]> => {
	const { client, queries, config } = props;
	const batchedQuery = `
	BEGIN TRANSACTION;
	${queries.join(';')};
	COMMIT TRANSACTION;
	`;

	if (config.query?.debugger) {
		console.log('batchedQuery', batchedQuery);
	}
	//console.log('batchedQuery', batchedQuery);
	return await client.query(batchedQuery);
};
