import type { BormConfig } from '../../../src/index';

export const testConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'surrealDB',
			dbName: 'test',
			url: 'localhost:8000',
      username: 'root',
      password: 'root'
		},
	],
};
