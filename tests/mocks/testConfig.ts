import type { BormConfig } from '../../src/index';

export const typeDbTestConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'typeDB',
			dbName: 'test',
			url: 'localhost:1729',
		},
	],
};

export const dgraphDbTestConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'dgraph',
			dbName: 'test',
			url: 'https://nameless-brook-540056.eu-central-1.aws.cloud.dgraph.io/graphql',
		},
	],
};
