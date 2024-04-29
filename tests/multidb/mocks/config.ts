import type { BormConfig } from '../../../src/index';
import dotenv from 'dotenv';
dotenv.config();

// eslint-disable-next-line turbo/no-undeclared-env-vars
const typeDbUrl = process.env.TYPE_DB_URL as string;
if (!typeDbUrl) {
	throw new Error('TYPE_DB_URL is not defined');
}

export const config: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'typeDB',
			provider: 'typeDB',
			dbName: 'multi_db_test',
			url: typeDbUrl,
		},
		{
			id: 'surrealDB',
			provider: 'surrealDB',
			namespace: 'multi_db_test',
			dbName: 'test',
			url: 'ws://127.0.0.1:8000',
			username: 'tester',
			password: 'tester',
		},
	],
};
