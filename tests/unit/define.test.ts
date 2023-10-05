import 'jest';

import type BormClient from '../../src/index';
import { cleanup, init } from '../helpers/lifecycle';

describe('Mutation init', () => {
	let dbName: string;
	let bormClient: BormClient;

	beforeAll(async () => {
		const { dbName: configDbName, bormClient: configBormClient } = await init();
		if (!configBormClient) {
			throw new Error('Failed to initialize BormClient');
		}
		dbName = configDbName;
		bormClient = configBormClient;
	}, 15000);

	it('b1[create] Basic', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.define();
	});

	afterAll(async () => {
		await cleanup(dbName);
	});
});
