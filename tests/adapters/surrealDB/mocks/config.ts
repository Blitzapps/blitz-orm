import type { BormConfig } from '../../../../src';

export const surrealDBTestConfig: BormConfig = {
  server: {
    provider: 'blitz-orm-js',
  },
  dbConnectors: [
    {
      id: 'default',
      provider: 'surrealDB',
      namespace: 'test',
      dbName: 'test',
      url: 'ws://127.0.0.1:8100',
      username: 'test',
      password: 'test',
    },
  ],
};
