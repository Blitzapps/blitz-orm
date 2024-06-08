import { deepSort } from '../../helpers/matchers';
import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';

export const testReplaceMutation = createTest('Mutation: Replaces', (ctx) => {
	it('r1[replace] replace single roles in relation', async () => {
		// cardinality one
		await ctx.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr2',
				root: 'thing4',
			},
			{ preQuery: true },
		);

		// cardinality many
		await ctx.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr2',
				things: ['thing4'],
			},
			{ preQuery: true },
		);
		const queryRes = await ctx.query(
			{
				$relation: 'ThingRelation',
				$id: 'tr2',
			},
			{ noMetadata: true },
		);

		expect(queryRes).toBeDefined();
		expect(queryRes).toEqual({
			id: 'tr2',
			things: ['thing4'],
			root: 'thing4',
			extra: 'thing1',
		});
	});

	it('r2[replace] replace many roles in relation', async () => {
		await ctx.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr3',
				root: 'thing4',
				things: ['thing4'],
			},
			{ preQuery: true },
		);

		const queryRes = await ctx.query(
			{
				$relation: 'ThingRelation',
				$id: 'tr3',
			},
			{ noMetadata: true },
		);

		expect(queryRes).toBeDefined();
		expect(queryRes).toEqual({
			id: 'tr3',
			things: ['thing4'],
			root: 'thing4',
			extra: 'thing1',
		});
	});

	it('r3[replace] replace many roles in many relation', async () => {
		await ctx.mutate([
			{
				$relation: 'ThingRelation',
				$id: 'tr4',
				root: 'thing4',
				things: ['thing4'],
			},
			{
				$relation: 'ThingRelation',
				$id: 'tr5',
				root: 'thing4',
				things: ['thing4'],
			},
		]);

		const queryRes = await ctx.query(
			{
				$relation: 'ThingRelation',
				$id: ['tr4', 'tr5'],
			},
			{ noMetadata: true },
		);

		expect(queryRes).toBeDefined();
		expect(deepSort(queryRes, 'id')).toEqual([
			{
				id: 'tr4',
				things: ['thing4'],
				root: 'thing4',
				extra: 'thing1',
			},
			{
				id: 'tr5',
				things: ['thing4'],
				root: 'thing4',
				extra: 'thing1',
			},
		]);
	});

	it('r4[replace] replace depth test', async () => {
		await ctx.mutate({
			'$entity': 'User',
			'$id': 'user3',
			'user-tags': [
				{
					$id: 'tag-2',
					users: ['user3', 'user5'],
				},
			],
		});
		const queryRes = await ctx.query({
			$thing: 'UserTag',
			$thingType: 'relation',
			$id: 'tag-2',
			$fields: ['users'],
		});
		expect(deepSort(queryRes)).toEqual({
			$thing: 'UserTag',
			$thingType: 'relation',
			$id: 'tag-2',
			users: ['user3', 'user5'],
		});

		// revert to original
		await ctx.mutate({
			'$entity': 'User',
			'$id': 'user3',
			'user-tags': [
				{
					$id: 'tag-2',
					users: ['user3', 'user1'],
				},
			],
		});
	});

	it('r5a[replace, unlink, link, many] Replace using unlink + link single role, by IDs', async () => {
		/// create
		await ctx.mutate({
			$relation: 'UserTagGroup',
			$op: 'create',
			id: 'tmpUTG',
			tags: ['tag-1', 'tag-2'],
		});

		/// the mutation to be tested
		await ctx.mutate({
			$id: 'tmpUTG',
			$relation: 'UserTagGroup',
			tags: [
				{ $op: 'link', $id: 'tag-3' },
				{ $op: 'unlink', $id: 'tag-1' },
			],
		});

		const tmpUTG = await ctx.query({
			$relation: 'UserTagGroup',
			$id: 'tmpUTG',
			$fields: ['tags'],
		});

		expect(deepSort(tmpUTG)).toEqual({
			$thing: 'UserTagGroup',
			$thingType: 'relation',
			$id: 'tmpUTG',
			tags: ['tag-2', 'tag-3'],
		});

		//clean changes by deleting the new tmpUTG
		await ctx.mutate({
			$relation: 'UserTagGroup',
			$id: 'tmpUTG',
			$op: 'delete',
		});
	});

	it('r5b[replace, unlink, link, many] Replace using unlink + link single role, by IDs. MultiIds', async () => {
		/// create
		await ctx.mutate({
			$relation: 'UserTagGroup',
			$op: 'create',
			id: 'tmpUTG',
			tags: ['tag-1', 'tag-2', 'tag-3'],
		});

		/// the mutation to be tested
		await ctx.mutate({
			$id: 'tmpUTG',
			$relation: 'UserTagGroup',
			tags: [
				{ $op: 'link', $id: 'tag-4' },
				{ $op: 'unlink', $id: ['tag-1', 'tag-2'] },
			],
		});

		const tmpUTG = await ctx.query({
			$relation: 'UserTagGroup',
			$id: 'tmpUTG',
			$fields: ['tags'],
		});

		expect(deepSort(tmpUTG)).toEqual({
			$thing: 'UserTagGroup',
			$thingType: 'relation',
			$id: 'tmpUTG',
			tags: ['tag-3', 'tag-4'],
		});

		//clean changes by deleting the new tmpUTG
		await ctx.mutate({
			$relation: 'UserTagGroup',
			$id: 'tmpUTG',
			$op: 'delete',
		});
	});

	it('r6a[replace, unlink, link, many] Replace using unlink + link , all unlink', async () => {
		/// create
		await ctx.mutate({
			$relation: 'UserTagGroup',
			$op: 'create',
			id: 'tmpUTG',
			tags: ['tag-1', 'tag-2'],
			color: 'blue',
		});

		/// the mutation to be tested
		await ctx.mutate({
			$id: 'tmpUTG',
			$relation: 'UserTagGroup',
			tags: [{ $op: 'link', $id: ['tag-4', 'tag-3'] }, { $op: 'unlink' }],
		});

		const tmpUTG = await ctx.query({
			$relation: 'UserTagGroup',
			$id: 'tmpUTG',
			$fields: ['tags'],
		});

		expect(deepSort(tmpUTG)).toEqual({
			$thing: 'UserTagGroup',
			$thingType: 'relation',
			$id: 'tmpUTG',
			tags: ['tag-3', 'tag-4'],
		});

		//clean changes by deleting the new tmpUTG
		await ctx.mutate({
			$relation: 'UserTagGroup',
			$id: 'tmpUTG',
			$op: 'delete',
		});
	});

	it('TODO{TS}:ri1-d[ignore ids pre-query delete] delete something that does not exist', async () => {
		await ctx.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr6',
				// thing2
				root: { $id: 'thing2', $op: 'delete' },
				// thing5
				things: [{ $id: 'thing1', $op: 'delete' }],
				// thing1
				// extra: { $id: 'thing1', $op: 'unlink' },
			},
			{ ignoreNonexistingThings: true },
		);

		const queryRes = await ctx.query(
			{
				$relation: 'ThingRelation',
				$id: 'tr6',
			},
			{ noMetadata: true },
		);

		expect(queryRes).toBeDefined();
		expect(queryRes).toEqual({
			id: 'tr6',
			things: ['thing5'],
			extra: 'thing1',
		});
	});

	it('TODO{TS}:ri1-ul[ignore ids pre-query unlink] unlink something that does not exist', async () => {
		await ctx.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr7',
				// thing3
				root: { $id: 'thing3', $op: 'unlink' },
				// thing5
				things: [{ $id: 'thing90', $op: 'unlink' }],
				// thing1
				// extra: { $id: 'thing1', $op: 'unlink' },
			},
			{ ignoreNonexistingThings: true },
		);

		const queryRes = await ctx.query(
			{
				$relation: 'ThingRelation',
				$id: 'tr7',
			},
			{ noMetadata: true },
		);

		expect(queryRes).toBeDefined();
		expect(queryRes).toEqual({
			id: 'tr7',
			things: ['thing5'],
			extra: 'thing1',
		});
	});

	it('TODO{TS}:ri1-up[ignore ids pre-query update] update something that does not exist', async () => {
		await ctx.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr8',
				// thing3
				root: { $id: 'thing4', $op: 'update', stuff: 'Z' },
				// thing5
				things: [{ $id: 'thing90', $op: 'update', stuff: 'blah' }],
				// thing1
				// extra: { $id: 'thing1', $op: 'unlink' },
			},
			{ ignoreNonexistingThings: true },
		);

		const queryRes = await ctx.query(
			{
				$relation: 'ThingRelation',
				$id: 'tr8',
				$fields: [{ $path: 'root', $fields: ['stuff'] }],
			},
			{ noMetadata: true },
		);

		expect(queryRes).toBeDefined();
		expect(queryRes).toEqual({
			id: 'tr7',
			root: '',
		});
	});
});
