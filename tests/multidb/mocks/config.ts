import type { BormConfig } from '../../../src/index';

export const config: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'typeDB',
			provider: 'typeDB',
			dbName: 'multi_db_test',
			url: 'localhost:1729',
		},
		{
			id: 'surrealDB',
			provider: 'surrealDB',
      namespace: 'multi_db_test',
			dbName: 'test',
			url: 'ws://127.0.0.1:8000',
      username: 'tester',
      password: 'tester'
		},
	],
};
