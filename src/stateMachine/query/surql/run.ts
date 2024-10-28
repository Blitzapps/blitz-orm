import type { BormConfig } from '../../../types';
import type { SurrealPool } from '../../../adapters/surrealDB/client';

export const run = async (props: { client: SurrealPool; queries: string[]; config: BormConfig }): Promise<any[][]> => {
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
