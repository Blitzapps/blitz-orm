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

	// field level

	it('df[default, field] Default field', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate({
			$entity: 'Hook',
			id: 'hook1',
			requiredOption: 'b',
		});

		const res = await bormClient.query(
			{
				$entity: 'Hook',
				$id: 'hook1',
				$fields: ['id', 'timestamp'],
			},
			{ noMetadata: true },
		);

		//@ts-expect-error - TODO description
		const timestamp = new Date(res.timestamp);
		const currentTime = new Date();
		const twoMinutesAgo = new Date(currentTime.getTime() - 62 * 60 * 1000); //62 minutes ago because there is a bug that reduces -1 hours in local machine

		expect(timestamp instanceof Date).toBe(true);
		expect(timestamp >= twoMinutesAgo && timestamp <= currentTime).toBe(true);

		//cleanup
		await bormClient.mutate({
			$entity: 'Hook',
			$op: 'delete',
			id: 'hook1',
		});
	});

	it('rf[required, field] Required field', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$entity: 'Hook',
				id: 'hook1',
			});

			//cleanup
			await bormClient.mutate({
				$entity: 'Hook',
				$op: 'delete',
				id: 'hook1',
			});
		} catch (error) {
			if (error instanceof Error) {
				expect(error.message).toBe('[Validations] Required field "requiredOption" is missing.');
			} else {
				expect(true).toBe(false);
			}
		}
	});

	it('ef1[enum, field, one] Enum field cardinality one', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$entity: 'Hook',
				id: 'hook1',
				requiredOption: 'd',
			});
		} catch (error) {
			if (error instanceof Error) {
				expect(error.message).toBe('[Validations] Option "d" is not a valid option for field "requiredOption".');
			} else {
				expect(true).toBe(false);
			}
		}
	});

	it('ef2[enum, field, many] Enum field cardinality one', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$entity: 'Hook',
				id: 'hook1',
				requiredOption: 'c',
				manyOptions: ['a', 'd'],
			});
		} catch (error) {
			if (error instanceof Error) {
				expect(error.message).toBe('[Validations] Option "d" is not a valid option for field "manyOptions".');
			} else {
				expect(true).toBe(false);
			}
		}
	});

	// node level

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
				expect(error.message).toBe('[Validations:thing:Kind] Name must not exist, or be less than 15 characters.');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('vfla2[validation, functions, local, attribute] Function', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$entity: 'Hook',
				fnValidatedField: 'something@test.es',
			});
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe('[Validations:attribute:fnValidatedField] Failed validation function.');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('vfla3[validation, functions, local, attribute] FUnction with custom error', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$entity: 'Hook',
				fnValidatedField: 'secretTesthe@test.es',
			});
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe(
					'[Validations:attribute:fnValidatedField] "secretTesthe@test.es" starts with "secretTest" and that\'s not allowed.',
				);
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
