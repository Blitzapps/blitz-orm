import { schema } from '../mocks/schema';
import { setup } from './setup';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const adapter = process.env.BORM_TEST_ADAPTER;

if (!adapter) {
  throw new Error('BORM_TEST_ADAPTER is not defined');
}

if (['surrealDB', 'typeDB'].includes(adapter) === false) {
  throw new Error(`Unsupported adapter "${adapter}"`);
}

const getConfig = async () => {
  if (adapter === 'surrealDB') {
    const { surrealDBTestConfig } = await import('../adapters/surrealDB/mocks/config');
    return surrealDBTestConfig;
  }
  const { typeDBTestConfig } = await import('../adapters/typeDB/mocks/config');
  return typeDBTestConfig;
};

export const init = async () => {
  const config = await getConfig();
  return setup({
    config,
    schema,
    tqlPathMap: {
      default: {
        schema: './tests/adapters/typeDB/mocks/schema.tql',
        data: './tests/adapters/typeDB/mocks/data.tql',
      },
    },
  });
};
