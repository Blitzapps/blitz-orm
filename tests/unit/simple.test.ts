import 'jest';

import type BormClient from '../../src';
import { cleanup, init } from '../helpers/lifecycle';

describe('Simple test', () => {
	let client: BormClient;
	let dbName: string;

	beforeAll(async () => {
		const { dbName: configDbName, bormClient: configBormClient } = await init();
		if (!configBormClient) {
			throw new Error('Failed to initialize BormClient');
		}
		dbName = configDbName;
		client = configBormClient;
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
