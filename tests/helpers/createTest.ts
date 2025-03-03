import { afterAll, beforeAll, describe } from 'vitest';
import type BormClient from '../../src';
import { assertDefined } from '../../src/helpers';

type TestContext = {
  query: BormClient['query'];
  mutate: BormClient['mutate'];
  define: BormClient['define'];
  getDbHandles: BormClient['getDbHandles'];
};

export const createTest = (name: string, test: (ctx: TestContext) => void) => {
  const runTest = (init: () => Promise<{ client: BormClient; clean?: () => void | Promise<void> }>) => {
    let client: BormClient;
    let clean: (() => void | Promise<void>) | undefined;
    const ctx: TestContext = {
      define: (...params) => {
        assertDefined(client);
        return client.define(...params);
      },
      query: (...params) => {
        assertDefined(client);
        return client.query(...params);
      },
      mutate: (...params) => {
        assertDefined(client);
        return client.mutate(...params);
      },
      getDbHandles: () => {
        assertDefined(client);
        return client.getDbHandles();
      },
    };

    beforeAll(async () => {
      const res = await init();
      // eslint-disable-next-line prefer-destructuring
      client = res.client;
      // eslint-disable-next-line prefer-destructuring
      clean = res.clean;
    }, 25000);

    describe(name, () => {
      test(ctx);

      afterAll(async () => {
        await clean?.();
      });
    }, 90000);
  };

  return runTest;
};
