import 'jest';
import { TypeDBCredential } from 'typedb-client';

import BormClient, { BormConfig } from '../../src';
import { testSchema } from '../mocks/testSchema';

const cloudConfig: BormConfig = {
  server: {
    provider: 'blitz-orm-js',
  },
  dbConnectors: [
    {
      id: 'default',
      provider: 'typeDBCluster',
      dbName: 'test',
      // url: 'localhost:1729',
      // @ts-expect-error
      addresses: [process.env.CLOUD_ADDRESS],
      credentials: new TypeDBCredential('admin', 'password', process.env.CLOUD_ROOT_CA),
    },
  ],
};

describe('Simple test', () => {
  let client: BormClient;

  beforeAll(async () => {
    const bormClient = new BormClient({
      schema: testSchema, // todo: use a simpler schema
      config: cloudConfig,
    });
    // await bormClient.init();
    client = bormClient;
  }, 15000);

  it('Basic mutation', async () => {
    expect(client).toBeDefined();

    const res = await client.mutate({ $entity: 'User', name: 'John', email: 'john@gmail.com' }, { noMetadata: true });
    expect(res).toEqual({
      id: expect.any(String),
      name: 'John',
      email: 'john@gmail.com',
    });
  });
});
