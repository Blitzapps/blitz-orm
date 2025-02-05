/* eslint-disable prefer-destructuring */

import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';
import { deepSort } from '../../helpers/matchers';

export const testRefFieldsMutations = createTest('Mutation: RefFields', (ctx) => {
	it('TODO{T}:fl1[ref, one] Create entity with flexible values and read it', async () => {
		/// cardinality ONE
		await ctx.mutate(
			{
				$entity: 'FlexRef',
				id: 'fl1-flexRef',
				reference: { $thing: 'User', $op: 'create', id: 'fl1-user', email: 'f1user@test.it' },
			},
			{ noMetadata: true },
		);

		const res = await ctx.query(
			{
				$entity: 'FlexRef',
				$id: 'fl1-flexRef',
				$fields: ['id', 'reference'],
			},
			{ noMetadata: true },
		);

		//clean up
		await ctx.mutate([
			{
				$id: 'fl1-flexRef',
				$entity: 'FlexRef',
				$op: 'delete',
			},
		]);

		expect(res).toEqual({
			id: 'fl1-flexRef',
			reference: 'fl1-user',
		});
	});

	it('TODO{TS}:fl1r[ref, one, replace]', async () => {});

	it('TODO{T}:fl2[ref, many] Test MANY cardinality with REF type', async () => {
		// Create a FlexRef with multiple references
		await ctx.mutate(
			{
				$thing: 'FlexRef',
				id: 'fl2-ref1',
				references: [
					{ $thing: 'User', id: 'fl2-u1', name: 'User 1' },
					{ $thing: 'User', id: 'fl2-u2', name: 'User 2' },
				],
			},
			{ noMetadata: true },
		);

		// Query to verify the references
		const res = await ctx.query({
			$entity: 'FlexRef',
			$id: 'fl2-ref1',
			$fields: ['id', 'references'],
		});

		// Clean up
		await ctx.mutate([
			{
				$thing: 'FlexRef',
				$op: 'delete',
				$id: 'fl2-ref1',
			},
			{
				$entity: 'User',
				$op: 'delete',
				$id: ['fl2-u1', 'fl2-u2'],
			},
		]);

		expect(res).toMatchObject({
			id: 'fl2-ref1',
			references: ['fl2-u1', 'fl2-u2'],
		});
	});

	it('TODO{TS}:fl2add[ref, many, add] Add to existing', async () => {});

	it('TODO{TS}:fl2rem[ref, many, remove] Remove existing', async () => {});

	it('TODO{TS}:fl2rep[ref, many, replace] Replace existing', async () => {});

	it('TODO{T}:fl3[ref, flex, one] Test ONE cardinality with FLEX type', async () => {
		// Test with reference
		await ctx.mutate(
			[
				{
					$thing: 'FlexRef',
					id: 'fl3-ref1',
					flexReference: 7,
				},
				{
					$thing: 'FlexRef',
					id: 'fl3-ref2',
					flexReference: 'jey',
				},
				{
					$thing: 'FlexRef',
					id: 'fl3-ref3',
					flexReference: { $thing: 'User', id: 'fl3-u1', name: 'User 1' },
				},
			],
			{ noMetadata: true },
		);

		const res = await ctx.query(
			{
				$entity: 'FlexRef',
				$id: ['fl3-ref1', 'fl3-ref2', 'fl3-ref3'],
				$fields: ['id', 'flexReference'],
			},
			{ noMetadata: true },
		);

		//clean before in case of failuer
		await ctx.mutate([
			{
				$thing: 'FlexRef',
				$op: 'delete',
				$id: ['fl3-ref1', 'fl3-ref2', 'fl3-ref3'],
			},
		]);

		//Run the test
		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'fl3-ref1',
				flexReference: 7,
			},
			{
				id: 'fl3-ref2',
				flexReference: 'jey',
			},
			{
				id: 'fl3-ref3',
				flexReference: 'fl3-u1',
			},
		]);
	});

	it('TODO{T}:fl4[ref, flex, many] Test MANY cardinality with FLEX type', async () => {
		// Create with mix of references and data
		await ctx.mutate(
			{
				$thing: 'FlexRef',
				id: 'fl4-ref1',
				flexReferences: [
					'hey',
					{ $thing: 'User', id: 'fl4-u1', name: 'User 1' },
					8,
					{ $thing: 'User', id: 'fl4-u2', name: 'User 2' },
					new Date('2024-01-01'),
				],
			},
			{ noMetadata: true },
		);

		const res = await ctx.query(
			{
				$entity: 'FlexRef',
				$id: 'fl4-ref1',
				$fields: ['id', 'flexReferences'],
			},
			{ noMetadata: true },
		);

		//clean before in case of failure
		await ctx.mutate([
			{
				$thing: 'FlexRef',
				$op: 'delete',
				$id: 'fl4-ref1',
			},
		]);

		//Run the test
		expect(res).toEqual({
			id: 'fl4-ref1',
			flexReferences: ['hey', 'fl4-u1', 8, 'fl4-u2', new Date('2024-01-01').toISOString()],
		});
	});
});
