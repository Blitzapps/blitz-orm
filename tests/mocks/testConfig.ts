import type { BormConfig } from '../../src/index';

export const testConfig: BormConfig = {
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
