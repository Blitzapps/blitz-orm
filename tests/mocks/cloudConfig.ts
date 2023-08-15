import { TypeDBCredential } from 'typedb-client';

import type { BormConfig } from '../../src/index';

export const cloudConfig: BormConfig = {
  server: {
    provider: 'blitz-orm-js',
  },
  dbConnectors: [
    {
      id: 'default',
      provider: 'typeDBCluster',
      dbName: 'test',
      // url: 'localhost:1729',
      addresses: [process.env.CLOUD_ADDRESS],
      credentials: new TypeDBCredential('admin', 'password', process.env.ROOT_CA),
    },
  ],
};
