import { deepSort } from '../../helpers/matchers';
import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';

export const testMutationPrehooks = createTest('Mutation: PreHooks', (ctx) => {
	// field level

	it('df[default, field] Default field', async () => {
		await ctx.mutate({
			$entity: 'Hook',
			id: 'hookDf1',
			requiredOption: 'b',
		});

		const res = await ctx.query(
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

		expect(timestamp instanceof Date).toBeTruthy();
		expect(timestamp >= twoMinutesAgo && timestamp <= currentTime).toBeTruthy();

		//cleanup
		await ctx.mutate({
			$entity: 'Hook',
			$op: 'delete',
			$id: 'hookDF11',
		});
	});

	it('rf[required, field] Required field', async () => {
		try {
			await ctx.mutate({
				$entity: 'Hook',
				id: 'hook1',
			});

			//cleanup
			await ctx.mutate({
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
		try {
			await ctx.mutate({
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
		try {
			await ctx.mutate({
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

	it('vfl1[validation, functions, local, thing] Basic', async () => {
		try {
			await ctx.mutate({
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

	it('vfl2[validation, functions, local, attribute] Function', async () => {
		try {
			await ctx.mutate({
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

	it('vfl3[validation, functions, local, attribute] FUnction with custom error', async () => {
		try {
			await ctx.mutate({
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

	it('vfr1[validation, functions, remote, parent] Validate considering the parent', async () => {
		try {
			await ctx.mutate({
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

	it('vflr2[validation, functions, remote, things] Check nested array', async () => {
		try {
			await ctx.mutate({
				$relation: 'Kind',
				id: 'kind1',
				fields: [{ name: 'forbiddenName' }],
			});
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe("[Validations:thing:Kind] You can't have a field named 'forbiddenName'");
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('TODO:vflr3[validation, functions, nested, things] Check nested array, card ONE', async () => {
		try {
			await ctx.mutate({
				$relation: 'HookATag',
				id: 'vfla6-1-hey',
				hookTypeA: { requiredOption: 'a' },
			});
			// If the code doesn't throw an error, fail the test
			expect(true).toBe(false);
		} catch (error) {
			if (error instanceof Error) {
				// Check if the error message is exactly what you expect
				expect(error.message).toBe("[Validations:thing:Kind] You can't have a field named 'forbiddenName'");
			} else {
				// If the error is not of type Error, fail the test
				expect(true).toBe(false);
			}
		}
	});

	it('tn1[transform, node] Transform node depending on attribute', async () => {
		await ctx.mutate(
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

		const res = await ctx.query(
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
		try {
			await ctx.mutate(
				{
					$thing: 'User',
					id: 'tn2-u1',
					name: 'cheatCode',
				},
				{ noMetadata: true },
			);

			const res = await ctx.query(
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
			await ctx.mutate({
				$thing: 'User',
				$thingType: 'entity',
				$op: 'delete',
				$id: 'tn2-u1',
			});
		}
	});

	it('tn3[transform, inherited] Append children to node', async () => {
		try {
			await ctx.mutate(
				{
					$thing: 'Kind',
					id: 'secret-kind-tn3',
					space: 'space-1',
				},
				{ noMetadata: true },
			);

			const res = await ctx.query(
				{
					$thing: 'Kind',
					$thingType: 'relation',
					$id: 'secret-kind-tn3-YES!',
				},
				{ noMetadata: true },
			);
			expect(res).toEqual({
				id: 'secret-kind-tn3-YES!',
				space: 'space-1',
			});
		} finally {
			//clean
			await ctx.mutate({
				$thing: 'Kind',
				$thingType: 'relation',
				$op: 'delete',
				$ids: ['secret-kind-tn3', 'secret-kind-tn3-YES!'],
			});
		}
	});

	it('tt1[transform, temp props] Transform using %vars', async () => {
		try {
			await ctx.mutate(
				{
					'$thing': 'User',
					'id': 'tt1-u1',
					'%name': 'Sinatra',
				},
				{ noMetadata: true },
			);

			const res = await ctx.query(
				{
					$thing: 'User',
					$thingType: 'entity',
					$id: 'tt1-u1',
				},
				{ noMetadata: true },
			);
			expect(res).toEqual({
				id: 'tt1-u1',
				name: 'secret-Sinatra',
			});
		} finally {
			//clean
			await ctx.mutate({
				$thing: 'User',
				$thingType: 'entity',
				$id: 'tt1-u1',
				$op: 'delete',
			});
		}
	});

	it('ctx1[transform, context] Use context', async () => {
		try {
			await ctx.mutate(
				{
					$thing: 'User',
					id: 'ctx1-u1',
					name: 'cheatCode2',
				},
				{ noMetadata: true, context: { spaceId: 'mySpace' } },
			);

			const res = await ctx.query(
				{
					$thing: 'User',
					$thingType: 'entity',
					$id: 'ctx1-u1',
					$fields: ['id', 'name', { $path: 'spaces', $fields: ['id', 'name'] }],
				},
				{ noMetadata: true },
			);

			expect(deepSort(res, 'id')).toEqual({
				id: 'ctx1-u1',
				name: 'cheatCode2',
				spaces: [{ id: 'mySpace' }],
			});
		} finally {
			//clean
			await ctx.mutate({
				$thing: 'User',
				$thingType: 'entity',
				$op: 'delete',
				$id: 'tn2-u1',
			});
		}
	});

	it('tf1[transform, fields] Use $fields for dbNode', async () => {
		try {
			await ctx.mutate([
				{
					$entity: 'User',
					id: 'mf1-user',
					name: 'John',
					email: 'john@email.com',
					spaces: [
						{
							id: 'mf1-space',
							dataFields: [
								{
									id: 'mf1-dataField-1',
									values: [
										{
											id: 'mf1-dataValue',
										},
									],
									expression: { $op: 'create', id: 'mf1-expression-1' },
								},
								{
									id: 'mf1-dataField-2',
									values: [{ id: 'mf1-dataValue-2' }],
								},
								{
									id: 'mf1-dataField-3',
									expression: { $op: 'create', id: 'mf1-expression-2' },
								},
								{
									id: 'mf1-dataField-4',
								},
							],
						},
					],
				},
			]);

			/// This test throws an error if failed, it happens inside the transformation itself
			await ctx.mutate({
				$thing: 'User',
				$id: 'mf1-user',
				name: 'Jack',
				$fields: ['email', { $path: 'spaces', $fields: [{ $path: 'dataFields', $fields: ['values', 'expression'] }] }],
			});
		} finally {
			//clean
			await ctx.mutate({
				$thing: 'User',
				$thingType: 'entity',
				$op: 'delete',
				$id: 'mf1-user',
			});
		}
	});

	it('tf2[transform, fields] Use $fields for dbNode nested', async () => {
		try {
			// console.log('===== CREATING =====');

			await ctx.mutate([
				{
					$entity: 'User',
					id: 'mf2-user',
					name: 'John',
					email: 'john@email.com',
					spaces: [
						{
							id: 'mf2-space',
							dataFields: [
								{
									id: 'mf2-dataField-1',
									values: [
										{
											id: 'mf2-dataValue-1',
										},
									],
									expression: { $op: 'create', id: 'mf2-expression-1' },
								},
								{
									id: 'mf2-dataField-2',
									values: [{ id: 'mf2-dataValue-2' }],
								},
								{
									id: 'mf2-dataField-3',
									expression: { $op: 'create', id: 'mf2-expression-2' },
								},
								{
									id: 'mf2-dataField-4',
								},
							],
						},
					],
				},
			]);

			// console.log('===== MUTATING =====');

			await ctx.mutate({
				$thing: 'User',
				$id: 'mf2-user',
				name: 'Jack',
				spaces: [
					{
						dataFields: [
							{
								values: [{ $fields: ['id', 'type'], type: 'test-type', $op: 'update' }],
								expression: { $fields: ['id', 'type'], type: 'test-type', $op: 'update' },
								$fields: ['values', 'expression'],
								type: 'test-type',
								$op: 'update',
							},
						],
						$fields: ['id', 'dataFields'],
						$op: 'update',
					},
				],
				$fields: ['id', 'email'],
			});
		} finally {
			//clean
			await ctx.mutate({
				$thing: 'User',
				$thingType: 'entity',
				$op: 'delete',
				$id: 'mf2-user',
			});
		}
	});

	it('tf3[transform, fields] Use $fields for transformation', async () => {
		try {
			await ctx.mutate([
				{
					$thing: 'Color',
					$fields: ['id', 'value'],
					id: 'color-test',
					value: 'gold',
				},
			]);

			const res1 = await ctx.query(
				{
					$thing: 'Color',
					$thingType: 'entity',
					$id: 'color-test',
					$fields: ['id', 'value'],
				},
				{ noMetadata: true },
			);

			expect(res1).toEqual({
				id: 'color-test',
				value: 'gold',
			});

			await ctx.mutate([
				{
					$thing: 'Color',
					$fields: ['id', 'value'],
					$id: 'color-test',
					value: 'gold',
				},
			]);

			const res2 = await ctx.query(
				{
					$thing: 'Color',
					$thingType: 'entity',
					$id: 'color-test',
					$fields: ['id', 'value'],
				},
				{ noMetadata: true },
			);

			expect(res2).toEqual({
				id: 'color-test',
				value: 'bronze',
			});

			// await bormClient.mutate({
			// 	$thing: 'User',
			// 	$id: 'mf1-user',
			// 	name: 'Jack',
			// 	$fields: ['email', { $path: 'spaces', $fields: [{ $path: 'dataFields', $fields: ['values', 'expression'] }] }],
			// });
		} finally {
			//clean
			await ctx.mutate({
				$thing: 'Color',
				$thingType: 'entity',
				$id: 'gold',
				$op: 'delete',
			});
		}
	});

	it('TODO:tf4[transform, fields] Use $fields for nested transformations with same types', async () => {
		// this test should pass when we add more protections over nested $ids not being the same as parent $ids in a mutation
		try {
			await ctx.mutate([
				{
					$relation: 'CascadeRelation',
					id: 'cr-1',
					things: [
						{
							id: 't-1',
							cascadeRelations: [
								{
									id: 'cr-2',
									things: [
										{
											id: 't-3',
										},
										{
											id: 't-4',
										},
									],
								},
								{
									id: 'cr-3',
									things: [
										{
											id: 't-5',
										},
										{
											id: 't-6',
										},
									],
								},
							],
						},
						{
							id: 't-2',
							cascadeRelations: [
								{
									id: 'cr-4',
									things: [
										{
											id: 't-7',
										},
										{
											id: 't-8',
										},
									],
								},
								{
									id: 'cr-5',
									things: [
										{
											id: 't-9',
										},
										{
											id: 't-10',
										},
									],
								},
							],
						},
					],
				},
			]);

			const q1 = await ctx.query({
				$thing: 'CascadeRelation',
				$thingType: 'relation',
				$id: 'cr-1',
				$fields: ['things'],
			});

			const q2 = await ctx.query(
				{
					$thing: 'CascadeThing',
					$thingType: 'entity',
					$fields: ['id'],
				},
				{ noMetadata: true },
			);

			expect(deepSort(q1, 'id')).toEqual({
				things: ['t-1', 't-2'],
				$thing: 'CascadeRelation',
				$thingType: 'relation',
				$id: 'cr-1',
			});

			expect(deepSort(q2, 'id')).toEqual([
				{
					id: 't-1',
				},
				{
					id: 't-10',
				},
				{
					id: 't-2',
				},
				{
					id: 't-3',
				},
				{
					id: 't-4',
				},
				{
					id: 't-5',
				},
				{
					id: 't-6',
				},
				{
					id: 't-7',
				},
				{
					id: 't-8',
				},
				{
					id: 't-9',
				},
			]);

			await ctx.mutate({
				$thing: 'CascadeRelation',
				$id: 'cr-1',
				$op: 'delete',
				$fields: ['things'],
			});

			const q3 = await ctx.query({
				$thing: 'CascadeRelation',
				$thingType: 'relation',
				$id: 'cr-1',
				$fields: ['things'],
			});

			const q4 = await ctx.query({
				$thing: 'CascadeThing',
				$thingType: 'entity',
			});

			expect(q3).toEqual(null);
			expect(q4).toEqual(null);
		} finally {
			// //clean
			// await bormClient.mutate({
			// 	$thing: 'User',
			// 	$thingType: 'entity',
			// 	$op: 'delete',
			// 	$id: 'mf2-user',
			// });
		}
	});

	it('tf5[transform, fields] Use $fields nested looping through transformations', async () => {
		try {
			await ctx.mutate([
				{
					$entity: 'User',
					id: 'mf5-user',
					name: 'John',
					email: 'john@email.com',
					spaces: [
						{
							id: 'mf5-space',
							dataFields: [
								{
									id: 'mf5-dataField-1',
								},
								{
									id: 'mf5-dataField-2',
								},
								{
									id: 'mf5-dataField-3',
								},
								{
									id: 'mf5-dataField-4',
								},
							],
						},
					],
				},
			]);

			// cascade delete

			await ctx.mutate([
				{
					$entity: 'User',
					$id: 'mf5-user',
					$op: 'delete',
					$fields: ['spaces'],
				},
			]);

			await ctx.query([
				{
					$entity: 'User',
					$id: 'mf5-user',
				},
			]);

			const res = await ctx.query([
				{
					$entity: 'User',
					$id: 'mf5-user',
				},
				{
					$entity: 'Space',
					$id: 'mf5-space',
				},
				{
					$relation: 'DataField',
					$id: ['mf5-dataField-1', 'mf5-dataField-4', 'mf5-dataField-3', 'mf5-dataField-4'],
				},
			]);

			expect(res).toEqual([null, null, null]);
		} finally {
			// //clean
			// await bormClient.mutate({
			// 	$thing: 'User',
			// 	$thingType: 'entity',
			// 	$op: 'delete',
			// 	$id: 'mf2-user',
			// });
		}
	});

	it('tf6', async () => {
		await ctx.mutate([
			{
				$entity: 'User',
				id: 'mf6-user',
				name: 'John',
				email: 'john@email.com',
				spaces: [
					{
						id: 'mf6-space',
						name: 'My space',
						dataFields: [
							{
								id: 'mf6-dataField-1',
								type: 'TEXT',
								computeType: 'COMPUTED',
							},
							{
								id: 'mf6-dataField-2',
								type: 'EMAIL',
								computeType: 'EDITABLE',
							},
						],
					},
				],
			},
		]);

		await ctx.mutate([
			{
				$op: 'update',
				$entity: 'User',
				$id: ['mf6-user'],
				$fields: ['spaces', 'email', { $path: 'spaces', $fields: ['name'] }],
				email: 'jhon@gmail.com',
				spaces: [
					{
						$op: 'update',
						// $id: 'mf6-space',
						$fields: ['dataFields', 'name'],
						name: 'Our space',
						dataFields: [
							{
								$op: 'update',
								$id: ['mf6-dataField-1', 'mf6-dataField-2'],
								$fields: ['type'],
								type: 'NUMBER',
							},
							// {
							// 	$op: 'update',
							// 	$id: 'mf6-dataField-2',
							// 	$fields: ['computeType'],
							// 	type: 'NUMBER',
							// },
						]
					}
				]
			},
		]);
	});
});
