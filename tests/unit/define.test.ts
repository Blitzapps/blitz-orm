import 'jest';

import type BormClient from '../../src/index';
import { cleanup, init } from '../helpers/lifecycle';

describe('Mutation init', () => {
  let dbName: string;
  let bormClient: BormClient;

  beforeAll(async () => {
    const config = await init();
    if (!config?.bormClient) {
      throw new Error('Failed to initialize BormClient');
    }
    dbName = config.dbName;
    bormClient = config.bormClient;
  }, 15000);

  it('b1[create] Basic', async () => {
    expect(bormClient).toBeDefined();

    await bormClient.define();
  });

  afterAll(async () => {
    await cleanup(dbName);
  });
});
