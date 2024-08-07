import { v4 as uuidv4 } from 'uuid';

import { deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';
import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';
import type { BQLResponseMulti } from '../../../src';

export const testBasicMutation = createTest('Mutation: Basic', (ctx) => {
	// some random issues forced a let here
	let firstUser = {
		$entity: 'User',
		name: 'John',
		email: 'wrong email',
		id: undefined,
	};

	const secondUser = {
		$entity: 'User',
		name: 'Jane',
		email: 'jane@test.com',
		id: undefined,
	};

	const thirdUser = {
		$entity: 'User',
		name: 'Jill',
		email: 'jill@test.com',
		id: undefined,
	};

	const godUser = {
		$entity: 'God',
		id: 'squarepusher',
		name: 'Tom Jenkinson',
		email: 'tom@warp.com',
		power: 'rhythm',
		isEvil: false,
	};

	const spaceOne = {
		id: undefined,
		name: 'Space 1',
	};

	const spaceTwo = {
		id: undefined,
		name: 'Space 2',
	};

	const spaceThree = {
		id: 'newSpaceThreeId',
		name: 'Space 3',
	};

	const spaceFour = {
		id: 'newSpaceFourId',
		name: 'Space 4',
	};

	it('r1[roleFields] Basic roleFields create update delete', async () => {
		await ctx.mutate(
			{
				$thing: 'UserTag',
				id: 'bo-ut1',
				users: [
					{ id: 'bo-u1', name: 'bo-u1' },
					{ id: 'bo-u2', name: 'bo-u2' },
					{ id: 'bo-u3', name: 'bo-u3' },
				],
			},
			{ noMetadata: true },
		);

		const res = await ctx.query({
			$relation: 'UserTag',
			$id: 'bo-ut1',
			$fields: ['id', { $path: 'users', $fields: ['id', 'name'] }],
		});

		expect(deepSort(res, 'id')).toMatchObject({
			id: 'bo-ut1',
			users: [
				{ id: 'bo-u1', name: 'bo-u1' },
				{ id: 'bo-u2', name: 'bo-u2' },
				{ id: 'bo-u3', name: 'bo-u3' },
			],
		});

		await ctx.mutate(
			{
				$thing: 'UserTag',
				$id: 'bo-ut1',
				users: [{ $op: 'update', name: 'allRenamed' }],
			},
			{ noMetadata: true },
		);

		const res2 = await ctx.query({
			$relation: 'UserTag',
			$id: 'bo-ut1',
			$fields: ['id', { $path: 'users', $fields: ['name'] }],
		});

		expect(res2).toMatchObject({
			id: 'bo-ut1',
			users: [{ name: 'allRenamed' }, { name: 'allRenamed' }, { name: 'allRenamed' }],
		});

		await ctx.mutate(
			{
				$thing: 'UserTag',
				$id: 'bo-ut1',
				users: [{ $op: 'delete' }, { id: 'bo-u4', name: 'bo-u4' }],
			},
			{ noMetadata: true },
		);

		const res3 = (await ctx.query([
			{ $entity: 'User', $id: ['bo-u1', 'bo-u2', 'bo-u3'] },
			{
				$relation: 'UserTag',
				$id: 'bo-ut1',
				$fields: ['id', { $path: 'users', $fields: ['id', 'name'] }],
			},
		])) as BQLResponseMulti;

		expect(res3[0]).toBeNull();
		expect(res3[1]).toMatchObject({
			id: 'bo-ut1',
			users: [{ id: 'bo-u4', name: 'bo-u4' }],
		});

		await ctx.mutate(
			{
				$thing: 'UserTag',
				$id: 'bo-ut1',
				$op: 'delete',
				users: [{ $op: 'delete' }],
			},
			{ noMetadata: true },
		);

		const res4 = (await ctx.query([
			{ $entity: 'User', $id: ['bo-u1', 'bo-u2', 'bo-u3', 'bo-u4'] },
			{
				$relation: 'UserTag',
				$id: 'bo-ut1',
			},
		])) as BQLResponseMulti;

		expect(res4[0]).toBeNull();
		expect(res4[1]).toBeNull();
	});

	it('TODO{T}:r2[create] Basic roleFields link unlink', async () => {
		await ctx.mutate(
			{
				$thing: 'UserTag',
				id: 'b0b-ut1',
				users: [
					{ id: 'b0b-u1', name: 'bo-u1' },
					{ id: 'b0b-u2', name: 'bo-u2' },
					{ id: 'b0b-u3', name: 'bo-u3' },
				],
			},
			{ noMetadata: true },
		);

		const res = await ctx.query({
			$relation: 'UserTag',
			$id: 'b0b-ut1',
			$fields: ['id', { $path: 'users', $fields: ['id', 'name'] }],
		});

		expect(deepSort(res, 'id')).toMatchObject({
			id: 'b0b-ut1',
			users: [
				{ id: 'b0b-u1', name: 'bo-u1' },
				{ id: 'b0b-u2', name: 'bo-u2' },
				{ id: 'b0b-u3', name: 'bo-u3' },
			],
		});

		await ctx.mutate(
			{
				$thing: 'UserTag',
				$id: 'b0b-ut1',
				users: [{ $op: 'unlink' }],
			},
			{ noMetadata: true },
		);

		const res2 = await ctx.query(
			{
				$relation: 'UserTag',
				$id: 'b0b-ut1',
				$fields: ['id', { $path: 'users', $fields: ['id', 'name'] }],
			},
			{ returnNulls: true },
		);

		expect(res2).toMatchObject({
			id: 'b0b-ut1',
			users: null,
		});

		await ctx.mutate(
			{
				$thing: 'UserTag',
				$id: 'b0b-ut1',
				users: [{ $op: 'link', $id: ['b0b-u1', 'b0b-u2'] }],
			},
			{ noMetadata: true },
		);

		const res3 = await ctx.query({
			$relation: 'UserTag',
			$id: 'b0b-ut1',
			$fields: ['id', { $path: 'users', $fields: ['id', 'name'] }],
		});

		expect(res3).toMatchObject({
			id: 'b0b-ut1',
			users: [
				{ id: 'b0b-u1', name: 'bo-u1' },
				{ id: 'b0b-u2', name: 'bo-u2' },
			],
		});
	});

	it('TODO{T}:l1[direct linkField] Basic linkField', async () => {
		// CREATE
		await ctx.mutate(
			{
				'$thing': 'User',
				'id': 'l1-u1',
				'user-tags': [
					{ id: 'l1-utg1', name: 'l1-utg1' },
					{ id: 'l1-utg2', name: 'l1-utg2' },
				],
			},
			{ noMetadata: true },
		);

		const res = await ctx.query({
			$entity: 'User',
			$id: 'l1-u1',
			$fields: ['id', 'user-tags'],
		});

		expect(deepSort(res, 'id')).toMatchObject({
			'id': 'l1-u1',
			'user-tags': ['l1-utg1', 'l1-utg2'],
		});

		//LINK TO EXISTING
		await ctx.mutate(
			{
				'$thing': 'User',
				'$id': 'l1-u1',
				'user-tags': [{ id: 'l1-utg3', name: 'l1-utg3' }],
			},
			{ noMetadata: true },
		);

		const res2 = await ctx.query({
			$entity: 'User',
			$id: 'l1-u1',
			$fields: ['id', 'user-tags'],
		});

		expect(deepSort(res2, 'id')).toMatchObject({
			'id': 'l1-u1',
			'user-tags': ['l1-utg1', 'l1-utg2', 'l1-utg3'],
		});

		//UPDATE ALL
		await ctx.mutate(
			{
				'$thing': 'User',
				'$id': 'l1-u1',
				'user-tags': [{ $op: 'update', name: 'allRenamed' }],
			},
			{ noMetadata: true },
		);

		const res3 = await ctx.query({
			$entity: 'User',
			$id: 'l1-u1',
			$fields: ['id', { $path: 'user-tags' }],
		});

		expect(deepSort(res3, 'id')).toMatchObject({
			'id': 'l1-u1',
			'user-tags': [
				{ id: 'l1-utg1', name: 'allRenamed' },
				{ id: 'l1-utg2', name: 'allRenamed' },
				{ id: 'l1-utg3', name: 'allRenamed' },
			],
		});
		//UNLINK ONE
		await ctx.mutate(
			{
				'$thing': 'User',
				'$id': 'l1-u1',
				'user-tags': [{ $id: ['l1-utg1'], $op: 'unlink' }],
			},
			{ noMetadata: true },
		);

		const res4 = await ctx.query({
			$entity: 'User',
			$id: 'l1-u1',
			$fields: ['id', { $path: 'user-tags' }],
		});

		expect(deepSort(res4, 'id')).toMatchObject({
			'id': 'l1-u1',
			'user-tags': [
				{ id: 'l1-utg2', name: 'allRenamed' },
				{ id: 'l1-utg3', name: 'allRenamed' },
			],
		});
		// DELETE REST
		await ctx.mutate(
			{
				'$thing': 'User',
				'$id': 'l1-u1',
				'user-tags': [{ $op: 'delete' }],
			},
			{ noMetadata: true },
		);

		const res5 = (await ctx.query(
			[
				{ $relation: 'UserTag', $fields: ['id'] },
				{
					$entity: 'User',
					$id: 'l1-u1',
					$fields: ['id', { $path: 'user-tags' }],
				},
			],
			{ noMetadata: true },
		)) as BQLResponseMulti;

		expect(deepSort(res5[0], 'id')).toMatchObject([
			{
				id: 'l1-utg1',
			},
			{
				id: 'tag-1',
			},
			{
				id: 'tag-2',
			},
			{
				id: 'tag-3',
			},
			{
				id: 'tag-4',
			},
		]);
		expect(res5[1]).toMatchObject({
			id: 'l1-u1',
		});

		//CLEAN
		await ctx.mutate([
			{
				$entity: 'User',
				$op: 'delete',
				$id: 'l1-u1',
			},
			{
				$relation: 'UserTag',
				$op: 'delete',
				$id: 'l1-utg1',
			},
		]);

		const isCleanRes = (await ctx.query([
			{ $entity: 'User', $id: 'l1-u1' },
			{ $relation: 'UserTag', $id: ['l1-utg1', 'l1-utg2', 'l1-utg3'] },
		])) as BQLResponseMulti;

		expect(isCleanRes[0]).toBeNull();
		expect(isCleanRes[1]).toBeNull();
	});

	it('b1a[create] Basic', async () => {
		const res = await ctx.mutate(firstUser, { noMetadata: true });
		const expectedUnit = {
			id: '$unitId',
			name: 'John',
			email: 'wrong email',
		};

		expect(res).toBeInstanceOf(Array);
		const [user] = res;
		// @ts-expect-error - TODO description
		expectArraysInObjectToContainSameElements(user, expectedUnit);
		firstUser = { ...firstUser, id: user.id };
	});

	it('b1b[create, update] Create a thing with an empty JSON attribute, then update it', async () => {
		const account = {
			$thing: 'Account',
			id: uuidv4(),
		};
		const createRes = await ctx.mutate(account, { noMetadata: false });
		expect(createRes).toMatchObject([account]);

		const updated = {
			...account,
			$id: account.id,
			profile: { hobby: ['Running'] },
		};
		const updateRes = await ctx.mutate(updated);
		expect(updateRes).toMatchObject([updated]);

		const deleteRes = await ctx.mutate({
			$thing: 'Account',
			$op: 'delete',
			$id: account.id,
		});
		expect(deleteRes).toMatchObject([
			{
				$op: 'delete',
				$thing: 'Account',
				$id: account.id,
			},
		]);
	});

	it('b1b[create, update] Create a thing with a JSON attribute, then update it', async () => {
		const account = {
			$thing: 'Account',
			id: uuidv4(),
			profile: { hobby: ['Running'] },
		};
		const createRes = await ctx.mutate(account);
		expect(createRes).toMatchObject([account]);

		const updated = {
			...account,
			$id: account.id,
			profile: { hobby: ['Running', 'Hiking'] },
		};
		const updateRes = await ctx.mutate(updated);
		expect(updateRes).toMatchObject([updated]);
		const deleteRes = await ctx.mutate({
			$thing: 'Account',
			$op: 'delete',
			$id: account.id,
		});
		expect(deleteRes).toMatchObject([
			{
				$op: 'delete',
				$thing: 'Account',
				$id: account.id,
			},
		]);
	});

	it('b1b[create] Create a nested thing with a JSON attribute', async () => {
		const user = {
			$thing: 'User',
			id: 'b1b-user1',
			accounts: [
				{
					$thing: 'Account',
					id: 'b1b-account1',
					profile: { hobby: ['Running'] },
				},
			],
		};
		await ctx.mutate(user);
		const res = await ctx.query({
			$relation: 'User-Accounts',
			$filter: { user: 'b1b-user1' },
		});
		console.log('RES!!', res);

		expect(res).toMatchObject([
			{
				$thing: 'User-Accounts',
				accounts: ['b1b-account1'],
				user: 'b1b-user1',
			},
		]);
		const deleteRes = await ctx.mutate({
			$thing: 'User',
			$op: 'delete',
			$id: user.id,
			accounts: [{ $op: 'delete' }],
		});
		expect(deleteRes).toMatchObject([
			{
				$op: 'delete',
				$thing: 'User',
				$id: user.id,
			},
			{
				$op: 'delete',
				$thing: 'Account',
			},
			{
				$op: 'delete',
				$thing: 'User-Accounts',
			},
		]);
	});

	it('b2a[update] Basic', async () => {
		const res = await ctx.mutate(
			{
				$entity: 'User',
				$id: firstUser.id,
				name: 'Johns not',
				email: 'john@test.com',
			},
			{ noMetadata: true },
		);

		expect(res[0]).toMatchObject({
			name: 'Johns not',
			email: 'john@test.com',
		});

		if (!firstUser.id) {
			throw new Error('firstUser.id is undefined');
		}

		const res2 = await ctx.query({
			$entity: 'User',
			$id: firstUser.id,
		});
		expect(res2).toEqual({
			id: firstUser.id,
			name: 'Johns not',
			email: 'john@test.com',
			$thing: 'User',
			$thingType: 'entity',
			$id: firstUser.id,
		});
	});

	it('b2b[update] Set null in single-attribute mutation should delete the attribute', async () => {
		await ctx.mutate(
			{
				$op: 'create',
				$entity: 'User',
				id: 'b2b-user',
				name: 'Foo',
				email: 'foo@test.com',
			},
			{ noMetadata: false },
		);

		const res = await ctx.mutate(
			{
				$op: 'update',
				$entity: 'User',
				$id: 'b2b-user',
				name: null,
			},
			{ noMetadata: true },
		);

		console.log('res!', res);
		expect(res[0]).toMatchObject({
			name: null,
		});

		const res2 = await ctx.query(
			{
				$entity: 'User',
				$id: 'b2b-user',
				$fields: ['name', 'email'],
			},
			{ noMetadata: true },
		);
		expect(res2).toMatchObject({ email: 'foo@test.com' });

		/// CLEAN: delete b2b-user
		await ctx.mutate(
			{
				$op: 'delete',
				$entity: 'User',
				$id: 'b2b-user',
			},
			{ noMetadata: true },
		);
	});

	it('b2c[update] Set null in multi-attributes mutation should delete the attribute', async () => {
		await ctx.mutate(
			{
				$op: 'create',
				$entity: 'User',
				id: 'b2c-user',
				name: 'Foo',
				email: 'foo@test.com',
			},
			{ noMetadata: false },
		);

		const res = await ctx.mutate(
			{
				$op: 'update',
				$entity: 'User',
				$id: 'b2c-user',
				name: null,
				email: 'bar@test.com',
			},
			{ noMetadata: true },
		);

		expect(res[0]).toMatchObject({
			name: null,
			email: 'bar@test.com',
		});

		const res2 = await ctx.query(
			{
				$entity: 'User',
				$id: 'b2c-user',
				$fields: ['name', 'email'],
			},
			{ noMetadata: true },
		);
		expect(res2).toEqual({ email: 'bar@test.com' });

		// CLEAN: delete b2c-user
		await ctx.mutate(
			{
				$op: 'delete',
				$entity: 'User',
				$id: 'b2c-user',
			},
			{ noMetadata: true },
		);
	});

	it('b2d[update] Set an empty string should update the attribute to an empty string', async () => {
		await ctx.mutate(
			{
				$op: 'create',
				$entity: 'User',
				id: 'b2d-user',
				name: 'Foo',
				email: 'foo@test.com',
			},
			{ noMetadata: false },
		);

		const res = await ctx.mutate(
			{
				$op: 'update',
				$entity: 'User',
				$id: 'b2d-user',
				email: '',
			},
			{ noMetadata: true },
		);

		expect(res[0]).toMatchObject({
			email: '',
		});

		const res2 = await ctx.query(
			{
				$entity: 'User',
				$id: 'b2d-user',
				$fields: ['name', 'email'],
			},
			{ noMetadata: true },
		);
		expect(res2).toEqual({ name: 'Foo', email: '' });

		// CLEAN: delete b2d-user
		await ctx.mutate(
			{
				$op: 'delete',
				$entity: 'User',
				$id: 'b2d-user',
			},
			{ noMetadata: true },
		);
	});

	it('b3e[delete, entity] Basic', async () => {
		const res = await ctx.mutate({
			$entity: 'User',
			$op: 'delete',
			$id: firstUser.id,
		});

		expect(res).toMatchObject([
			{
				$thing: 'User',
				$thingType: 'entity',
				$op: 'delete',
				$id: firstUser.id,
				$bzId: expect.any(String),
			},
		]);

		if (!firstUser.id) {
			throw new Error('firstUser.id is undefined');
		}

		const res2 = await ctx.query({
			$entity: 'User',
			$id: firstUser.id as string,
		});

		expect(res2).toBeNull();
	});

	it('b3r[delete, relation] Basic', async () => {
		await ctx.mutate({
			$relation: 'User-Accounts',
			id: 'r1',
			user: { id: 'u1' },
			accounts: [{ id: 'a1' }],
		});
		await ctx.mutate({
			$relation: 'User-Accounts',
			$op: 'delete',
			$id: 'r1',
		});

		const res2 = await ctx.query({
			$relation: 'User-Accounts',
			$id: 'r1',
		});

		expect(res2).toBeNull();

		/// clean user and account
		await ctx.mutate([
			{
				$entity: 'User',
				$op: 'delete',
				$id: 'u1',
			},
			{
				$entity: 'Account',
				$op: 'delete',
				$id: 'a1',
			},
		]);
	});
	it('b3rn[delete, relation, nested] Basic', async () => {
		//create nested object
		await ctx.mutate(
			{
				$relation: 'User-Accounts',
				id: 'r1',
				user: {
					'id': 'u2',
					'email': 'hey',
					'user-tags': [
						{ id: 'ustag1', color: { id: 'pink' } },
						{ id: 'ustag2', color: { id: 'gold' } },
						{ id: 'ustag3', color: { id: 'silver' } },
					],
				},
			},
			{ preQuery: true },
		);
		const res1 = await ctx.query(
			{
				$entity: 'User',
				$id: 'u2',
				$fields: [{ $path: 'user-tags', $fields: ['id', 'color'] }],
			},
			{ noMetadata: true },
		);
		expect(deepSort(res1, 'id')).toEqual({
			'user-tags': [
				{ id: 'ustag1', color: 'pink' },
				{ id: 'ustag2', color: 'gold' },
				{ id: 'ustag3', color: 'silver' },
			],
		});

		await ctx.mutate(
			{
				$relation: 'User-Accounts',
				$id: 'r1',
				user: {
					'$op': 'update',
					'user-tags': [
						{ $id: 'ustag1', color: { $op: 'delete' } },
						{ $id: 'ustag2', color: { $op: 'delete' } },
					],
				},
			},
			// { preQuery: false },
		);

		const res2 = await ctx.query(
			{
				$relation: 'User-Accounts',
				$id: 'r1',
				$fields: [
					'id',
					{
						$path: 'user',
						$fields: ['email', { $path: 'user-tags', $fields: ['id', 'color'] }],
					},
				],
			},
			{ noMetadata: true },
		);
		expect(deepSort(res2, 'id')).toEqual({
			id: 'r1',
			user: {
				'email': 'hey',
				'user-tags': [{ id: 'ustag1' }, { id: 'ustag2' }, { id: 'ustag3', color: 'silver' }],
			},
		});

		await ctx.mutate(
			{
				$relation: 'User-Accounts',
				$id: 'r1',
				user: {
					'$op': 'update',
					'user-tags': [
						{ $id: 'ustag3', $op: 'delete', color: { $op: 'delete' } },
						{ $id: 'ustag2', $op: 'delete' },
					],
				},
			},
			// { preQuery: false },
		);

		const res3 = await ctx.query(
			{
				$relation: 'User-Accounts',
				$id: 'r1',
				$fields: [
					'id',
					{
						$path: 'user',
						$fields: ['email', { $path: 'user-tags', $fields: ['id', 'color'] }],
					},
				],
			},
			{ noMetadata: true },
		);

		expect(res3).toEqual({
			id: 'r1',
			user: {
				'email': 'hey',
				'user-tags': [{ id: 'ustag1' }],
			},
		});
		/// clean user
		await ctx.mutate([
			{
				$entity: 'User',
				$op: 'delete',
				$id: 'u2',
			},
		]);
	});

	it('b4[create, children] Create with children', async () => {
		const res = await ctx.mutate(
			{
				...secondUser,
				spaces: [{ name: spaceOne.name }, { name: spaceTwo.name }],
			},
			{ noMetadata: true },
		);

		// @ts-expect-error - TODO description
		spaceOne.id = res?.find((r) => r.name === 'Space 1').id;
		// @ts-expect-error - TODO description
		spaceTwo.id = res?.find((r) => r.name === 'Space 2').id;
		// @ts-expect-error - TODO description
		secondUser.id = res?.find((r) => r.name === 'Jane').id;

		expect(res).toBeDefined();
		expect(res).toBeInstanceOf(Object);

		expect(JSON.parse(JSON.stringify(res))).toEqual([
			{
				email: 'jane@test.com',
				id: secondUser.id,
				name: 'Jane',
			},
			spaceOne,
			spaceTwo,
			{
				spaces: spaceOne.id,
				users: secondUser.id,
			},
			{
				spaces: spaceTwo.id,
				users: secondUser.id,
			},
		]);

		if (!secondUser.id) {
			throw new Error('firstUser.id is undefined');
		}

		const res2 = await ctx.query(
			{
				$entity: 'User',
				$id: secondUser.id,
			},
			{ noMetadata: true },
		);
		expect(deepSort(res2)).toEqual({
			id: secondUser.id,
			name: 'Jane',
			email: 'jane@test.com',
			spaces: [spaceOne.id, spaceTwo.id].sort(),
		});

		// clean spaceOne
		await ctx.mutate([
			{
				$entity: 'Space',
				$op: 'delete',
				$id: spaceOne.id,
			},
		]);
	});

	it('b4.2[create, link] Create all then link', async () => {
		/// create third user
		const res1 = await ctx.mutate(
			{
				...thirdUser,
			},
			{ noMetadata: true, preQuery: true },
		);

		// create spaces
		const res2 = await ctx.mutate(
			[
				{
					$entity: 'Space',
					...spaceThree,
				},
				{
					$entity: 'Space',
					...spaceFour,
				},
			],
			{ noMetadata: true, preQuery: true },
		);

		// @ts-expect-error - TODO description
		spaceThree.id = res2?.find((r) => r.name === 'Space 3').id;
		// @ts-expect-error - TODO description
		spaceFour.id = res2?.find((r) => r.name === 'Space 4').id;
		thirdUser.id = res1[0].id;

		expect(res1).toBeDefined();
		expect(res1).toBeInstanceOf(Object);
		expect(res2).toBeDefined();
		expect(res2).toBeInstanceOf(Object);

		// link the user to the spaces
		const res3 = await ctx.mutate(
			{
				$entity: 'User',
				$id: thirdUser.id,
				spaces: [
					{ $id: spaceThree.id, $op: 'link' },
					{ $id: spaceFour.id, $op: 'link' },
				],
			},

			{ noMetadata: true, preQuery: true },
		);

		expectArraysInObjectToContainSameElements(JSON.parse(JSON.stringify(res3)), [
			{
				spaces: spaceThree.id,
				users: thirdUser.id,
			},
			{
				spaces: spaceFour.id,
				users: thirdUser.id,
			},
		]);
	});

	it('TODO{TS}:b4.3[update, link] Link ALL (without ids)', async () => {
		const res = await ctx.mutate(
			{
				$entity: 'Space',
				$id: 'space-3',
				users: [{ $op: 'link' }],
			},
			{ noMetadata: true },
		);

		expect(JSON.parse(JSON.stringify(res))).toEqual([
			{
				email: 'jane@test.com',
				id: secondUser.id,
				name: 'Jane',
			},
			spaceOne,
			spaceTwo,
			{
				spaces: spaceOne.id,
				users: secondUser.id,
			},
			{
				spaces: spaceTwo.id,
				users: secondUser.id,
			},
		]);
	});

	it('TODO{TS}:b4.4[create, link] Create and link ALL (without ids)', async () => {
		const res = await ctx.mutate(
			{
				$entity: 'Space',
				id: 'space-5', //no $op and no $id means create
				users: [{ $op: 'link' }],
			},
			{ noMetadata: true },
		);

		expect(JSON.parse(JSON.stringify(res))).toEqual([
			{
				email: 'jane@test.com',
				id: secondUser.id,
				name: 'Jane',
			},
			spaceOne,
			spaceTwo,
			{
				spaces: spaceOne.id,
				users: secondUser.id,
			},
			{
				spaces: spaceTwo.id,
				users: secondUser.id,
			},
		]);

		//clean
		await ctx.mutate({
			$entity: 'Space',
			$op: 'delete',
			$id: 'space-5',
		});
	});

	it('b5[update, children] Update children', async () => {
		const res = await ctx.mutate(
			{
				$entity: 'User',
				$id: secondUser.id,
				spaces: [
					// todo: { $filter: { name: 'Space 1' }, name: 'newSpace1' },
					{ $id: spaceTwo.id, name: 'newSpace2' },
				],
			},
			{ noMetadata: true },
		);

		expect(JSON.parse(JSON.stringify(res[0]))).toEqual(
			// { id: expect.any(String), name: 'newSpace1' },
			{ name: 'newSpace2' },
		);

		if (!secondUser.id) {
			throw new Error('firstUser.id is undefined');
		}

		const res2 = await ctx.query(
			{
				$entity: 'User',
				$id: secondUser.id,
				$fields: [{ $path: 'spaces', $id: spaceTwo.id, $fields: ['name'] }],
			},
			{ noMetadata: true },
		);
		expect(res2).toEqual({
			spaces: { name: 'newSpace2' }, // todo there is a $id so at some point this should not be an array
		});

		// clean spaceTwo
		await ctx.mutate([
			{
				$entity: 'Space',
				$op: 'delete',
				$id: spaceTwo.id,
			},
		]);
	});

	it('b6.1[create, withId] Create with id (override default)', async () => {
		const res = await ctx.mutate(
			[
				{
					$entity: 'Color',
					id: 'teal',
				},
				{
					$entity: 'Color',
					id: 'green',
				},
			],
			{ noMetadata: true },
		);
		expect(JSON.parse(JSON.stringify(res))).toEqual([
			{
				id: 'teal',
			},
			{ id: 'green' },
		]);

		/// CLEAN: delete the newly created colors
		await ctx.mutate([
			{
				$entity: 'Color',
				$op: 'delete',
				$id: 'teal',
			},
			{
				$entity: 'Color',
				$op: 'delete',
				$id: 'green',
			},
		]);
	});

	it('b6.2[create, default id] Create without id', async () => {
		await ctx.mutate([
			{
				$entity: 'Space',
				$id: 'space-3',
				kinds: [{ name: 'b6-k' }],
			},
		]);

		const res = await ctx.query(
			{
				$relation: 'Kind',
				$filter: { name: 'b6-k' },
				$fields: ['id', 'name'],
			},
			{ noMetadata: true },
		);

		expect(res).toEqual([
			{
				name: 'b6-k',
				id: expect.any(String),
			},
		]);
		//@ts-expect-error - TODO
		const kindId = res[0].id;

		/// CLEAN
		await ctx.mutate({
			$relation: 'Kind',
			$id: kindId,
			$op: 'delete',
		});
	});

	it('b7[create, inherited] inheritedAttributesMutation', async () => {
		const res = await ctx.mutate(godUser, { noMetadata: true });
		expect(res[0]).toEqual({
			id: 'squarepusher',
			name: 'Tom Jenkinson',
			email: 'tom@warp.com',
			power: 'rhythm',
			isEvil: false,
		});
	});

	it('b8[create, multiple, date] Next-auth example ', async () => {
		await ctx.mutate(
			{
				$entity: 'Session',
				user: 'user1',
				sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4',
				expires: new Date('2023-06-10T14:58:09.066Z'),
			},
			{ noMetadata: true },
		);

		const sessions = await ctx.query(
			{
				$entity: 'Session',
			},
			{ noMetadata: true },
		);

		expect(sessions).toEqual([
			{
				expires: '2023-06-10T14:58:09.066Z',
				id: expect.any(String),
				sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4',
				user: 'user1',
			},
		]);
	});

	it('mv1[create, multiVal] ', async () => {
		await ctx.mutate(
			[
				{
					$thing: 'Color',
					id: 'numberColor',
					freeForAll: 12,
				},
				{
					$thing: 'Color',
					id: 'stringColor',
					freeForAll: 'hello',
				},
				{
					$thing: 'Color',
					id: 'dateColor',
					freeForAll: new Date('2023-06-10T14:58:09.066Z'),
				},
			],

			{ noMetadata: true },
		);

		try {
			const colors = await ctx.query(
				{
					$entity: 'Color',
					$id: ['numberColor', 'stringColor', 'dateColor'],
					$fields: ['id', 'freeForAll'],
				},
				{ noMetadata: true },
			);

			expect(deepSort(colors, 'id')).toEqual([
				{
					id: 'dateColor',
					freeForAll: '2023-06-10T14:58:09.066Z',
				},
				{
					id: 'numberColor',
					freeForAll: 12,
				},
				{
					id: 'stringColor',
					freeForAll: 'hello',
				},
			]);
		} finally {
			await ctx.mutate(
				{
					$thing: 'Color',
					$op: 'delete',
					$id: ['numberColor', 'stringColor', 'dateColor'],
				},
				{ noMetadata: true },
			);
		}
	});

	it('mv2[create, edit] ', async () => {
		await ctx.mutate(
			[
				{
					$thing: 'Color',
					$id: 'yellow',
					$op: 'update',
					freeForAll: 13, //keep same type
				},
				{
					$thing: 'Color',
					$id: 'red',
					$op: 'update',
					freeForAll: 'bye', //change it to string
				},
				{
					$thing: 'Color',
					$id: 'blue',
					$op: 'update',
					freeForAll: new Date('2023-06-10T14:58:09.066Z'), //change it to date
				},
			],
			{ noMetadata: true },
		);

		const colors = await ctx.query(
			{
				$entity: 'Color',
				$id: ['yellow', 'red', 'blue'],
				$fields: ['id', 'freeForAll'],
			},
			{ noMetadata: true },
		);

		expect(deepSort(colors, 'id')).toEqual([
			{
				id: 'blue',
				freeForAll: '2023-06-10T14:58:09.066Z',
			},
			{
				id: 'red',
				freeForAll: 'bye',
			},
			{
				id: 'yellow',
				freeForAll: 13,
			},
		]);
	});

	it('n1[create, nested] nested', async () => {
		const mutated = await ctx.mutate(
			{
				$relation: 'Kind',
				name: 'myTest',
				space: 'space-3',
				dataFields: [{ $op: 'create', name: 'myTestField', space: 'space-3' }],
			},
			{ noMetadata: true },
		);

		const fieldId = mutated?.find((m) => m.name === 'myTestField')?.id;
		const kindId = mutated?.find((m) => m.name === 'myTest')?.id;

		const kinds = await ctx.query(
			{
				$relation: 'Kind',
			},
			{ noMetadata: true },
		);
		const expectedKindTemplate = [
			{
				id: kindId, // '$newKindId',
				name: 'myTest',
				space: 'space-3',
				fields: [fieldId], // todo: replace by template ids
				dataFields: [fieldId],
			},
			{ id: 'kind-book', name: 'book', space: 'space-2' },
		];
		// @ts-expect-error - TODO description
		expectArraysInObjectToContainSameElements(kinds, expectedKindTemplate);

		const fields = await ctx.query(
			{
				$relation: 'DataField',
			},
			{ noMetadata: true },
		);

		const expectedFieldsTemplate = [
			{
				id: fieldId,
				name: 'myTestField',
				kinds: [kindId],
				space: 'space-3',
			},
		];

		// @ts-expect-error - TODO description
		expectArraysInObjectToContainSameElements(fields, expectedFieldsTemplate);
		// const { $newKindId, $newFieldId } = ids2;

		/// also the ids must match
		// expectResLikeTemplate(ids, ids2);

		/// delete both things
		await ctx.mutate(
			[
				{
					$relation: 'Kind',
					$op: 'delete',
					$id: kindId,
				},
				{
					$relation: 'DataField',
					$op: 'delete',
					$id: fieldId,
				},
			],
			{ noMetadata: true },
		);
	});

	it('n2[create, nested] nested, self referenced', async () => {
		const mutated = await ctx.mutate(
			{
				$relation: 'Kind',
				name: 'myTestKind1',
				space: 'space-3',
				dataFields: [
					{
						$op: 'create',
						name: 'myTestField',
						space: 'space-3',
						kinds: [
							{
								$op: 'create',
								name: 'myTestKind2',
								space: 'space-3',
							},
						],
					},
				],
			},
			{ noMetadata: true },
		);

		const myTestKind1Id = mutated?.find((m) => m.name === 'myTestKind1')?.id;
		const myTestFieldId = mutated?.find((m) => m.name === 'myTestField')?.id;
		const myTestKind2Id = mutated?.find((m) => m.name === 'myTestKind2')?.id;

		const kinds = await ctx.query(
			{
				$relation: 'Kind',
			},
			{ noMetadata: true },
		);

		const expectedKindTemplate = [
			{ id: 'kind-book', name: 'book', space: 'space-2' },
			{
				id: myTestKind1Id,
				name: 'myTestKind1',
				space: 'space-3',
				fields: [myTestFieldId],
				dataFields: [myTestFieldId],
			},
			{
				id: myTestKind2Id,
				name: 'myTestKind2',
				space: 'space-3',
				fields: [myTestFieldId],
				dataFields: [myTestFieldId],
			},
		];

		// const ids = expectResLikeTemplate(kinds, expectedKindTemplate);
		// @ts-expect-error - TODO description
		expectArraysInObjectToContainSameElements(kinds, expectedKindTemplate); // todo: delete when matcher is ready

		const fields = await ctx.query(
			{
				$relation: 'DataField',
			},
			{ noMetadata: true },
		);

		const expectedFieldsTemplate = [
			{
				id: myTestFieldId,
				name: 'myTestField',
				kinds: [myTestKind1Id, myTestKind2Id],
				space: 'space-3',
			},
		];

		// const ids2 = expectResLikeTemplate(fields, expectedFieldsTemplate);
		// @ts-expect-error - TODO description
		expectArraysInObjectToContainSameElements(fields, expectedFieldsTemplate); // todo: delete when matcher is ready
		// const { $newFieldId } = ids2;

		/// also the ids must match
		// expectResLikeTemplate(ids, ids2);

		/// delete both things
		await ctx.mutate(
			[
				{
					$relation: 'DataField',
					$op: 'delete',
					$id: myTestFieldId,
				},
				{
					$relation: 'Kind',
					$op: 'delete',
					$id: myTestKind1Id,
				},
				{
					$relation: 'Kind',
					$op: 'delete',
					$id: myTestKind2Id,
				},
			],
			{ noMetadata: true },
		);
	});

	it('n3[delete, nested] nested delete', async () => {
		const mutated = await ctx.mutate(
			{
				$relation: 'Kind',
				name: 'myTestKind1',
				space: 'space-3',
				dataFields: [
					{
						$op: 'create',
						name: 'myTestField',
						space: 'space-3',
						kinds: [
							{
								$op: 'create',
								name: 'myTestKind2',
								space: 'space-3',
							},
						],
					},
				],
			},
			{ noMetadata: true },
		);

		const myTestKind1Id = mutated?.find((m) => m.name === 'myTestKind1')?.id;

		/// delete both things
		await ctx.mutate(
			{
				$relation: 'Kind',
				$op: 'delete',
				$id: myTestKind1Id,
				dataFields: [{ $op: 'delete', kinds: [{ $op: 'delete' }] }],
			},
			{ noMetadata: true },
		);
		/*
    #target query:
    match
    $root isa Kind, has id "6a830f80-59f1-469e-93cb-99a772c96406";
    $f (kinds: $a, kinds: $other) isa Field;
    $other isa Kind;

    delete
    $root isa Kind;
    $nested-f isa Field;
    $nested-other isa Kind;

    #target ibql:
    

    const nodes = [
      { $id: 'rootId', $relation: 'Kind', $op: 'delete' },
      { $id: '$f', $relation: 'Field', $op: 'delete' },
      { $if: '$other', $relation: 'Kind', $op: 'delete' },
    ];
    const edges = [{ $relation: 'Field', $id: 'localNestedFieldId', kinds: ['$rootId', 'localNestedKindsId'] }];
    */
		const kinds = await ctx.query(
			{
				$relation: 'Kind',
			},
			{ noMetadata: true },
		);

		// we expect both kinds to be deleted and show the data.tql one
		expect(kinds).toEqual([
			{
				id: 'kind-book',
				name: 'book',
				space: 'space-2',
			},
		]);
	});

	it('TEMP:buffer', async () => {
		// Some failed tests generate a fail in the next test, this test is here to prevent that to happen in ui
		// todo: fix the borm / jest issue instead
		await ctx.query({ $entity: 'Space' });
	});

	it('u1[update, multiple] Shared ids', async () => {
		await ctx.mutate(
			{
				$entity: 'Space',
				id: 'sp1',
				users: [
					{
						id: 'u1',
						name: 'new name',
					},
					{
						id: 'u2',
						name: 'new name 2',
					},
				],
			},
			{ noMetadata: true },
		);

		await ctx.mutate(
			{
				$entity: 'Space',
				$id: 'sp1',
				users: [
					{
						$op: 'update',
						name: 'updated',
					},
				],
			},
			{ noMetadata: true },
		);

		const res = await ctx.query(
			{
				$entity: 'Space',
				$id: 'sp1',
				$fields: [
					{
						$path: 'users',
						$fields: ['name'],
					},
				],
			},
			{ noMetadata: true },
		);

		expect(res).toEqual({
			users: [
				{
					name: 'updated',
				},
				{
					name: 'updated',
				},
			],
		});

		const allUsers = await ctx.query(
			{
				$entity: 'User',
				$fields: ['name'],
			},
			{ noMetadata: true, returnNulls: true },
		);

		expect(deepSort(allUsers, 'name')).toEqual([
			{
				name: 'Ann',
			},
			{
				name: 'Antoine',
			},
			{
				name: 'Beatrix Kiddo',
			},
			{
				name: 'Ben',
			},
			{
				name: 'Charlize',
			},
			{
				name: 'Jane', /// sing from previous test (b4)
			},
			{
				name: 'Jill', /// coming from previous test
			},
			{
				name: 'Loic',
			},
			{
				name: 'Richard David James',
			},
			{
				name: 'Tom Jenkinson',
			},
			{
				name: 'updated',
			},
			{
				name: 'updated',
			},
		]);

		/// delete created users and spaces
		await ctx.mutate(
			[
				{
					$entity: 'User',
					$id: ['u1', 'u2'],
					$op: 'delete',
				},
				{
					$entity: 'Space',
					$id: 'sp1',
					$op: 'delete',
				},
			],

			{ noMetadata: true },
		);

		/// get all users again
		const allUsers2 = await ctx.query(
			{
				$entity: 'User',
				$fields: ['name'],
			},
			{ noMetadata: true },
		);
		/// expect original users
		expect(deepSort(allUsers2, 'name')).toEqual([
			{
				name: 'Ann',
			},
			{
				name: 'Antoine',
			},
			{
				name: 'Beatrix Kiddo',
			},
			{
				name: 'Ben',
			},
			{
				name: 'Charlize',
			},
			{
				name: 'Jane', /// coming from previous test
			},
			{
				name: 'Jill', /// coming from previous test
			},
			{
				name: 'Loic',
			},
			{
				name: 'Richard David James',
			},
			{
				name: 'Tom Jenkinson',
			},
		]);
	});

	it('u2[update, multiple, nested(many), noId] Update children (no id)', async () => {
		// This test might fail if b4 fails

		/// cardinality MANY
		await ctx.mutate(
			{
				$entity: 'User',
				$id: 'user1',
				spaces: [{ $op: 'update', name: 'space2ORspace1' }],
			},
			{ noMetadata: true },
		);

		const allSpaces = await ctx.query(
			{
				$entity: 'Space',
				$fields: ['id', 'name'],
			},
			{ noMetadata: true },
		);

		expect(deepSort(allSpaces, 'id')).toEqual([
			{
				id: 'newSpaceFourId',
				name: 'Space 4',
			},
			{
				id: 'newSpaceThreeId',
				name: 'Space 3',
			},
			{
				id: 'space-1',
				name: 'space2ORspace1',
			},
			{
				id: 'space-2',
				name: 'space2ORspace1',
			},
			{
				id: 'space-3',
				name: 'Not-owned',
			},
		]);

		/// get back original space names
		await ctx.mutate([
			{
				$id: 'space-2',
				$entity: 'Space',
				name: 'Dev',
			},
			{
				$id: 'space-3',
				$entity: 'Space',
				name: 'Not-owned',
			},
			{
				$id: 'space-1',
				$entity: 'Space',
				name: 'Production',
			},
		]);
	});

	it('u3[update, multiple, nested(many), noId] Update but all children (no id)', async () => {
		/// This test might fail if b4 fails
		const currentSpacesOfUser2And5 = await ctx.query(
			{
				$entity: 'User',
				$id: ['user2', 'user5'],
				$fields: ['id', { $path: 'spaces', $fields: ['id', 'name'] }],
			},
			{ noMetadata: true },
		);
		expect(deepSort(currentSpacesOfUser2And5, 'id')).toEqual([
			{
				id: 'user2',
				spaces: [
					{
						id: 'space-2',
						name: 'Dev',
					},
				],
			},
			{
				id: 'user5',
				spaces: [
					{
						id: 'space-1',
						name: 'Production',
					},
				],
			},
		]);

		/// cardinality MANY
		await ctx.mutate(
			{
				$entity: 'User',
				$id: ['user2', 'user5'],
				spaces: [{ $op: 'update', name: 'space2ORspace1Bis' }],
			},
			{ noMetadata: true, preQuery: true },
		);

		const allSpaces = await ctx.query(
			{
				$entity: 'Space',
				$fields: ['id', 'name'],
			},
			{ noMetadata: true },
		);

		expect(deepSort(allSpaces, 'id')).toEqual([
			{
				id: 'newSpaceFourId',
				name: 'Space 4',
			},
			{
				id: 'newSpaceThreeId',
				name: 'Space 3',
			},
			{
				id: 'space-1',
				name: 'space2ORspace1Bis',
			},
			{
				id: 'space-2',
				name: 'space2ORspace1Bis',
			},
			{
				id: 'space-3',
				name: 'Not-owned',
			},
		]);

		/// get back original space names
		await ctx.mutate([
			{
				$id: 'space-1',
				$entity: 'Space',
				name: 'Production',
			},
			{
				$id: 'space-2',
				$entity: 'Space',
				name: 'Dev',
			},
		]);
	});

	it('u4[update, multiple, nested(one), noId] Update all children (no id)', async () => {
		/// cardinality ONE
		await ctx.mutate(
			{
				$entity: 'Account',
				$id: 'account3-1',
				user: {
					$op: 'update',
					email: 'theNewEmailOfAnn@test.com',
				},
			},
			{ noMetadata: true },
		);

		const allOriginalUsers = await ctx.query(
			{
				$entity: 'User',
				$id: ['user1', 'user2', 'user3', 'user4', 'user5'],
				$fields: ['id', 'email'],
			},
			{ noMetadata: true },
		);

		expect(deepSort(allOriginalUsers, 'id')).toEqual([
			{
				email: 'antoine@test.com',
				id: 'user1',
			},
			{
				email: 'loic@test.com',
				id: 'user2',
			},
			{
				email: 'theNewEmailOfAnn@test.com',
				id: 'user3',
			},
			{
				id: 'user4',
			},
			{
				email: 'charlize@test.com',
				id: 'user5',
			},
		]);

		/// get back original emails
		await ctx.mutate([
			{
				$id: 'user3',
				$entity: 'User',
				email: 'ann@test.com',
			},
		]);
	});
});
