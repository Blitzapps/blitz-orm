import 'jest';

import { createTest } from '../../helpers/createTest';

export const testMutationErrors = createTest('Mutation: Errors', (client) => {
	it('e1[duplicate] Duplicate creation', async () => {
		expect(client).toBeDefined();

		await expect(
			client.mutate({
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
		).rejects.toThrow('Duplicate id pink');
	});

	it('e2[relation] Error for match and $id not found', async () => {
		expect(client).toBeDefined();

		const mutation = {
			$relation: 'UserTagGroup',
			$id: 'non-existing-user-tag-group',
			tags: [{ $op: 'link', $id: 'tag-1' }],
		};

		const res = await client.mutate(mutation);
		// console.log('res', res);
		expect(res).toStrictEqual([
			{
				$id: 'non-existing-user-tag-group',
				$error: "Does not exist or it's not linked to the parent",
			},
		]);
	});

	it('e3[create] Check for no $id field on $op create', async () => {
		expect(client).toBeDefined();

		const mutation = {
			$entity: 'User',
			$op: 'create',
			$id: 'blah',
			name: 'test testerman',
			email: 'test@test.com',
		};

		try {
			await client.mutate(mutation, { noMetadata: true });
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					"[Wrong format] Can't write to computed field $id. Try writing to the id field directly.",
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('e4[update, nested, error] Update all children error', async () => {
		/// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
		expect(client).toBeDefined();

		try {
			await client.mutate(
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
				expect(error.message).toBe('Please specify if it is a create or an update. Path: $root.0.user');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('TODO:e5[relation] breaking the cardinality rule in a batch mutation', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate([
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
		expect(client).toBeDefined();
		// todo: antoine query of nested tempIds without op="create"

		try {
			await client.mutate([
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
		expect(client).toBeDefined();
		// todo: antoine query of nested tempIds without op="create"

		try {
			await client.mutate([
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

	it('e8a[multi, create, link] Incompatible tempId ops', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate([
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
					'[Wrong format] Wrong operation combination for $tempId "utg1". Existing: create. Current: create',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});
	it('e8b[multi, create, link] Incompatible tempId ops', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate([
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
				expect(error.message).toBe("Can't link a $tempId that has not been created in the current mutation: utg1");
			} else {
				expect(true).toBe(false);
			}

			return;
		}

		throw new Error('Expected mutation to throw an error');
	});

	it('m1d[delete, missing] Delete a non existing $id', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$relation: 'UserTag',
					$id: 'tag-1',
					users: [{ $op: 'delete', $id: 'jnsndadsn' }],
				},
				{ preQuery: true },
			);
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
		expect(client).toBeDefined();
		// needs more than regular pre query
		try {
			await client.mutate({
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
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$relation: 'UserTag',
					$id: 'tag-1',
					users: [{ $op: 'update', $id: 'jnsndadsn', name: 'new' }],
				},
				{ preQuery: true },
			);
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
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$relation: 'UserTag',
					$id: 'tag-1',
					users: [{ $op: 'unlink', $id: 'jnsndadsn' }],
				},
				{ preQuery: true },
			);
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
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$relation: 'UserTag',
					$id: 'tag-1',
					users: [{ $op: 'delete', $id: 'user3' }],
				},
				{ preQuery: true },
			);
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
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$relation: 'UserTag',
					$id: 'tag-1',
					users: [{ $op: 'update', $id: 'user3', name: 'new' }],
				},
				{ preQuery: true },
			);
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
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$relation: 'UserTag',
					$id: 'tag-1',
					users: [{ $op: 'unlink', $id: 'user3' }],
				},
				{ preQuery: true },
			);
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
		expect(client).toBeDefined();

		try {
			await client.mutate([
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
		/// link stuff is bypassed now, must work once we run pre-queries with link queries as well
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$entity: 'Account',
					$id: 'account3-1',
					user: {
						$op: 'link',
					},
				},
				{ noMetadata: true, preQuery: true },
			);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'[BQLE-Q-M-2] Cannot link on:"root.account3-1___user" because it is already occupied.',
				);
			} else {
				expect(true).toBe(false);
			}

			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	it('e-c1d[create, nested delete] With pre-query, cannot delete under a create', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$entity: 'Account',
					$op: 'create',
					user: {
						$op: 'delete',
					},
				},
				{ noMetadata: true, preQuery: true },
			);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('[Wrong format] Cannot delete under a create');
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	it('e-c1ul[create, nested unlink] With pre-query, cannot unlink under a create', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$entity: 'Account',
					$op: 'create',
					user: {
						$op: 'unlink',
						email: 'theNewEmailOfAnn@gmail.com',
					},
				},
				{ noMetadata: true, preQuery: true },
			);
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('[Wrong format] Cannot unlink under a create');
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	it('TODO:e-id1[replace, many, wrongId] Replace many by non existing field', async () => {
		expect(client).toBeDefined();

		/// create
		await client.mutate({
			$relation: 'UserTagGroup',
			$op: 'create',
			id: 'tmpUTG1',
			tags: ['tag-1', 'tag-2'], //no color
		});
		await client.mutate({
			$relation: 'UserTagGroup',
			$op: 'create',
			id: 'tmpUTG2',
			tags: ['tag-1', 'tag-3'],
			color: 'blue',
		});

		try {
			await client.mutate({
				$id: ['tmpUTG1', 'tmpUTG2'],
				$relation: 'UserTagGroup',
				$op: 'update',
				tags: ['tag-4'],
				color: 'red',
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('Cannot replace with non-existing id "red"');
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');

		//clean changes by deleting the new tmpUTG
		await client.mutate({
			$relation: 'UserTagGroup',
			$id: ['tmpUTG1', 'tmpUTG2'],
			$op: 'delete',
		});
	});

	it('TODO:e-lm[link and unlink many] linking to things that do not exist', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate({
				$relation: 'Field',
				id: 'ul-many',
				kinds: [
					{
						$relation: 'Kind',
						$id: 'k1',
					},
					{
						$relation: 'Kind',
						$id: 'k2',
					},
					{
						$relation: 'Kind',
						$id: 'k3',
					},
				],
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('Linking to things that do not exist');
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	it("vi1[create, virtual, error] Can't set virtual fields", async () => {
		/// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$entity: 'Account',
					id: 'newAccount',
					provider: 'gmail',
					isSecureProvider: true,
				},
				{ noMetadata: true },
			);
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe('Virtual fields can\'t be sent to DB: "isSecureProvider"');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('tid1[tempId, format]', async () => {
		/// throw an error when a tempId does not have the _: format
		expect(client).toBeDefined();

		try {
			await client.mutate(
				{
					$entity: 'Account',
					$tempId: 'wronglyFormattedTempId',
					provider: 'gmail',
				},
				{ noMetadata: true },
			);
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe('[Wrong format] TempIds must start with "_:"');
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it("e-or1[orphan, relation] Can't create an orphan relation, but can create if its linked elsewhere", async () => {
		/// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
		expect(client).toBeDefined();

		try {
			await client.mutate(
				[
					{
						$relation: 'Kind',
						id: 'or1-k-1',
						name: 'randomName',
					},
					//adding another relation so the mergedEdges is not empty
					{
						$relation: 'User-Accounts',
						id: 'or1-ua-1',
						user: { id: 'or1-u-1' },
					},
				],

				{ noMetadata: true },
			);
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe(
					'[Wrong format] Can\'t create a relation without any player. Node: {"name":"randomName","id":"or1-k-1"}',
				);
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}

		await client.mutate(
			[
				{
					$relation: 'Kind',
					$tempId: '_:or1-k-2',
					id: 'or1-k-2',
				},
				{
					$entity: 'Space',
					$id: 'space-3',
					kinds: [{ $op: 'link', $tempId: '_:or1-k-2' }],
				},
			],
			{ preQuery: true },
		);

		const res = await client.query(
			{
				$relation: 'Kind',
				$id: 'or1-k-2',
			},
			{ noMetadata: true },
		);

		expect(res).toStrictEqual({ id: 'or1-k-2', space: 'space-3' });

		//CLEAN
		await client.mutate([
			{
				$relation: 'Kind',
				$id: 'or1-k-2',
				$op: 'delete',
			},
		]);
	});
	it('e-or2[orphan, relation] Creating a relation without anything that links', async () => {
		expect(client).toBeDefined();

		try {
			await client.mutate({
				$relation: 'Field',
				id: 'ul-many',
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe(
					'[Wrong format] Can\'t create a relation without any player. Node: {"id":"ul-many"}',
				);
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	it("f1[format] Can't filter by $id when creating its parent", async () => {
		expect(client).toBeDefined();
		try {
			await client.mutate({
				$thing: 'Thing',
				$thingType: 'entity',
				id: 'temp1',
				root: {
					$id: 'tr10',
					extra: 'thing2',
				},
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe('[Wrong format] Cannot update under a create');
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');
	});
});
