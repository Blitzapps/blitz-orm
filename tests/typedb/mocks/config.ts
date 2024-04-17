import type { BormConfig } from '../../../src/index';

export const config: BormConfig = {
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
