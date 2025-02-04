import type { BormConfig } from '../../../../src';

export const postgresDBTestConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'postgresDB',
			dbName: 'test',
			user: 'test',
			password: 'test',
			host: 'localhost',
			port: 5432,
		},
	],
};
