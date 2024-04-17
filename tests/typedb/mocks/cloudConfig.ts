import { TypeDBCredential } from 'typedb-driver';
import { BormConfig } from '../../../src';

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
