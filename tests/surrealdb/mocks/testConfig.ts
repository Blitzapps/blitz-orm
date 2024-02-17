import type { BormConfig } from '../../../src/index';

export const testConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'surrealDB',
      namespace: 'test',
			dbName: 'test',
			url: 'ws://127.0.0.1:8000',
      username: 'root',
      password: 'root'
		},
	],
};
