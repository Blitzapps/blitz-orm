import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';

describe('Mutations: PreHooks', () => {
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

	it('vfla1[validation, functions, local, attribute] Basic', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'Kind',
				id: 'kind1',
				name: 'Tyrannosaurus name',
			});
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe('[PreHook] Name must not exist, or be less than 15 characters.');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	afterAll(async () => {
		await cleanup(dbName);
	});
});
