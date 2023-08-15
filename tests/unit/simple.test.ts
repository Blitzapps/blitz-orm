import 'jest';

import BormClient from '../../src';
import { cleanup, init } from '../helpers/lifecycle';

describe('Simple test', () => {
  let client: BormClient;
  let dbName: string;

  beforeAll(async () => {
    const config = await init();
    if (!config?.bormClient) {
      throw new Error('Failed to initialize BormClient');
    }
    dbName = config.dbName;
    client = config.bormClient;
  }, 15000);

  it('Basic mutation', async () => {
    expect(client).toBeDefined();

    await client.define();

    const res = await client.mutate({ $entity: 'User', name: 'John', email: 'john@gmail.com' }, { noMetadata: true });
    expect(res).toEqual({
      id: expect.any(String),
      name: 'John',
      email: 'john@gmail.com',
    });
  });
  afterAll(async () => {
    await cleanup(dbName);
  });
});
