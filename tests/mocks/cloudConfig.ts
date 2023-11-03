import type { BormConfig } from '../../src/index';
import { TypeDBCredential } from 'typedb-driver';

export const cloudConfig: BormConfig = {
	server: {
		provider: 'blitz-orm-js',
	},
	dbConnectors: [
		{
			id: 'default',
			provider: 'typeDBCluster',
			dbName: 'test',
			addresses: [
				// temporally replace it by hand
				'myUrl_1729',
			],
			credentials: new TypeDBCredential('admin', 'password', './tests/certs/rootCA.pem'),
		},
	],
};
