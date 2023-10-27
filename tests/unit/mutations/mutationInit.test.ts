import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';
import { deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';

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

describe('Mutations: Init', () => {
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

	it('b1[create] Basic', async () => {
		expect(bormClient).toBeDefined();

		const res = await bormClient.mutate(firstUser, { noMetadata: true });
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

	it('b2[update] Basic', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.mutate(
			{
				$entity: 'User',
				$id: firstUser.id,
				name: 'Johns not',
				email: 'john@test.com',
			},
			{ noMetadata: true },
		);

		expect(res[0]).toEqual({
			name: 'Johns not',
			email: 'john@test.com',
		});

		if (!firstUser.id) {
			throw new Error('firstUser.id is undefined');
		}

		const res2 = await bormClient.query({
			$entity: 'User',
			$id: firstUser.id,
		});
		expect(res2).toEqual({
			id: firstUser.id,
			name: 'Johns not',
			email: 'john@test.com',
			$entity: 'User',
			$id: firstUser.id,
		});
	});

	it('b3e[delete, entity] Basic', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.mutate({
			$entity: 'User',
			$op: 'delete',
			$id: firstUser.id,
		});

		expect(res).toEqual({
			$entity: 'User',
			$op: 'delete',
			$id: firstUser.id,
		});

		if (!firstUser.id) {
			throw new Error('firstUser.id is undefined');
		}

		const res2 = await bormClient.query({
			$entity: 'User',
			$id: firstUser.id as string,
		});

		expect(res2).toBeNull();
	});

	it('b3r[delete, relation] Basic', async () => {
		expect(bormClient).toBeDefined();
		await bormClient.mutate({
			$relation: 'User-Accounts',
			id: 'r1',
			user: { id: 'u1' },
			accounts: [{ id: 'a1' }],
		});
		await bormClient.mutate({
			$relation: 'User-Accounts',
			$op: 'delete',
			$id: 'r1',
		});

		const res2 = await bormClient.query({
			$relation: 'User-Accounts',
			$id: 'r1',
		});

		expect(res2).toBeNull();

		/// clean user and account
		await bormClient.mutate([
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
		expect(bormClient).toBeDefined();
		await bormClient.mutate({
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
		});
		await bormClient.mutate({
			$relation: 'User-Accounts',
			$id: 'r1',
			user: {
				'$id': 'u2',
				'user-tags': [
					{ $id: 'ustag1', color: { $op: 'delete' } },
					{ $id: 'ustag2', color: { $op: 'delete' } },
				],
			},
		});

		const res2 = await bormClient.query(
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

		await bormClient.mutate({
			$relation: 'User-Accounts',
			$id: 'r1',
			user: {
				'$id': 'u2',
				'user-tags': [
					{ $id: 'ustag3', $op: 'delete', color: { $op: 'delete' } },
					{ $id: 'ustag2', $op: 'delete' },
				],
			},
		});

		const res3 = await bormClient.query(
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
		await bormClient.mutate([
			{
				$entity: 'User',
				$op: 'delete',
				$id: 'u2',
			},
		]);
	});

	it('b4[create, children] Create with children', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.mutate(
			{
				...secondUser,
				spaces: [{ name: spaceOne.name }, { name: spaceTwo.name }],
			},
			{ noMetadata: true },
		);

		// console.log('res', res);

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

		const res2 = await bormClient.query(
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
		await bormClient.mutate([
			{
				$entity: 'Space',
				$op: 'delete',
				$id: spaceOne.id,
			},
		]);
	});

	it('b4.2[create, link] Create all then link', async () => {
		expect(bormClient).toBeDefined();

		/// create third user
		const res1 = await bormClient.mutate(
			{
				...thirdUser,
			},
			{ noMetadata: true },
		);

		// create spaces
		const res2 = await bormClient.mutate(
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
			{ noMetadata: true },
		);

		// console.log('res', res);

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

		const res3 = await bormClient.mutate(
			{
				$entity: 'User',
				$id: thirdUser.id,
				spaces: [
					{ $id: spaceThree.id, $op: 'link' },
					{ $id: spaceFour.id, $op: 'link' },
				],
			},
			{ noMetadata: true },
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

	it('TODO:b4.3[create, link] Link ALL (without ids)', async () => {
		expect(bormClient).toBeDefined();

		const res = await bormClient.mutate(
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

	it('b5[update, children] Update children', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.mutate(
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

		const res2 = await bormClient.query(
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
		await bormClient.mutate([
			{
				$entity: 'Space',
				$op: 'delete',
				$id: spaceTwo.id,
			},
		]);
	});

	it('b6[create, withId] Create with id (override default)', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.mutate(
			[
				{
					$entity: 'Color',
					id: 'red',
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
				id: 'red',
			},
			{ id: 'green' },
		]);

		///delete the newly created colors
		await bormClient.mutate([
			{
				$entity: 'Color',
				$op: 'delete',
				$id: 'red',
			},
			{
				$entity: 'Color',
				$op: 'delete',
				$id: 'green',
			},
		]);
	});

	it('b7[create, inherited] inheritedAttributesMutation', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.mutate(godUser, { noMetadata: true });
		expect(res[0]).toEqual({
			id: 'squarepusher',
			name: 'Tom Jenkinson',
			email: 'tom@warp.com',
			power: 'rhythm',
			isEvil: false,
		});
	});

	it('b8[create, multiple, date] Next-auth example ', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
			{
				$entity: 'Session',
				user: 'user1',
				sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4',
				expires: new Date('2023-06-10T14:58:09.066Z'),
			},
			{ noMetadata: true },
		);

		const sessions = await bormClient.query(
			{
				$entity: 'Session',
			},
			{ noMetadata: true },
		);

		expect(sessions).toEqual([
			{
				expires: new Date('2023-06-10T14:58:09.066Z'),
				id: expect.any(String),
				sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4',
				user: 'user1',
			},
		]);
	});

	it('n1[create, nested] nested', async () => {
		expect(bormClient).toBeDefined();

		const mutated = await bormClient.mutate(
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

		const kinds = await bormClient.query(
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

		const fields = await bormClient.query(
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
		await bormClient.mutate(
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
		expect(bormClient).toBeDefined();

		const mutated = await bormClient.mutate(
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

		const kinds = await bormClient.query(
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

		const fields = await bormClient.query(
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
		await bormClient.mutate(
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
		expect(bormClient).toBeDefined();

		const mutated = await bormClient.mutate(
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
		// console.log('myTestKind1Id', myTestKind1Id);

		/// delete both things

		await bormClient.mutate(
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
		const kinds = await bormClient.query(
			{
				$relation: 'Kind',
			},
			{ noMetadata: true },
		);

		// we expect both kinds to be deleted and show only the data.tql one
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
		await bormClient.query({ $entity: 'Space' });
	});

	it('u1[update, multiple] Shared ids', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
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

		await bormClient.mutate(
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

		const res = await bormClient.query(
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

		const allUsers = await bormClient.query(
			{
				$entity: 'User',
				$fields: ['name'],
			},
			{ noMetadata: true },
		);
		expect(deepSort(allUsers, 'name')).toEqual([
			{
				name: 'Ann',
			},
			{
				name: 'Antoine',
			},
			{
				name: 'Ben',
			},
			{
				name: 'Charlize',
			},
			{
				name: 'Jane', /// coming from previous test (b4)
			},
			{
				name: 'Jill', /// coming from previous test
			},
			{
				name: 'Loic',
			},
			{
				name: 'updated',
			},
			{
				name: 'updated',
			},
		]);

		/// delete created users and spaces
		await bormClient.mutate(
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
		const allUsers2 = await bormClient.query(
			{
				$entity: 'User',
				$fields: ['name'],
			},
			{ noMetadata: true },
		);
		/// expect only original users
		expect(deepSort(allUsers2, 'name')).toEqual([
			{
				name: 'Ann',
			},
			{
				name: 'Antoine',
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
		]);
	});

	it('u2[update, multiple, nested(many), noId] Update only children (no id)', async () => {
		// This test might fail if b4 fails

		expect(bormClient).toBeDefined();

		/// cardinality MANY
		await bormClient.mutate(
			{
				$entity: 'User',
				$id: 'user1',
				spaces: [{ $op: 'update', name: 'space2ORspace1' }],
			},
			{ noMetadata: true },
		);

		const allSpaces = await bormClient.query(
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
		await bormClient.mutate([
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
		]);
	});

	it('u3[update, multiple, nested(many), noId] Update only but all children (no id)', async () => {
		/// This test might fail if b4 fails
		expect(bormClient).toBeDefined();

		/// cardinality MANY
		await bormClient.mutate(
			{
				$entity: 'User',
				$id: ['user2', 'user5'],
				spaces: [{ $op: 'update', name: 'space2ORspace1Bis' }],
			},
			{ noMetadata: true },
		);

		const allSpaces = await bormClient.query(
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
		await bormClient.mutate([
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
		expect(bormClient).toBeDefined();

		/// cardinality ONE
		await bormClient.mutate(
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

		const allOriginalUsers = await bormClient.query(
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
				email: 'ben@test.com',
				id: 'user4',
			},
			{
				email: 'charlize@test.com',
				id: 'user5',
			},
		]);

		/// get back original emails
		await bormClient.mutate([
			{
				$id: 'user3',
				$entity: 'User',
				email: 'ann@test.com',
			},
		]);
	});

	/*
  it('f1[json] Basic nested json-like field', async () => {
    /// In general, this json-like is used only as a way to group properties that actually belong to the entity
    /// So Address is maybe not the best example, it should probably be a node itself.
    expect(bormClient).toBeDefined();
    const res = await bormClient.mutate([
      {
        $entity: 'User',
        $id: 'user3',
        address: {
          $embeddedObject: true,
          city: 'Moscow',
          street: 'Lenina',
          house: 1,
        },
      },
    ]);
    expect(res?.length).toBe(17);
  });
*/

	afterAll(async () => {
		await cleanup(dbName);
	});
});
