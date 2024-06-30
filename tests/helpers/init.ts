import { setup } from './setup';
import { schema } from '../mocks/schema';
import { surrealDBTestConfig } from '../adapters/surrealDB/mocks/config';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const adapter = process.env.BORM_TEST_ADAPTER;

if (!adapter) {
	throw new Error('BORM_TEST_ADAPTER is not defined');
}

if (['surrealDB', 'typeDB'].includes(adapter) === false) {
	throw new Error(`Unsupported adapter "${adapter}"`);
}
//console.log('adapter', adapter);

const config = adapter === 'surrealDB' ? surrealDBTestConfig : {};

export const init = async () =>
	setup({
		//@ts-expect-error TODO
		config,
		schema,
		tqlPathMap: {},
	});
[];
