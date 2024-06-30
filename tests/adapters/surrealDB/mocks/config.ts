import type { BormConfig } from '../../../../src';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const linkMode = process.env.BORM_TEST_SURREALDB_LINK_MODE as 'edges' | 'computed-refs';
if (!linkMode) {
	throw new Error('BORM_SURREALDB_LINK_MODE is not defined');
}

export const surrealDBTestConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'surrealDB',
			providerConfig: { linkMode: linkMode },
			namespace: 'test',
			dbName: 'test',
			url: 'ws://127.0.0.1:8000',
			username: 'test',
			password: 'test',
		},
	],
};
