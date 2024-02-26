import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';
import { deepSort } from '../../helpers/matchers';

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
	}, 25000);

	// field level

	it('df[default, field] Default field', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate({
			$entity: 'Hook',
			id: 'hookDf1',
			requiredOption: 'b',
		});

		const res = await bormClient.query(
			{
				$entity: 'Hook',
				$id: 'hookDf1',
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
			$id: 'hookDF11',
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

	it('vfla1[validation, functions, local, thing] Basic', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'Kind',
				id: 'kind1',
				name: 'Tyrannosaurus name',
				space: 'space-3',
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
				requiredOption: 'a',
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
				requiredOption: 'a',
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

	it('vfla4[validation, functions, remote, parent] Validate considering the parent', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$entity: 'Hook',
				id: 'hook-c0',
				requiredOption: 'a',
				asMainHookOf: {
					id: 'doesHaveheyYes',
					hooks: [
						{
							id: 'hook-c1',
							requiredOption: 'a',
						},
						{ id: 'hook-c2', requiredOption: 'a' },
					],
					mainHook: {
						id: 'hook-c3',
						requiredOption: 'a',
						asMainHookOf: {
							id: 'p-7',
							hooks: [
								{
									id: 'hook-c4', //this one is the first one that should fail as its parent does not have 'hey'
									requiredOption: 'a',
								},
								{ id: 'hook-c5', requiredOption: 'a' },
							],
						},
					},
				},
			});
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe(
					'[Validations:thing:Hook] The parent of "hook-c4" does not have \'hey\' in its id ("p-7").',
				);
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('tn1[transform, node] Transform node depending on attribute', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
			[
				{
					$relation: 'Kind',
					id: 'tn1-k1',
					name: 'randomName',
					space: 'space-3',
				},
				{
					$relation: 'Kind',
					id: 'tn1-k2',
					name: 'secretName',
					space: 'space-3',
				},
			],

			{ noMetadata: true },
		);

		const res = await bormClient.query(
			{
				$relation: 'Kind',
				$fields: ['id', 'name'],
			},
			{ noMetadata: true },
		);

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'kind-book',
				name: 'book',
			},
			{
				id: 'tn1-k1',
				name: 'randomName',
			},
			{
				id: 'tn1-k2',
				name: 'Not a secret',
			},
		]);
	});

	it('tn2[transform, children] Append children to node', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate(
				{
					$thing: 'User',
					id: 'tn2-u1',
					name: 'cheatCode',
				},
				{ noMetadata: true },
			);

			const res = await bormClient.query(
				{
					$thing: 'User',
					$thingType: 'entity',
					$id: 'tn2-u1',
					$fields: ['id', 'name', { $path: 'spaces', $fields: ['id', 'name'] }],
				},
				{ noMetadata: true },
			);

			expect(deepSort(res, 'id')).toEqual({
				id: 'tn2-u1',
				name: 'cheatCode',
				spaces: [{ id: 'secret', name: 'TheSecretSpace' }],
			});
		} finally {
			//clean
			await bormClient.mutate({
				$thing: 'User',
				$thingType: 'entity',
				$op: 'delete',
				$id: 'tn2-u1',
			});
		}
	});

	afterAll(async () => {
		await cleanup(bormClient, dbName);
	});
});
