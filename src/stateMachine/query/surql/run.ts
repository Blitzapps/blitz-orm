import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { VERSION } from '../../../version';
import { logDebug } from '../../../logger';
import type { BormConfig } from '../../../types';

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

	if (config.query?.debugger) {
		logDebug(`batchedQuery[${VERSION}]`, JSON.stringify({ batchedQuery }));
	}
	//console.log('batchedQuery!', batchedQuery);

	return await client.query(batchedQuery);
};
