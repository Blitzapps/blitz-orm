import { surrealDBTestConfig } from '../adapters/surrealDB/mocks/config';
import { typeDBTestConfig } from '../adapters/typeDB/mocks/config';
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
//console.log('adapter', adapter);

const config = adapter === 'surrealDB' ? surrealDBTestConfig : typeDBTestConfig;

export const init = async () =>
  setup({
    config,
    schema,
    tqlPathMap: {
      default: {
        schema: './tests/adapters/typeDB/mocks/schema.tql',
        data: './tests/adapters/typeDB/mocks/data.tql',
      },
    },
  });
[];
