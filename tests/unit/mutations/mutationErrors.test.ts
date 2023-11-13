import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';

describe('Mutations: Errors', () => {
	let dbName: string;
	let bormClient: BormClient;

	beforeAll(async () => {
		const { dbName: configDbName, bormClient: configBormClient } = await init();
		if (!configBormClient) {
			throw new Error('Failed to initialize BormClient');
		}
		dbName = configDbName;
		bormClient = configBormClient;
	}, 20000);

	it('e1[duplicate] Duplicate creation', async () => {
		expect(bormClient).toBeDefined();

		await expect(
			bormClient.mutate({
				$relation: 'User-Accounts',
				id: 'r1',
				user: {
					'id': 'u2',
					'user-tags': [
						{ id: 'ustag1', color: { id: 'pink' } },
						{ id: 'ustag2', color: { id: 'pink' } },
					],
				},
			}),
		).rejects.toThrowError('Duplicate id pink');
	});

	it('e2[relation] Error for match and $id not found', async () => {
		expect(bormClient).toBeDefined();

		const mutation = {
			$relation: 'UserTagGroup',
			$id: 'tmp-user-tag-group',
			tags: [{ $op: 'link', $id: 'tag-1' }],
		};

		const res = await bormClient.mutate(mutation);
		// console.log('res', res);
		expect(res).toStrictEqual({});
	});

	it('e3[create] Check for no $id field on $op create', async () => {
		expect(bormClient).toBeDefined();

		const mutation = {
			$entity: 'User',
			$op: 'create',
			$id: 'blah',
			name: 'test testerman',
			email: 'test@test.com',
		};

		try {
			await bormClient.mutate(mutation, { noMetadata: true });
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe("Can't write to computed field $id. Try writing to the id field directly.");
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e4[update, nested, error] Update all children error', async () => {
		/// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate(
				{
					$entity: 'Account',
					$id: 'account3-1',
					user: {
						email: 'theNewEmailOfAnn@gmail.com',
					},
				},
				{ noMetadata: true },
			);
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe('Please specify if it is a create or an update. Path: user');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('TODO:e5[relation] breaking the cardinality rule in a batch mutation', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate([
				{
					$entity: 'User',
					name: 'Peter',
					email: 'Peter@test.ru',
					accounts: [{ provider: 'google' }, { $op: 'link', $tempId: '_:acc1' }],
				},
				{
					$tempId: '_:acc1',
					$op: 'create',
					$entity: 'Account',
					provider: 'MetaMask',
					user: { name: 'Peter' },
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'"acc1" is connected to many entities. Entity with ID: acc1 in relation "User-Accounts" linked to multiple 2 entities in role "user".The relation\'s role is of cardinality ONE.\n',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('TODO:e6[tempId] Somwhere there is a tempId that has no definition', async () => {
		expect(bormClient).toBeDefined();
		// todo: antoine query of nested tempIds without op="create"

		try {
			await bormClient.mutate([
				{
					$entity: 'User',
					name: 'Peter',
					email: 'Peter@test.ru',
					accounts: [{ provider: 'google' }, { $op: 'link', $tempId: '_:acc1' }],
				},
				{
					$tempId: '_:acc1',
					$op: 'create',
					$entity: 'Account',
					provider: 'MetaMask',
					user: { name: 'Peter' },
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'"acc1" is connected to many entities. Entity with ID: acc1 in relation "User-Accounts" linked to multiple 2 entities in role "user".The relation\'s role is of cardinality ONE.\n',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e7a[tempId, deletion] Delete tempId', async () => {
		expect(bormClient).toBeDefined();
		// todo: antoine query of nested tempIds without op="create"

		try {
			await bormClient.mutate([
				{
					$entity: 'User',
					name: 'Peter',
					email: 'Peter@test.ru',
					accounts: [{ provider: 'google', $tempId: '_:acc1', $op: 'delete' }],
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'Invalid op delete for tempId. TempIds can be created, or when created in another part of the same mutation. In the future maybe we can use them to catch stuff in the DB as well and group them under the same tempId.',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e7b[tempId, unlink] Unlink tempId', async () => {
		expect(bormClient).toBeDefined();
		// todo: antoine query of nested tempIds without op="create"

		try {
			await bormClient.mutate([
				{
					$entity: 'User',
					name: 'Peter',
					email: 'Peter@test.ru',
					accounts: [{ provider: 'google', $tempId: '_:acc1', $op: 'unlink' }],
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'Invalid op unlink for tempId. TempIds can be created, or when created in another part of the same mutation. In the future maybe we can use them to catch stuff in the DB as well and group them under the same tempId.',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e8a[multi, create, link] Uncompatible tempId ops', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate([
				{
					$relation: 'UserTagGroup',
					$tempId: '_:utg1',
					$op: 'create',
				},
				{
					$relation: 'UserTag',
					name: 'hey',
					users: [{ name: 'toDelete' }],
					group: { $tempId: '_:utg1', $op: 'create' },
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'Unsupported operation combination for $tempId "utg1". Existing: create. Current: create',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});
	it('TODO:e8b[multi, create, link] Uncompatible tempId ops', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate([
				{
					$relation: 'UserTagGroup',
					$tempId: '_:utg1',
					$op: 'link',
				},
				{
					$relation: 'UserTag',
					name: 'hey',
					users: [{ name: 'toDelete' }],
					group: { $tempId: '_:utg1', $op: 'link' },
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('Cannot link a $tempId that has not been created in the current mutation');
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m1d[delete, missing] Delete a non existing $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'delete', $id: 'jnsndadsn' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				//not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
				// expect(error.message).toBe('[BQLE-Q-M-1] Cannot delete $id:"jnsndadsn" because it does not exist in the DB');
				expect(error.message).toBe(
					'[BQLE-Q-M-2] Cannot delete $id:"jnsndadsn" because it is not linked to $id:"tag-1"',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('TODO:m1l[link, missing] Link a non existing $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'link', $id: 'jnsndadsn' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('[BQLE-Q-M-1] Cannot link $id:"jnsndadsn" because it does not exist in the DB');
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m1up[update, missing] Update a non existing $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'update', $id: 'jnsndadsn', name: 'new' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				//not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
				// expect(error.message).toBe('[BQLE-Q-M-1] Cannot update $id:"jnsndadsn" because it does not exist in the DB');
				expect(error.message).toBe(
					'[BQLE-Q-M-2] Cannot update $id:"jnsndadsn" because it is not linked to $id:"tag-1"',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m1un[unlink, missing] Unlink a non existing $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'unlink', $id: 'jnsndadsn' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				//not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
				// expect(error.message).toBe('[BQLE-Q-M-1] Cannot unlink $id:"jnsndadsn" because it does not exist in the DB');
				expect(error.message).toBe(
					'[BQLE-Q-M-2] Cannot unlink $id:"jnsndadsn" because it is not linked to $id:"tag-1"',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m2d[delete, missing] Delete a non related $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'delete', $id: 'user3' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				//not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
				expect(error.message).toBe('[BQLE-Q-M-2] Cannot delete $id:"user3" because it is not linked to $id:"tag-1"');
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m2up[update, missing] Update a non related $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'update', $id: 'user3', name: 'new' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('[BQLE-Q-M-2] Cannot update $id:"user3" because it is not linked to $id:"tag-1"');
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m2un[unlink, missing] Unlink a non related $id', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate({
				$relation: 'UserTag',
				$id: 'tag-1',
				users: [{ $op: 'unlink', $id: 'user3' }],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('[BQLE-Q-M-2] Cannot unlink $id:"user3" because it is not linked to $id:"tag-1"');
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e-v1[virtual] Cant insert virtual', async () => {
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate([
				{
					$entity: 'Color',
					isBlue: false,
				},
			]);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('Virtual fields can\'t be sent to DB: "isBlue"');
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e-pq1[create, nested] With pre-query, link when there is already something error', async () => {
		/// this requires pre-queries when using typeDB because it must understand there is already something and throw an error
		expect(bormClient).toBeDefined();

		try {
			await bormClient.mutate(
				{
					$entity: 'Account',
					$id: 'account3-1',
					user: {
						$op: 'link',
						email: 'theNewEmailOfAnn@gmail.com',
					},
				},
				{ noMetadata: true },
			);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'[BQLE-Q-M-2] Cannot link on:"root-account3-1.user" because it is already occupied.',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	afterAll(async () => {
		await cleanup(dbName);
	});
});
