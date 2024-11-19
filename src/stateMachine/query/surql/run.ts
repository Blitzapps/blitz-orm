import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { VERSION } from '../../../version';
import { logDebug } from '../../../logger';

export const run = async (props: { client: SimpleSurrealClient; queries: string[] }): Promise<any[][]> => {
	const { client, queries } = props;
	const batchedQuery = `
	BEGIN TRANSACTION;
	${queries.join(';')};
	COMMIT TRANSACTION;
	`;

	logDebug(`batchedQuery[${VERSION}]`, JSON.stringify({ batchedQuery }));
	//console.log('batchedQuery', batchedQuery);
	return await client.query(batchedQuery);
};
