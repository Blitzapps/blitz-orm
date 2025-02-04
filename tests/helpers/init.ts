import { setup } from './setup';
import { schema } from '../mocks/schema';
import { surrealDBTestConfig } from '../adapters/surrealDB/mocks/config';
import { typeDBTestConfig } from '../adapters/typeDB/mocks/config';
import { postgresDBTestConfig } from '../adapters/postgresDB/mocks/config';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const adapter = process.env.BORM_TEST_ADAPTER;

if (!adapter) {
	throw new Error('BORM_TEST_ADAPTER is not defined');
}

if (['postgresDB', 'surrealDB', 'typeDB'].includes(adapter) === false) {
	throw new Error(`Unsupported adapter "${adapter}"`);
}

const config =
	adapter === 'postgresDB' ? postgresDBTestConfig : adapter === 'surrealDB' ? surrealDBTestConfig : typeDBTestConfig;

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
