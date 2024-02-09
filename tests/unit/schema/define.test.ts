import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';

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
	}, 25000);

	it('Todo:b1[create] Basic', async () => {
		/*
    todo: Now we can't use the name of the relation if the relation has been extended. 
    */
		expect(bormClient).toBeDefined();

		await bormClient.define();
	});

	afterAll(async () => {
		await cleanup(bormClient, dbName);
	});
});
