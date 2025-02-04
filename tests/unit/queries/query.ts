import { v4 as uuidv4 } from 'uuid';

import { deepRemoveMetaData, deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';
import type { typesSchema } from '../../mocks/generatedSchema';
import type { TypeGen } from '../../../src/types/typeGen';
import type { WithBormMetadata } from '../../../src/index';
import type { UserType } from '../../types/testTypes';
import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';

export const testQuery = createTest('Query', (ctx) => {
	it('v1[validation] - $entity missing', async () => {
		// @ts-expect-error - $entity is missing
		await expect(ctx.query({})).rejects.toThrow();
	});

	it('v2[validation] - $entity not in schema', async () => {
		await expect(ctx.query({ $entity: 'fakeEntity' })).rejects.toThrow();
	});

	it('v3[validation] - $id not existing', async () => {
		const res = await ctx.query({ $entity: 'User', $id: 'nonExisting' });
		await expect(res).toBeNull();
	});

	it('TODO{P}:e1[entity] - basic and direct link to relation', async () => {
		// Postgres: Inherited entity (God and SuperUser) is not supported
		const query = { $entity: 'User' };
		const expectedRes = [
			{
				$id: 'god1',
				$thing: 'God',
				$thingType: 'entity',
				email: 'afx@rephlex.com',
				id: 'god1',
				name: 'Richard David James',
			},
			{
				$id: 'superuser1',
				$thing: 'SuperUser',
				$thingType: 'entity',
				email: 'black.mamba@deadly-viper.com',
				id: 'superuser1',
				name: 'Beatrix Kiddo',
			},
			{
				// '$entity': 'User',
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user1',
				'name': 'Antoine',
				'email': 'antoine@test.com',
				'id': 'user1',
				'accounts': ['account1-1', 'account1-2', 'account1-3'],
				'spaces': ['space-1', 'space-2'],
				'user-tags': ['tag-1', 'tag-2'],
			},
			{
				// '$entity': 'User',
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user2',
				'name': 'Loic',
				'email': 'loic@test.com',
				'id': 'user2',
				'accounts': ['account2-1'],
				'spaces': ['space-2'],
				'user-tags': ['tag-3', 'tag-4'],
			},
			{
				// '$entity': 'User',
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user3',
				'name': 'Ann',
				'email': 'ann@test.com',
				'id': 'user3',
				'accounts': ['account3-1'],
				'spaces': ['space-2'],
				'user-tags': ['tag-2'],
			},
			{
				// $entity: 'User',
				$thing: 'User',
				$thingType: 'entity',
				$id: 'user4',
				id: 'user4',
				name: 'Ben',
			},
			{
				// $entity: 'User',
				$thing: 'User',
				$thingType: 'entity',
				$id: 'user5',
				email: 'charlize@test.com',
				id: 'user5',
				name: 'Charlize',
				spaces: ['space-1'],
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('e1.alt[entity] - basic and direct link to relation', async () => {
		const query = { $entity: 'Power' };
		const expected = [
			{
				'id': 'power1',
				'description': 'useless power',
				'space-user': 'u3-s2',
			},
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(res).toEqual(expected);
	});

	it('e1.b[entity] - basic and direct link to relation sub entity', async () => {
		const query = { $entity: 'God' };
		const expectedRes = [
			{
				$id: 'god1',
				$thing: 'God',
				$thingType: 'entity',
				email: 'afx@rephlex.com',
				id: 'god1',
				name: 'Richard David James',
				isEvil: true,
				power: 'mind control',
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('e2[entity] - filter by single $id', async () => {
		const query = { $entity: 'User', $id: 'user1' };
		const expectedRes = {
			// '$entity': 'User',
			'$thing': 'User',
			'$thingType': 'entity',
			'$id': 'user1',
			'name': 'Antoine',
			'email': 'antoine@test.com',
			'id': 'user1',
			'accounts': ['account1-1', 'account1-2', 'account1-3'],
			'spaces': ['space-1', 'space-2'],
			'user-tags': ['tag-1', 'tag-2'],
		};

		const res = (await ctx.query(query)) as UserType;

		expect(res).toBeDefined();
		expect(deepSort(res, 'id')).toEqual(expectedRes);

		// // @ts-expect-error - Not an array but should work anyway
		// expectArraysInObjectToContainSameElements(res, expectedRes);

		// expect(res['user-tags']).toEqual(expect.arrayContaining(expectedRes['user-tags']));

		// expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	});

	it('TODO{P}:e3[entity, nested] - direct link to relation, query nested ', async () => {
		// Postgres: Inherited entity (God and SuperUser) is not supported
		const query = { $entity: 'User', $fields: ['id', { $path: 'user-tags' }] };
		const expectedRes = [
			{
				$id: 'god1',
				$thing: 'God',
				$thingType: 'entity',
				id: 'god1',
			},
			{
				$id: 'superuser1',
				$thing: 'SuperUser',
				$thingType: 'entity',
				id: 'superuser1',
			},
			{
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user1',
				'id': 'user1',
				'user-tags': [
					{
						$thing: 'UserTag',
						$thingType: 'relation',
						$id: 'tag-1',
						id: 'tag-1',
						users: ['user1'],
						color: 'yellow',
						group: 'utg-1',
					},
					{
						$thing: 'UserTag',
						$thingType: 'relation',
						$id: 'tag-2',
						id: 'tag-2',
						users: ['user1', 'user3'],
						color: 'yellow',
						group: 'utg-1',
					},
				],
			},
			{
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user2',
				'id': 'user2',
				'user-tags': [
					{
						$thing: 'UserTag',
						$thingType: 'relation',
						$id: 'tag-3',
						id: 'tag-3',
						users: ['user2'],
						color: 'blue',
						group: 'utg-2',
					},
					{
						$thing: 'UserTag',
						$thingType: 'relation',
						$id: 'tag-4',
						id: 'tag-4',
						users: ['user2'],
					},
				],
			},
			{
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user3',
				'id': 'user3',
				'user-tags': [
					{
						$thing: 'UserTag',
						$thingType: 'relation',
						$id: 'tag-2',
						id: 'tag-2',
						users: ['user1', 'user3'],
						color: 'yellow',
						group: 'utg-1',
					},
				],
			},
			{
				$thing: 'User',
				$thingType: 'entity',
				$id: 'user4',
				id: 'user4',
			},
			{
				$thing: 'User',
				$thingType: 'entity',
				$id: 'user5',
				id: 'user5',
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('e3.alt[entity, nested] - direct link to relation, query nested ', async () => {
		const query = { $entity: 'Power', $fields: ['id', { $path: 'space-user' }] };
		const expected = [
			{ 'id': 'power1', 'space-user': { id: 'u3-s2', spaces: ['space-2'], users: ['user3'], power: 'power1' } },
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(res).toEqual(expected);
	});

	it('opt1[options, noMetadata', async () => {
		const query = { $entity: 'User', $id: 'user1' };
		const expectedRes = {
			'name': 'Antoine',
			'email': 'antoine@test.com',
			'id': 'user1',
			'accounts': ['account1-1', 'account1-2', 'account1-3'],
			'spaces': ['space-1', 'space-2'],
			'user-tags': ['tag-1', 'tag-2'],
		};

		type UserType = WithBormMetadata<TypeGen<typeof typesSchema.entities.User>>;
		const res = (await ctx.query(query, {
			noMetadata: true,
		})) as UserType;
		expect(res).toBeDefined();
		expect(typeof res).not.toBe('string');

		// @ts-expect-error - res should defined
		expectArraysInObjectToContainSameElements(res, expectedRes);

		expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	});

	it('TODO{PTS}:opt2[options, debugger', async () => {
		const query = { $entity: 'User', $id: 'user1' };
		const expectedRes = {
			'$id': 'user1',
			'$entity': 'User',
			/// if this fails, other stuff fails, for some reason, fix this first
			'$debugger': {
				tqlRequest: {
					entity:
						'match $User  isa User, has attribute $attribute  , has id $User_id; $User_id user1; get; group $User;',
					relations: [
						{
							entity: 'User',
							relation: 'User-Accounts',
							request:
								'match $user isa User , has id $user_id; $user_id user1;  (user: $user,accounts: $accounts ) isa User-Accounts; $accounts isa Account, has id $accounts_id; get; group $user;',
						},
						{
							entity: 'User',
							relation: 'User-Sessions',
							request:
								'match $user isa User , has id $user_id; $user_id user1;  (user: $user,sessions: $sessions ) isa User-Sessions; $sessions isa Session, has id $sessions_id; get; group $user;',
						},
						{
							entity: 'User',
							relation: 'Space-User',
							request:
								'match $users isa User , has id $users_id; $users_id user1;  (users: $users,spaces: $spaces ) isa Space-User; $spaces isa Space, has id $spaces_id; get; group $users;',
						},
						{
							entity: 'User',
							relation: 'UserTag',
							request:
								'match $users isa User , has id $users_id; $users_id user1; $UserTag (users: $users ) isa UserTag; $UserTag isa UserTag, has id $UserTag_id; get; group $users;',
						},
					],
				},
			},
			'name': 'Antoine',
			'email': 'antoine@test.com',
			'id': 'user1',
			'accounts': ['account1-1', 'account1-2', 'account1-3'],
			'spaces': ['space-1', 'space-2'],
			'user-tags': ['tag-1', 'tag-2'],
		};

		const res = (await ctx.query(query, {
			debugger: true,
		})) as UserType;
		expect(res).toBeDefined();
		expect(typeof res).not.toBe('string');

		// @ts-expect-error - res should defined
		expectArraysInObjectToContainSameElements(res, expectedRes);

		expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	});

	it('opt3a[options, returnNull] - empty fields option in entity', async () => {
		const query = {
			$entity: 'User',
			$id: 'user4',
			$fields: ['id', 'spaces', 'email', 'user-tags'],
		};
		const expectedRes = {
			'id': 'user4',
			'email': null, //Example field
			'spaces': null, //example linkfield from intermediary relation
			'user-tags': null, //example linkfield from direct relation
		};
		const res = await ctx.query(query, { returnNulls: true, noMetadata: true });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('opt3b[options, returnNull] - empty fields option in entity, dont return explicit', async () => {
		const query = {
			$entity: 'User',
			$id: 'user4',
			$fields: ['id', 'spaces', 'email'],
		};
		const expectedRes = {
			id: 'user4',
			email: null, //Example field
			spaces: null, //example linkfield from intermediary relation
		};
		const res = await ctx.query(query, { noMetadata: true, returnNulls: true });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('r1[relation] - basic', async () => {
		const query = { $relation: 'User-Accounts' };
		const expectedRes = [
			{
				// $relation: 'User-Accounts',
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-1',
				id: 'ua1-1',
				user: 'user1',
				accounts: ['account1-1'],
			},
			{
				// $relation: 'User-Accounts',
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-2',
				id: 'ua1-2',
				user: 'user1',
				accounts: ['account1-2'],
			},
			{
				// $relation: 'User-Accounts',
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-3',
				id: 'ua1-3',
				user: 'user1',
				accounts: ['account1-3'],
			},
			{
				// $relation: 'User-Accounts',
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua2-1',
				id: 'ua2-1',
				user: 'user2',
				accounts: ['account2-1'],
			},
			{
				// $relation: 'User-Accounts',
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua3-1',
				id: 'ua3-1',
				user: 'user3',
				accounts: ['account3-1'],
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(
			expectedRes.map(({ $id: _id, $thing: _thing, $thingType: _thingType, ...rest }) => rest),
		);
	});

	it('r2[relation] - filtered fields', async () => {
		const query = { $relation: 'User-Accounts', $fields: ['id', 'user'] };
		const expectedRes = [
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-1',
				id: 'ua1-1',
				user: 'user1',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-2',
				id: 'ua1-2',
				user: 'user1',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-3',
				id: 'ua1-3',
				user: 'user1',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua2-1',
				id: 'ua2-1',
				user: 'user2',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua3-1',
				id: 'ua3-1',
				user: 'user3',
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res)).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'user')).toEqual(
			expectedRes.map(({ $id: _id, $thing: _thing, $thingType: _thingType, ...rest }) => rest),
		);
	});

	it('r3[relation, nested] - nested entity', async () => {
		const query = {
			$relation: 'User-Accounts',
			$fields: ['id', { $path: 'user', $fields: ['id', 'name'] }],
		};
		const expectedRes = [
			{
				id: 'ua1-1',
				user: {
					id: 'user1',
					name: 'Antoine',
				},
			},
			{
				id: 'ua1-2',
				user: {
					id: 'user1',
					name: 'Antoine',
				},
			},
			{
				id: 'ua1-3',
				user: {
					id: 'user1',
					name: 'Antoine',
				},
			},
			{
				id: 'ua2-1',
				user: {
					id: 'user2',
					name: 'Loic',
				},
			},
			{
				id: 'ua3-1',
				user: {
					id: 'user3',
					name: 'Ann',
				},
			},
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, '$id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{P}:r4[relation, nested, direct] - nested relation direct on relation', async () => {
		// Postgres:
		// - Role field UserTagGroup.tagId and UserTag.tagId cannot reference multiple records.
		const query = {
			$relation: 'UserTag',
			$fields: [
				'id',
				{ $path: 'users', $fields: ['id'] },
				{ $path: 'group', $fields: ['id'] },
				{ $path: 'color', $fields: ['id'] },
			],
		};
		const expectedRes = [
			{
				$id: 'tag-1',
				id: 'tag-1',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: { $id: 'yellow', $thing: 'Color', $thingType: 'entity', id: 'yellow' },
				group: { $id: 'utg-1', $thing: 'UserTagGroup', $thingType: 'relation', id: 'utg-1' },
				users: [{ $id: 'user1', $thing: 'User', $thingType: 'entity', id: 'user1' }],
			},
			{
				$id: 'tag-2',
				id: 'tag-2',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: { $id: 'yellow', $thing: 'Color', $thingType: 'entity', id: 'yellow' },
				group: { $id: 'utg-1', $thing: 'UserTagGroup', $thingType: 'relation', id: 'utg-1' },
				users: [
					{ $id: 'user1', $thing: 'User', $thingType: 'entity', id: 'user1' },
					{ $id: 'user3', $thing: 'User', $thingType: 'entity', id: 'user3' },
				],
			},
			{
				$id: 'tag-3',
				id: 'tag-3',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: { $id: 'blue', $thing: 'Color', $thingType: 'entity', id: 'blue' },
				group: { $id: 'utg-2', $thing: 'UserTagGroup', $thingType: 'relation', id: 'utg-2' },
				users: [{ $id: 'user2', $thing: 'User', $thingType: 'entity', id: 'user2' }],
			},
			{
				$id: 'tag-4',
				id: 'tag-4',
				$thing: 'UserTag',
				$thingType: 'relation',
				users: [{ $id: 'user2', $thing: 'User', $thingType: 'entity', id: 'user2' }],
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{ST}:r4.alt[relation, nested, direct] - nested relation direct on relation', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Room',
			$fields: ['id', { $path: 'bookings', $fields: ['id'] }, { $path: 'guests', $fields: ['id'] }],
		};
		const expected = [
			{ id: 'r1' },
			{ id: 'r2', bookings: [{ id: 'b1' }], guests: [{ id: 'g1' }] },
			{ id: 'r3', bookings: [{ id: 'b3' }], guests: [{ id: 'g3' }] },
			{ id: 'r4' },
			{ id: 'r5', bookings: [{ id: 'b2' }], guests: [{ id: 'g2' }] },
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('TODO{P}:r5[relation nested] - that has both role, and linkfield pointing to same role', async () => {
		// Postgres:
		// - Role field UserTagGroup.tagId cannot reference multiple records.
		const query = {
			$entity: 'Color',
			$fields: ['id', 'user-tags', 'group'],
		};
		const expectedRes = [
			{
				'$id': 'blue',
				'$thing': 'Color',
				'$thingType': 'entity',
				'id': 'blue',
				'group': 'utg-2',
				'user-tags': ['tag-3'],
			},
			{
				$id: 'red',
				$thing: 'Color',
				$thingType: 'entity',
				id: 'red',
			},
			{
				'$id': 'yellow',
				'$thing': 'Color',
				'$thingType': 'entity',
				'id': 'yellow',
				'group': 'utg-1',
				'user-tags': ['tag-1', 'tag-2'],
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{ST}:r5.alt[relation nested] - that has both role, and linkfield pointing to same role', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Room',
			$fields: ['id', 'bookings', 'guests'],
		};
		const expected = [
			{ id: 'r1' },
			{ id: 'r2', bookings: ['b1'], guests: ['g1'] },
			{ id: 'r3', bookings: ['b3'], guests: ['g3'] },
			{ id: 'r4' },
			{ id: 'r5', bookings: ['b2'], guests: ['g2'] },
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('TODO{P}:r6[relation nested] - relation connected to relation and a tunneled relation', async () => {
		// Postgres:
		// - Role field UserTagGroup.tagId and UserTag.tagId cannot reference multiple records.
		const query = {
			$relation: 'UserTag',
		};
		const expectedRes = [
			{
				$id: 'tag-1',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: 'yellow',
				group: 'utg-1',
				id: 'tag-1',
				users: ['user1'],
			},
			{
				$id: 'tag-2',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: 'yellow',
				group: 'utg-1',
				id: 'tag-2',
				users: ['user1', 'user3'],
			},
			{
				$id: 'tag-3',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: 'blue',
				group: 'utg-2',
				id: 'tag-3',
				users: ['user2'],
			},
			{
				$id: 'tag-4',
				$thing: 'UserTag',
				$thingType: 'relation',
				id: 'tag-4',
				users: ['user2'],
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{ST}:r6.alt[relation nested] - relation connected to relation and a tunneled relation', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = { $relation: 'Room' };
		const expected = [
			{ id: 'r1', pricePerNight: '150.00', isAvailable: true, hotel: 'h1' },
			{ id: 'r2', pricePerNight: '200.00', isAvailable: false, hotel: 'h1', bookings: ['b1'], guests: ['g1'] },
			{ id: 'r3', pricePerNight: '180.00', isAvailable: true, hotel: 'h2', bookings: ['b3'], guests: ['g3'] },
			{ id: 'r4', pricePerNight: '220.00', isAvailable: true, hotel: 'h2' },
			{ id: 'r5', pricePerNight: '100.00', isAvailable: false, hotel: 'h3', bookings: ['b2'], guests: ['g2'] },
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('TODO{P}:r7[relation, nested, direct] - nested on nested', async () => {
		// Postgres:
		// - Inherited entity/relation is not supported (God and SuperUser are inherited from Used).
		// - Role field UserTagGroup.tagId cannot reference multiple records.
		const query = {
			$relation: 'UserTag',
			$fields: [
				'id',
				{ $path: 'users', $fields: ['id', 'spaces'] },
				{ $path: 'group' },
				{ $path: 'color', $fields: ['id', 'user-tags', 'group'] },
			],
		};
		const expectedRes = [
			{
				$id: 'tag-1',
				id: 'tag-1',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: {
					'$id': 'yellow',
					'$thing': 'Color',
					'$thingType': 'entity',
					'id': 'yellow',
					'group': 'utg-1',
					'user-tags': ['tag-1', 'tag-2'],
				},
				group: {
					$id: 'utg-1',
					$thing: 'UserTagGroup',
					$thingType: 'relation',
					id: 'utg-1',
					color: 'yellow',
					tags: ['tag-1', 'tag-2'],
				},
				users: [
					{
						$id: 'user1',
						$thing: 'User',
						$thingType: 'entity',
						id: 'user1',
						spaces: ['space-1', 'space-2'],
					},
				],
			},
			{
				$id: 'tag-2',
				id: 'tag-2',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: {
					'$id': 'yellow',
					'$thing': 'Color',
					'$thingType': 'entity',
					'id': 'yellow',
					'group': 'utg-1',
					'user-tags': ['tag-1', 'tag-2'],
				},
				group: {
					$id: 'utg-1',
					$thing: 'UserTagGroup',
					$thingType: 'relation',
					id: 'utg-1',
					color: 'yellow',
					tags: ['tag-1', 'tag-2'],
				},
				users: [
					{
						$id: 'user1',
						$thing: 'User',
						$thingType: 'entity',
						id: 'user1',
						spaces: ['space-1', 'space-2'],
					},
					{ $id: 'user3', $thing: 'User', $thingType: 'entity', id: 'user3', spaces: ['space-2'] },
				],
			},
			{
				$id: 'tag-3',
				id: 'tag-3',
				$thing: 'UserTag',
				$thingType: 'relation',
				color: {
					'$id': 'blue',
					'$thing': 'Color',
					'$thingType': 'entity',
					'id': 'blue',
					'group': 'utg-2',
					'user-tags': ['tag-3'],
				},
				group: {
					$id: 'utg-2',
					$thing: 'UserTagGroup',
					$thingType: 'relation',
					id: 'utg-2',
					color: 'blue',
					space: 'space-3',
					tags: ['tag-3'],
				},
				users: [
					{
						$id: 'user2',
						$thing: 'User',
						$thingType: 'entity',
						id: 'user2',
						spaces: ['space-2'],
					},
				],
			},
			{
				$id: 'tag-4',
				$thing: 'UserTag',
				$thingType: 'relation',
				id: 'tag-4',
				users: [
					{
						$thing: 'User',
						$thingType: 'entity',
						$id: 'user2',
						id: 'user2',
						spaces: ['space-2'],
					},
				],
			},
		];
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{ST}:r7.alt[relation, nested, direct] - nested on nested', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Room',
			$fields: [
				'id',
				{ $path: 'bookings', $fields: ['id', 'guest'] },
				{ $path: 'guests', $fields: ['id', 'bookings'] },
			],
		};
		const expected = [
			{ id: 'r1' },
			{ id: 'r2', bookings: [{ id: 'b1', guest: 'g1' }], guests: [{ id: 'g1', bookings: ['b1'] }] },
			{ id: 'r3', bookings: [{ id: 'b3', guest: 'g3' }], guests: [{ id: 'g3', bookings: ['b3'] }] },
			{ id: 'r4' },
			{ id: 'r5', bookings: [{ id: 'b2', guest: 'g2' }], guests: [{ id: 'g2', bookings: ['b2'] }] },
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('TODO{P}:r8[relation, nested, deep] - deep nested', async () => {
		// Postgres:
		// - Inherited entity/relation is not supported (God and SuperUser are inherited from Used).
		// - Role field UserTagGroup.tagId cannot reference multiple records.
		const query = {
			$entity: 'Space',
			$id: 'space-2',
			$fields: [
				'id',
				{
					$path: 'users',
					$id: 'user2',
					$fields: [
						'id',
						{ $path: 'user-tags', $fields: [{ $path: 'color', $fields: ['id', 'user-tags', 'group'] }, 'id'] },
					],
				},
			],
		};
		const expectedRes = {
			$thing: 'Space',
			$thingType: 'entity',
			$id: 'space-2',
			id: 'space-2',
			users: {
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user2',
				'id': 'user2',
				'user-tags': [
					{
						$id: 'tag-3',
						id: 'tag-3',
						$thing: 'UserTag',
						$thingType: 'relation',
						color: {
							'$thing': 'Color',
							'$thingType': 'entity',
							'$id': 'blue',
							'id': 'blue',
							'group': 'utg-2',
							'user-tags': ['tag-3'],
						},
					},
					{
						$id: 'tag-4',
						id: 'tag-4',
						$thing: 'UserTag',
						$thingType: 'relation',
					},
				],
			},
		};
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{ST}:r8.alt[relation, nested, deep] - deep nested', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$id: 'h1',
			$fields: [
				'id',
				{
					$path: 'rooms',
					$id: 'r2',
					$fields: ['id', { $path: 'bookings', $fields: ['id', { $path: 'guest', $fields: ['id', 'bookings'] }] }],
				},
			],
		};
		const expected = { id: 'h1', rooms: { id: 'r2', bookings: [{ id: 'b1', guest: { id: 'g1', bookings: ['b1'] } }] } };
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('TODO{P}:r9[relation, nested, ids]', async () => {
		// Postgres: Role field UserTagGroup.tagId cannot reference multiple records.
		const query = {
			$relation: 'UserTagGroup',
			$id: 'utg-1',
			$fields: ['tags', 'color'],
		};
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$thing: 'UserTagGroup',
			$thingType: 'relation',
			$id: 'utg-1',
			tags: ['tag-1', 'tag-2'],
			color: 'yellow',
		});
	});

	it('TODO{ST}:r9.alt[relation, nested, ids]', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$id: 'h1',
			$fields: ['id', 'rooms'],
		};
		const expected = { id: 'h1', rooms: ['r1', 'r2'] };
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('ef1[entity] - $id single', async () => {
		const wrongRes = await ctx.query({ $entity: 'User', $id: uuidv4() });
		expect(wrongRes).toEqual(null);
		const validRes = await ctx.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['id'],
		});
		expect(validRes).toEqual({ $thing: 'User', $thingType: 'entity', $id: 'user1', id: 'user1' });
	});

	it('ef2[entity] - $id multiple', async () => {
		const res = await ctx.query({
			$entity: 'User',
			$id: ['user1', 'user2'],
			$fields: ['id'],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{ $thing: 'User', $thingType: 'entity', $id: 'user1', id: 'user1' },
			{ $thing: 'User', $thingType: 'entity', $id: 'user2', id: 'user2' },
		]);
	});

	it('TODO{P}:ef3[entity] - $fields single', async () => {
		// Postgres: Inherited entity/relation is not supported
		const res = await ctx.query({ $entity: 'User', $fields: ['id'] });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{
				$id: 'god1',
				$thing: 'God',
				$thingType: 'entity',
				id: 'god1',
			},
			{
				$id: 'superuser1',
				$thing: 'SuperUser',
				$thingType: 'entity',
				id: 'superuser1',
			},
			{ $thing: 'User', $thingType: 'entity', $id: 'user1', id: 'user1' },
			{ $thing: 'User', $thingType: 'entity', $id: 'user2', id: 'user2' },
			{ $thing: 'User', $thingType: 'entity', $id: 'user3', id: 'user3' },
			{ $thing: 'User', $thingType: 'entity', $id: 'user4', id: 'user4' },
			{ $thing: 'User', $thingType: 'entity', $id: 'user5', id: 'user5' },
		]);
	});

	it('TODO{ST}:ef3.alt[entity] - $fields single', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$fields: ['id'],
		};
		const expected = [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('ef4[entity] - $fields multiple', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: 'user1',
				$fields: ['id', 'name', 'email'],
			},
			{ noMetadata: true },
		);
		expect(res).toEqual({
			id: 'user1',
			name: 'Antoine',
			email: 'antoine@test.com',
		});
	});

	it('ef5[entity,filter] - $filter single', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$filter: { name: 'Antoine' },
				$fields: ['id', 'name'],
			},
			{ noMetadata: true },
		);
		// notice now it is an array. Multiple users could be called Antoine
		expect(res).toEqual([{ id: 'user1', name: 'Antoine' }]);
	});

	it('ef6[entity,filter,id] - $filter by id in filter', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$filter: { id: 'user1' },
				$fields: ['id', 'name'],
			},
			{ noMetadata: true },
		);
		expect(res).toEqual({ id: 'user1', name: 'Antoine' });
	});

	it('ef7[entity,unique] - $filter by unique field', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$filter: { email: 'antoine@test.com' },
				$fields: ['id', 'name', 'email'],
			},
			{ noMetadata: true },
		);
		// and now its not an array again, we used at least one property in the filter that is either the single key specified in idFields: ['id'] or has a validations.unique:true
		expect(res).toEqual({
			id: 'user1',
			name: 'Antoine',
			email: 'antoine@test.com',
		});
	});

	it('n1[nested] Only ids', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: 'user1',
				$fields: ['id', 'name', 'accounts'],
			},
			{ noMetadata: true },
		);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			id: 'user1',
			name: 'Antoine',
			accounts: ['account1-1', 'account1-2', 'account1-3'],
		});
	});

	it('TODO{P}:n2[nested] First level all fields', async () => {
		// Postgres: isSecureProvider is computed in the database
		const query = {
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', { $path: 'accounts' }],
		};
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$thing: 'User',
			$thingType: 'entity',
			$id: 'user1',
			name: 'Antoine',
			accounts: [
				{
					$thing: 'Account',
					$thingType: 'entity',
					$id: 'account1-1',
					id: 'account1-1',
					provider: 'google',
					isSecureProvider: true,
					profile: {
						hobby: ['Running'],
					},
					user: 'user1',
				},
				{
					$thing: 'Account',
					$thingType: 'entity',
					$id: 'account1-2',
					id: 'account1-2',
					provider: 'facebook',
					isSecureProvider: false,
					user: 'user1',
				},
				{
					$thing: 'Account',
					$thingType: 'entity',
					$id: 'account1-3',
					id: 'account1-3',
					provider: 'github',
					isSecureProvider: false,
					user: 'user1',
				},
			],
		});
		const resWithoutMetadata = await ctx.query(query, { noMetadata: true });

		expect(deepSort(resWithoutMetadata, 'id')).toEqual({
			name: 'Antoine',
			accounts: [
				{
					id: 'account1-1',
					provider: 'google',
					isSecureProvider: true,
					profile: { hobby: ['Running'] },
					user: 'user1',
				},
				{
					id: 'account1-2',
					provider: 'facebook',
					isSecureProvider: false,
					user: 'user1',
				},
				{
					id: 'account1-3',
					provider: 'github',
					isSecureProvider: false,
					user: 'user1',
				},
			],
		});
	});

	it('TODO{ST}:n2.alt[nested] First level all fields', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$id: 'h1',
			$fields: ['id', { $path: 'rooms' }],
		};
		const expected = {
			id: 'h1',
			rooms: [
				{ id: 'r1', pricePerNight: '150.00', isAvailable: true, hotel: 'h1' },
				{ id: 'r2', pricePerNight: '200.00', isAvailable: false, hotel: 'h1', bookings: ['b1'], guests: ['g1'] },
			],
		};
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('n3[nested, $fields] First level filtered fields', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: 'user1',
				$fields: ['id', 'name', { $path: 'accounts', $fields: ['id', 'provider'] }],
			},
			{ noMetadata: true },
		);
		expect(res).toBeDefined();
		expect(deepSort(res)).toEqual({
			id: 'user1',
			name: 'Antoine',
			accounts: [
				{ id: 'account1-1', provider: 'google' },
				{ id: 'account1-2', provider: 'facebook' },
				{ id: 'account1-3', provider: 'github' },
			],
		});
	});

	it('n4a[nested, $id] Local filter on nested, by id', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: ['user1', 'user2', 'user3'],
				$fields: [
					'id',
					'name',
					{
						$path: 'accounts',
						$id: 'account3-1', // id specified so nested children has to be an objec and not an array
						$fields: ['id', 'provider'],
					},
				],
			},
			{ noMetadata: true },
		);

		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res)).toEqual([
			{
				id: 'user1',
				name: 'Antoine',
			},
			{
				id: 'user2',
				name: 'Loic',
			},
			{
				id: 'user3',
				name: 'Ann',
				// accounts here has to be a single object, not an array because we specified an id in the nested query
				accounts: {
					id: 'account3-1',
					provider: 'facebook',
				},
			},
		]);
	});

	it('n4b[nested, $id] Local filter on nested depth two, by id', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: 'user1',
				$fields: [
					'id',
					{
						$path: 'spaces',
						$id: 'space-1', // id specified so nested children has to be an objec and not an array
						$fields: ['id', { $path: 'users', $id: 'user1', $fields: ['id'] }],
					},
				],
			},
			{ noMetadata: true },
		);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			id: 'user1',
			spaces: {
				id: 'space-1',
				users: {
					id: 'user1',
				},
			},
		});
	});

	it('TODO{P}:nf1[nested, $filters] Local filter on nested, single id', async () => {
		// Postgres: Computed data field (isSecureProvider) is not supported
		const res = await ctx.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', { $path: 'accounts', $filter: { provider: { $eq: 'github' } } }],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$thing: 'User',
			$thingType: 'entity',
			$id: 'user1',
			name: 'Antoine',
			accounts: [
				{
					$thing: 'Account',
					$thingType: 'entity',
					$id: 'account1-3',
					id: 'account1-3',
					provider: 'github',
					isSecureProvider: false,
					user: 'user1',
				},
			],
		});
	});

	it('TODO{ST}:nf1.alt[nested, $filters] Local filter on nested, single id', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$id: 'h1',
			$fields: ['id', { $path: 'rooms', $filter: { isAvailable: true } }],
		};
		const expected = {
			id: 'h1',
			rooms: [{ id: 'r1', pricePerNight: '150.00', isAvailable: true, hotel: 'h1' }],
		};
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual(expected);
	});

	it('nf2[nested, $filters] Local filter on nested, by field, multiple sources, some are empty', async () => {
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: ['user1', 'user2', 'user3'],
				$fields: [
					'name',
					{
						$path: 'accounts',
						$filter: { provider: 'google' },
						$fields: ['provider'],
					},
				],
			},
			{ noMetadata: true },
		);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{
				id: 'user1',
				name: 'Antoine',
				accounts: [
					// array, we can't know it was only one
					{ id: 'account1-1', provider: 'google' },
				],
			},
			{
				id: 'user2',
				name: 'Loic',
				accounts: [{ id: 'account2-1', provider: 'google' }],
			},
			{
				id: 'user3',
				name: 'Ann',
			},
		]);
	});

	it('TODO{P}:nf3[nested, $filters] Local filter on nested, by link field, multiple sources', async () => {
		// Postgres: Filter by non-local field (UserTag.id) is not supported
		const res = await ctx.query({
			$entity: 'Space',
			$fields: [
				'name',
				{
					$path: 'users',
					$filter: { 'user-tags': ['tag-1', 'tag-2'] },
					$fields: ['name'],
				},
			],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{
				users: [
					{
						name: 'Antoine',
						$id: 'user1',
						$thing: 'User',
						$thingType: 'entity',
					},
				],
				$thing: 'Space',
				$thingType: 'entity',
				name: 'Production',
				$id: 'space-1',
			},
			{
				users: [
					{
						name: 'Antoine',
						$id: 'user1',
						$thing: 'User',
						$thingType: 'entity',
					},
					{
						name: 'Ann',
						$id: 'user3',
						$thing: 'User',
						$thingType: 'entity',
					},
				],
				$thing: 'Space',
				$thingType: 'entity',
				name: 'Dev',
				$id: 'space-2',
			},
			{
				$thing: 'Space',
				$thingType: 'entity',
				name: 'Not-owned',
				$id: 'space-3',
			},
		]);
	});

	it('TODO{P}:nf4[nested, $filters] Local filter on nested, by link field, multiple sources', async () => {
		// Postgres: Filter by non-local field (Space-User.spaceId) is not supported
		const res = await ctx.query({
			$relation: 'UserTag',
			$fields: [
				'name',
				{
					$path: 'users',
					$filter: { spaces: ['space-1', 'space-2'] },
					$fields: ['name'],
				},
			],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{
				users: [
					{
						name: 'Antoine',
						$id: 'user1',
						$thing: 'User',
						$thingType: 'entity',
					},
				],
				$thing: 'UserTag',
				$thingType: 'relation',
				$id: 'tag-1',
			},
			{
				users: [
					{
						name: 'Antoine',
						$id: 'user1',
						$thing: 'User',
						$thingType: 'entity',
					},
					{
						name: 'Ann',
						$id: 'user3',
						$thing: 'User',
						$thingType: 'entity',
					},
				],
				$thing: 'UserTag',
				$thingType: 'relation',
				$id: 'tag-2',
			},
			{
				users: [
					{
						name: 'Loic',
						$id: 'user2',
						$thing: 'User',
						$thingType: 'entity',
					},
				],
				$thing: 'UserTag',
				$thingType: 'relation',
				$id: 'tag-3',
			},
			{
				users: [
					{
						name: 'Loic',
						$id: 'user2',
						$thing: 'User',
						$thingType: 'entity',
					},
				],
				$thing: 'UserTag',
				$thingType: 'relation',
				$id: 'tag-4',
			},
		]);
	});

	it('TODO{PTS}:nf2a[nested, $filters] Nested filter for array of ids', async () => {
		expect(true).toEqual(false);
	});

	it('lf1[$filter] Filter by a link field with cardinality ONE', async () => {
		// Postgres: Filter by role field (User-Account.userId) is not supported
		const res = await ctx.query(
			{
				$relation: 'User-Accounts',
				$filter: { user: 'user1' },
				$fields: ['id'],
			},
			{ noMetadata: true },
		);
		expect(deepSort(res, 'id')).toMatchObject([{ id: 'ua1-1' }, { id: 'ua1-2' }, { id: 'ua1-3' }]);
	});

	it('lf2[$filter, $not] Filter out by a link field with cardinality ONE', async () => {
		// Postgres: Filter by role field (User-Account.userId) is not supported
		const res = await ctx.query(
			{
				$relation: 'User-Accounts',
				$filter: {
					$not: { user: ['user1'] },
				},
				$fields: ['id'],
			},
			{ noMetadata: true },
		);
		expect(deepSort(res, 'id')).toMatchObject([{ id: 'ua2-1' }, { id: 'ua3-1' }]);
	});

	it('TODO{P}:lf3[$filter] Filter by a link field with cardinality MANY', async () => {
		// Postgres: Filter by non-local field (Space-User.spaceId) is not supported
		const res = await ctx.query(
			{
				$entity: 'User',
				$filter: { spaces: ['space-1'] },
				$fields: ['id'],
			},
			{ noMetadata: true },
		);
		expect(deepSort(res, 'id')).toMatchObject([{ id: 'user1' }, { id: 'user5' }]);
	});

	it('TODO{PT}:lf4[$filter, $or] Filter by a link field with cardinality MANY', async () => {
		//!: FAILS IN TQL
		const res = await ctx.query(
			{
				$entity: 'User',
				//@ts-expect-error - TODO: This is valid syntax but requires refactoring the filters
				$filter: [{ spaces: ['space-1'] }, { email: 'ann@test.com' }],
				$fields: ['id'],
			},
			{ noMetadata: true },
		);
		expect(deepSort(res, 'id')).toMatchObject([{ id: 'user1' }, { id: 'user3' }, { id: 'user5' }]);
	});

	it('slo1[$sort, $limit, $offset] root', async () => {
		const res = await ctx.query(
			{
				$entity: 'Account',
				$sort: [{ field: 'provider', desc: false }, 'id'],
				$offset: 1,
				$limit: 2,
				$fields: ['id', 'provider'],
			},
			{ noMetadata: true },
		);
		expect(res).toMatchObject([
			// { id: 'account1-2'},
			{ id: 'account3-1', provider: 'facebook' },
			{ id: 'account1-3', provider: 'github' },
			// { id: 'account1-1'},
			// { id: 'account2-1'},
		]);
	});

	it('TODO{P}:slo2[$sort, $limit, $offset] sub level', async () => {
		// Postgres: sort, limit, and offset not at the root level is not supported
		const res = await ctx.query(
			{
				$entity: 'User',
				$id: 'user1',
				$fields: [
					'id',
					{
						$path: 'accounts',
						$fields: ['id', 'provider'],
						$sort: ['provider'],
						$offset: 1,
						$limit: 1,
					},
				],
			},
			{ noMetadata: true },
		);
		expect(res).toMatchObject({
			accounts: [
				// \\{ id: 'account1-2' },
				{ id: 'account1-3', provider: 'github' },
				// { id: 'account1-1' },
			],
			id: 'user1',
		});
	});

	it('TODO{PS}:slo3[$sort, $limit, $offset] with an empty attribute', async () => {
		//! fails in SURQL
		const res = await ctx.query(
			{
				$entity: 'User',
				$fields: ['id', 'email'],
				$sort: ['email'],
			},
			{ noMetadata: true },
		);
		expect(res).toMatchObject([
			{
				email: 'afx@rephlex.com',
				id: 'god1',
			},
			{
				email: 'ann@test.com',
				id: 'user3',
			},
			{
				email: 'antoine@test.com',
				id: 'user1',
			},
			{
				email: 'black.mamba@deadly-viper.com',
				id: 'superuser1',
			},
			{
				email: 'charlize@test.com',
				id: 'user5',
			},
			{
				email: 'loic@test.com',
				id: 'user2',
			},
			{
				id: 'user4',
			},
		]);
	});

	it('i1[inherited, attributes] Entity with inherited attributes', async () => {
		const res = await ctx.query({ $entity: 'God', $id: 'god1' }, { noMetadata: true });
		expect(res).toEqual({
			id: 'god1',
			name: 'Richard David James',
			email: 'afx@rephlex.com',
			power: 'mind control',
			isEvil: true,
		});
	});

	it('TODO{PTS}:i2[inherited, attributes] Entity with inherited attributes should fetch them even when querying from parent class', async () => {
		const res = await ctx.query({ $entity: 'User', $id: 'god1' }, { noMetadata: true });
		expect(res).toEqual({
			id: 'god1',
			name: 'Richard David James',
			email: 'afx@rephlex.com',
			power: 'mind control',
			isEvil: true,
		});
	});

	it('s1[self] Relation playing a a role defined by itself', async () => {
		const res = await ctx.query({ $relation: 'Self' }, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual([
			{ id: 'self1', owned: ['self2'], space: 'space-2' },
			{ id: 'self2', owned: ['self3', 'self4'], owner: 'self1', space: 'space-2' },
			{ id: 'self3', owner: 'self2', space: 'space-2' },
			{ id: 'self4', owner: 'self2', space: 'space-2' },
		]);
	});

	it('TODO{P}:ex1[extends] Query where an object plays 3 different roles because it extends 2 types', async () => {
		// Postgres: Inherited relation (Self, Kind, and SpaceDef) is not supported
		/// note: fixed with an ugly workaround (getEntityName() in parseTQL.ts)

		const res = await ctx.query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual({
			objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
			definitions: ['kind-book'],
			id: 'space-2',
			kinds: ['kind-book'],
			name: 'Dev',
			selfs: ['self1', 'self2', 'self3', 'self4'],
			users: ['user1', 'user2', 'user3'],
		});
	});

	it('TODO{P}:ex2[extends] Query of the parent', async () => {
		// Postgres: Inherited relation (Self, Kind, and SpaceDef) is not supported
		/// note: fixed with an ugly workaround (getEntityName() in parseTQL.ts)
		const res = await ctx.query({ $entity: 'Space', $id: 'space-2', $fields: ['objects'] }, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual({
			objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
		});
	});

	it('TODO{PTS}:re1[repeated] Query with repeated path, different nested ids', async () => {
		const res = await ctx.query(
			{
				$entity: 'Space',
				$id: 'space-2',
				$fields: [
					{ $path: 'users', $id: 'user2', $fields: ['id', 'name'] },
					{ $path: 'users', $id: 'user3', $fields: ['id', { $path: 'accounts', $fields: ['id', 'provider'] }] },
				],
			},
			{ noMetadata: true },
		);

		expect(res).toEqual({
			$entity: 'Space',
			users: [
				{
					id: 'user2',
					name: 'user2name',
				},
				{
					id: 'user3',
					accounts: [{ id: 'accountZ', provider: 'whatever' }],
				},
			],
		});
	});

	it('TODO{PTS}:re2[repeated] Query with repeated path, different nested patterns', async () => {
		const res = await ctx.query(
			{
				$entity: 'Space',
				$id: 'space-2',
				$fields: ['users', { $path: 'users', $id: 'user3', $fields: ['id', 'name'] }],
			},
			{ noMetadata: true },
		);

		expect(res).toEqual({
			$entity: 'Space',
			users: [
				'user2',
				{
					id: 'user3',
					name: 'user3name',
				},
				'user4',
			],
		});
	});

	it('xf1[excludedFields] Testing excluded fields', async () => {
		const queryRes = await ctx.query(
			{
				$entity: 'God',
				$id: 'god1',
				$excludedFields: ['email', 'isEvil'],
			},
			{ noMetadata: true },
		);

		expect(queryRes).toEqual({
			id: 'god1',
			name: 'Richard David James',
			power: 'mind control',
		});
	});

	it('TODO{P}:xf2[excludedFields, deep] - deep nested', async () => {
		// Postgres:
		// - Computed data field (isBlue) is not supported
		// - Data field type flex (freeForAll) is not supported
		const query = {
			$entity: 'Space',
			$id: 'space-2',
			$fields: [
				'id',
				{
					$path: 'users',
					$id: 'user2',
					$fields: [
						'id',
						{ $path: 'user-tags', $fields: [{ $path: 'color', $excludedFields: ['id', 'totalUserTags'] }, 'id'] },
					],
				},
			],
		};
		const expectedRes = {
			$thing: 'Space',
			$thingType: 'entity',
			$id: 'space-2',
			id: 'space-2',
			users: {
				'$thing': 'User',
				'$thingType': 'entity',
				'$id': 'user2',
				'id': 'user2',
				'user-tags': [
					{
						$id: 'tag-3',
						id: 'tag-3',
						$thing: 'UserTag',
						$thingType: 'relation',
						color: {
							'$thing': 'Color',
							'$thingType': 'entity',
							'$id': 'blue',
							'group': 'utg-2',
							'user-tags': ['tag-3'],
							'isBlue': true,
							'freeForAll': 'hey',
						},
					},
					{
						$id: 'tag-4',
						id: 'tag-4',
						$thing: 'UserTag',
						$thingType: 'relation',
					},
				],
			},
		};
		const res = await ctx.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{ST}:xf2.alt[excludedFields, deep] - deep nested', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$id: 'h1',
			$fields: [
				'id',
				{ $path: 'rooms', $id: 'r2', $fields: ['id', { $path: 'bookings', $excludedFields: ['roomId'] }] },
			],
		};
		const expected = {
			id: 'h1',
			rooms: {
				id: 'r2',
				bookings: [
					{
						id: 'b1',
						checkIn: '2024-01-31T16:00:00.000Z',
						checkOut: '2024-02-04T16:00:00.000Z',
						status: 'checked-in',
						totalCost: '800.00',
						room: 'r2',
						guest: 'g1',
						payments: ['p1'],
					},
				],
			},
		};
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(JSON.parse(JSON.stringify(res)), 'id')).toEqual(expected);
	});

	it('TODO{P}:xf3[excludedFields, deep] - Exclude virtual field', async () => {
		// Postgres: Computed data field (freeForAll) is not supported
		const query = {
			$entity: 'User',
			$id: 'user2',
			$fields: [
				'id',
				{ $path: 'user-tags', $fields: [{ $path: 'color', $excludedFields: ['isBlue', 'totalUserTags'] }, 'id'] },
			],
		};

		const expectedRes = {
			'id': 'user2',
			'user-tags': [
				{
					id: 'tag-3',
					color: {
						'id': 'blue',
						'group': 'utg-2',
						'user-tags': ['tag-3'],
						'freeForAll': 'hey',
					},
				},
				{
					id: 'tag-4',
				},
			],
		};
		const res = await ctx.query(query, { noMetadata: true });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await ctx.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('TODO{P}:vi1[virtual, attribute] Virtual DB field', async () => {
		// Postgres: Computed data field (isSecureProvider) is not supported
		//This works with TypeDB rules
		const res = await ctx.query({ $entity: 'Account', $fields: ['id', 'isSecureProvider'] }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'account1-1',
				isSecureProvider: true,
			},
			{
				id: 'account1-2',
				isSecureProvider: false,
			},
			{
				id: 'account1-3',
				isSecureProvider: false,
			},
			{
				id: 'account2-1',
				isSecureProvider: true,
			},
			{
				id: 'account3-1',
				isSecureProvider: false,
			},
		]);
	});

	it('TODO{P}:vi2[virtual, edge] Virtual DB edge field', async () => {
		// Postgres: Computed link field (tagA and otherTags) is not supported
		//This works with TypeDB rules
		const res = await ctx.query({ $entity: 'Hook' }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'hook1',
				otherTags: ['hook2', 'hook3', 'hook5'],
				requiredOption: 'a',
			},
			{
				id: 'hook2',
				requiredOption: 'b',
				tagA: ['hook1', 'hook4'],
			},
			{
				id: 'hook3',
				requiredOption: 'c',
				tagA: ['hook1', 'hook4'],
			},
			{
				id: 'hook4',
				requiredOption: 'a',
				otherTags: ['hook2', 'hook3', 'hook5'],
			},
			{
				id: 'hook5',
				requiredOption: 'b',
				tagA: ['hook1', 'hook4'],
			},
		]);
	});

	it('TODO{P}:o1[computed] Virtual computed field', async () => {
		// TODO: Computed field is not handled yet
		const res = await ctx.query(
			{ $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'isBlue'] },
			{ noMetadata: true },
		);

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'blue',
				isBlue: true,
			},
			{
				id: 'yellow',
				isBlue: false,
			},
		]);
	});

	it('TODO{P}:co2[computed] Computed virtual field depending on edge id', async () => {
		// TODO: Computed field is not handled yet
		const res = await ctx.query(
			{ $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'user-tags', 'totalUserTags'] },
			{ noMetadata: true },
		);

		expect(deepSort(res, 'id')).toEqual([
			{
				'id': 'blue',
				'user-tags': ['tag-3'],
				'totalUserTags': 1,
			},
			{
				'id': 'yellow',
				'user-tags': ['tag-1', 'tag-2'],
				'totalUserTags': 2,
			},
		]);
	});

	it('TODO{PTS}:co3[computed], Computed virtual field depending on edge id, missing dependencies', async () => {
		const res = await ctx.query(
			{ $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'totalUserTags'] },
			{ noMetadata: true },
		);

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'blue',
				totalUserTags: 1,
			},
			{
				id: 'yellow',
				totalUserTags: 2,
			},
		]);
	});

	it('TODO{P}:mv1[multiVal, query, ONE], get multiVal', async () => {
		// Postgres: Data field type flex is not supported.
		const res = await ctx.query({ $entity: 'Color', $fields: ['id', 'freeForAll'] }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'blue',
				freeForAll: 'hey',
			},
			{
				id: 'red',
				freeForAll: 'yay',
			},
			{
				id: 'yellow',
				freeForAll: 7,
			},
		]);
	});

	it('TODO{PT}:mv2[multiVal, query, ONE], filter by multiVal', async () => {
		const res = await ctx.query(
			{ $entity: 'Color', $filter: { freeForAll: 'hey' }, $fields: ['id', 'freeForAll'] },
			{ noMetadata: true },
		);

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'blue',
				freeForAll: 'hey',
			},
		]);
	});

	/*
  it('[entity,nested, filter] - $filter on children property', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'User',
      // this adds: $filterByAccounts isa account, has Account·provider 'github'; $filterRel (account: $filterByAccounts , user: $users) isa User-Accounts;
      $filter: { account: { provider: { $eq: 'github' } } }, // $ is always commands, by default is $eq
      $fields: ['name'],
    });
    expect(res).toEqual({
      $entity: 'User',
      $id: 'user1',
      name: 'Antoine',
    });
  });
  it('[entity,nested,filter] - Simplified filter', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'User',
      $filter: { account: { provider: 'github' } }, // by default is $eq
      $fields: ['name'],
    });
    expect(res).toEqual([
      {
        $entity: 'User',
        $id: 'user1',
        name: 'Antoine',
      },
    ]);
  });
  it('[entity,array,includes] - filter by field of cardinality many, type text: includes one ', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'post',
      $filter: { mentions: { $includes: '@antoine' } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    // when we have no way to know if the answer will be unique or not, we provide an array
    expect(deepSort(res)).toEqual([
      { $entity: 'post', $id: 'post1', id: 'post1' },
      { $entity: 'post', $id: 'post2', id: 'post2' },
    ]);
  });
  it('[entity,array,includesAll] - filter by field of cardinality many, type text: includes all ', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'post',
      $filter: { mentions: { $includesAll: ['@Antoine', '@Loic'] } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'post', $id: 'post2', id: 'post2' },
      { $entity: 'post', $id: 'post3', id: 'post3' },
    ]);
  });
  it('[entity,array,includesAny] filter by field of cardinality many, type text: includes any ', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'post',
      $filter: { mentions: { $includesAny: ['@Antoine', '@Loic'] } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'post', $id: 'post1', id: 'post1' },
      { $entity: 'post', $id: 'post2', id: 'post2' },
      { $entity: 'post', $id: 'post3', id: 'post3' },
    ]);
  });
  it('[entity,includesAny,error] using array filter includesAny on cardinality=ONE error', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'User',
      $filter: { name: { $includesAny: ['x', 'y'] } },
    });
    expect(res).toThrow(TypeError);
  });
  it('[entity,includesAll, error] using array filter includesAll on cardinality=ONE error', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'User',
      $filter: { name: { $includesAll: ['x', 'y'] } },
    });
    expect(res).toThrow(TypeError);
  });
  // OPERATORS: NOT
  it('[entity,filter,not] - filter by field', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'User',
      $filter: { $not: { id: 'user1' } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'User', $id: 'user2', id: 'user2' },
      { $entity: 'User', $id: 'user2', id: 'user3' },
    ]);
  });
  it('[entity,filter,not,array,includes] filter item cardinality many', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'post',
      $filter: { mentions: { $not: { $includes: '@Antoine' } } },
      $fields: ['id'],
    });
    expect(res).toEqual([{ $entity: 'post', $id: 'post3', id: 'post3' }]); // this is an array because we can't be sure before querying that is a single element
  });
  // OPERATORS: OR
  // typeDB: https://docs.vaticle.com/docs/query/match-clause#disjunction-of-patterns. When is the same
  it('[entity,OR] or filter two different fields', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.query({
      $entity: 'User',
      $filter: [{ name: 'Loic' }, { email: 'antoine@test.com' }], // this is equivalent to $filter: {$or: [..]}
      $fields: ['name'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'User', $id: 'user1', name: 'Antoine' },
      { $entity: 'User', $id: 'user2', name: 'Loic' },
    ]);
  });
  */

	// NESTED

	it('TODO{P}:a1[$as] - as for attributes and roles and links', async () => {
		// Postgres: Role field UserTagGroup.tagId cannot references multiple records.
		const expectedRes = {
			'email_as': 'antoine@test.com',
			'id': 'user1',
			'user-tags_as': [
				{
					id: 'tag-1',
					users_as: [
						{
							name: 'Antoine',
							id: 'user1',
						},
					],
				},
				{
					id: 'tag-2',
					users_as: [
						{
							id: 'user1',
							name: 'Antoine',
						},
						{
							id: 'user3',
							name: 'Ann',
						},
					],
				},
			],
		};

		const res = (await ctx.query(
			{
				$entity: 'User',
				$id: 'user1',
				$fields: [
					'id',
					{ $path: 'email', $as: 'email_as' },
					{
						$path: 'user-tags',
						$as: 'user-tags_as',
						$fields: ['id', { $path: 'users', $as: 'users_as', $fields: ['id', 'name'] }],
					},
				],
			},
			{ noMetadata: true },
		)) as UserType;

		expect(res).toBeDefined();
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('TODO{ST}:a1.alt[$as] - as for attributes and roles and links', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Booking',
			$id: 'b1',
			$fields: [
				'id',
				{ $path: 'status', $as: 'currentStatus' },
				{ $path: 'payments', $as: 'allPayments' },
				{ $path: 'guest', $as: 'currentGuest' },
			],
		};
		const expected = {
			id: 'b1',
			currentStatus: 'checked-in',
			currentGuest: {
				id: 'g1',
				name: 'John Doe',
				email: 'john.doe@example.com',
				phone: '123-456-7890',
				bookings: ['b1'],
				rooms: ['r2'],
			},
			allPayments: [{ id: 'p1', amountPaid: '800.00', paymentDate: '2024-02-01T06:30:00.000Z', booking: 'b1' }],
		};
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(JSON.parse(JSON.stringify(res)), 'id')).toEqual(expected);
	});

	it('bq1[batched query] - as for attributes and roles and links', async () => {
		const expectedRes = [
			{
				id: 'user1',
			},
			{
				id: 'space-1',
			},
		];

		const res = (await ctx.query(
			[
				{
					$entity: 'User',
					$fields: ['id'],
					$id: 'user1',
				},
				{
					$entity: 'Space',
					$fields: ['id'],
					$id: 'space-1',
				},
			],
			{ noMetadata: true },
		)) as UserType;

		expect(res).toBeDefined();
		expect(res).toEqual(expectedRes);
	});

	it('j1[json] Query a thing with a JSON attribute', async () => {
		const entity = await ctx.query({
			$entity: 'Account',
			$id: 'account1-1',
			$fields: ['profile'],
		});
		expect(entity).toMatchObject({
			profile: { hobby: ['Running'] },
		});
	});

	it('j2[json] Query a thing with an empty JSON attribute', async () => {
		const entity = await ctx.query({
			$entity: 'Account',
			$id: 'account1-2',
			$fields: ['profile'],
		});
		expect((entity as any).profile).toBeUndefined();
	});

	it('TODO{PTS}:bq2[batched query with $as] - as for attributes and roles and links', async () => {
		const expectedRes = {
			users: {
				id: 'user1',
			},
			spaces: {
				id: 'space-1',
			},
		};

		const res = (await ctx.query(
			{
				// @ts-expect-error change RawBQLQuery type
				$queryType: 'batched',
				users: {
					$entity: 'User',
					$fields: ['id'],
					$id: 'user1',
				},
				spaces: {
					$entity: 'Space',
					$fields: ['id'],
					$id: 'space-1',
				},
			},
			{ noMetadata: true },
		)) as UserType;

		expect(res).toBeDefined();
		expect(res).toEqual(expectedRes);
	});

	it('TODO{P}:dn1[deep nested] ridiculously deep nested query', async () => {
		// Postgres: Role field UserTagGroup.tagId cannot references multiple records.
		const res = await ctx.query({
			$entity: 'Color',
			$fields: [
				'id',
				{
					$path: 'user-tags',
					$fields: [
						'id',
						{
							$path: 'users',
							$fields: [
								'id',
								{
									$path: 'spaces',
									$fields: ['id', { $path: 'users', $fields: ['id', { $path: 'accounts', $fields: ['id'] }] }],
								},
							],
						},
					],
				},
			],
		});

		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual([
			{
				'$id': 'blue',
				'$thing': 'Color',
				'$thingType': 'entity',
				'id': 'blue',
				'user-tags': [
					{
						$id: 'tag-3',
						$thing: 'UserTag',
						$thingType: 'relation',
						id: 'tag-3',
						users: [
							{
								$id: 'user2',
								$thing: 'User',
								$thingType: 'entity',
								id: 'user2',
								spaces: [
									{
										$id: 'space-2',
										$thing: 'Space',
										$thingType: 'entity',
										id: 'space-2',
										users: [
											{
												$id: 'user1',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account1-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-1',
													},
													{
														$id: 'account1-2',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-2',
													},
													{
														$id: 'account1-3',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-3',
													},
												],
												id: 'user1',
											},
											{
												$id: 'user2',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account2-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account2-1',
													},
												],
												id: 'user2',
											},
											{
												$id: 'user3',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account3-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account3-1',
													},
												],
												id: 'user3',
											},
										],
									},
								],
							},
						],
					},
				],
			},
			{
				$id: 'red',
				$thing: 'Color',
				$thingType: 'entity',
				id: 'red',
			},
			{
				'$id': 'yellow',
				'$thing': 'Color',
				'$thingType': 'entity',
				'id': 'yellow',
				'user-tags': [
					{
						$id: 'tag-1',
						$thing: 'UserTag',
						$thingType: 'relation',
						id: 'tag-1',
						users: [
							{
								$id: 'user1',
								$thing: 'User',
								$thingType: 'entity',
								id: 'user1',
								spaces: [
									{
										$id: 'space-1',
										$thing: 'Space',
										$thingType: 'entity',
										id: 'space-1',
										users: [
											{
												$id: 'user1',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account1-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-1',
													},
													{
														$id: 'account1-2',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-2',
													},
													{
														$id: 'account1-3',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-3',
													},
												],
												id: 'user1',
											},
											{
												$id: 'user5',
												$thing: 'User',
												$thingType: 'entity',
												id: 'user5',
											},
										],
									},
									{
										$id: 'space-2',
										$thing: 'Space',
										$thingType: 'entity',
										id: 'space-2',
										users: [
											{
												$id: 'user1',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account1-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-1',
													},
													{
														$id: 'account1-2',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-2',
													},
													{
														$id: 'account1-3',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-3',
													},
												],
												id: 'user1',
											},
											{
												$id: 'user2',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account2-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account2-1',
													},
												],
												id: 'user2',
											},
											{
												$id: 'user3',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account3-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account3-1',
													},
												],
												id: 'user3',
											},
										],
									},
								],
							},
						],
					},
					{
						$id: 'tag-2',
						$thing: 'UserTag',
						$thingType: 'relation',
						id: 'tag-2',
						users: [
							{
								$id: 'user1',
								$thing: 'User',
								$thingType: 'entity',
								id: 'user1',
								spaces: [
									{
										$id: 'space-1',
										$thing: 'Space',
										$thingType: 'entity',
										id: 'space-1',
										users: [
											{
												$id: 'user1',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account1-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-1',
													},
													{
														$id: 'account1-2',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-2',
													},
													{
														$id: 'account1-3',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-3',
													},
												],
												id: 'user1',
											},
											{
												$id: 'user5',
												$thing: 'User',
												$thingType: 'entity',
												id: 'user5',
											},
										],
									},
									{
										$id: 'space-2',
										$thing: 'Space',
										$thingType: 'entity',
										id: 'space-2',
										users: [
											{
												$id: 'user1',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account1-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-1',
													},
													{
														$id: 'account1-2',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-2',
													},
													{
														$id: 'account1-3',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-3',
													},
												],
												id: 'user1',
											},
											{
												$id: 'user2',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account2-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account2-1',
													},
												],
												id: 'user2',
											},
											{
												$id: 'user3',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account3-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account3-1',
													},
												],
												id: 'user3',
											},
										],
									},
								],
							},
							{
								$id: 'user3',
								$thing: 'User',
								$thingType: 'entity',
								id: 'user3',
								spaces: [
									{
										$id: 'space-2',
										$thing: 'Space',
										$thingType: 'entity',
										id: 'space-2',
										users: [
											{
												$id: 'user1',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account1-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-1',
													},
													{
														$id: 'account1-2',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-2',
													},
													{
														$id: 'account1-3',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account1-3',
													},
												],
												id: 'user1',
											},
											{
												$id: 'user2',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account2-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account2-1',
													},
												],
												id: 'user2',
											},
											{
												$id: 'user3',
												$thing: 'User',
												$thingType: 'entity',
												accounts: [
													{
														$id: 'account3-1',
														$thing: 'Account',
														$thingType: 'entity',
														id: 'account3-1',
													},
												],
												id: 'user3',
											},
										],
									},
								],
							},
						],
					},
				],
			},
		]);
	});

	it('TODO{ST}:dn1.alt[deep nested] ridiculously deep nested query', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Hotel',
			$fields: [
				'id',
				{
					$path: 'rooms',
					$fields: [
						'id',
						{
							$path: 'bookings',
							$fields: [
								'id',
								{
									$path: 'payments',
									$fields: ['id'],
								},
							],
						},
					],
				},
			],
		};
		const expected = [
			{ id: 'h1', rooms: [{ id: 'r1' }, { id: 'r2', bookings: [{ id: 'b1', payments: [{ id: 'p1' }] }] }] },
			{ id: 'h2', rooms: [{ id: 'r3', bookings: [{ id: 'b3', payments: [{ id: 'p2' }] }] }, { id: 'r4' }] },
			{ id: 'h3', rooms: [{ id: 'r5', bookings: [{ id: 'b2' }] }] },
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(JSON.parse(JSON.stringify(res)), 'id')).toEqual(expected);
	});

	it('TODO{PT}:dn2[deep numbers] Big numbers', async () => {
		const res = await ctx.query(
			{
				$entity: 'Company',
				$filter: { employees: { name: ['Employee 78f', 'Employee 187f', 'Employee 1272f', 'Employee 9997f'] } },
				$fields: ['id'],
			},
			{ noMetadata: true },
		);

		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual([
			{
				id: '127f',
			},
			{
				id: '18f',
			},
			{
				id: '7f',
			},
			{
				id: '999f',
			},
		]);
	});

	it('TODO{PT}:dn3[deep numbers] Big numbers nested', async () => {
		const res = await ctx.query(
			{
				$entity: 'Company',
				$filter: { employees: { name: ['Employee 78f'] } },
				$fields: ['id', { $path: 'employees' }],
			},
			{ noMetadata: true },
		);

		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual([
			{
				id: '7f',
				employees: [
					{
						company: '7f',
						id: '70f',
						name: 'Employee 70f',
					},
					{
						company: '7f',
						id: '71f',
						name: 'Employee 71f',
					},
					{
						company: '7f',
						id: '72f',
						name: 'Employee 72f',
					},
					{
						company: '7f',
						id: '73f',
						name: 'Employee 73f',
					},
					{
						company: '7f',
						id: '74f',
						name: 'Employee 74f',
					},
					{
						company: '7f',
						id: '75f',
						name: 'Employee 75f',
					},
					{
						company: '7f',
						id: '76f',
						name: 'Employee 76f',
					},
					{
						company: '7f',
						id: '77f',
						name: 'Employee 77f',
					},
					{
						company: '7f',
						id: '78f',
						name: 'Employee 78f',
					},
					{
						company: '7f',
						id: '79f',
						name: 'Employee 79f',
					},
				],
			},
		]);
	});

	// COMPLEX FILTERS

	it('fk1[filter, keywords, exists], filter by undefined/null property', async () => {
		const res = await ctx.query({ $entity: 'User', $filter: { email: { $exists: false } } }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual([{ id: 'user4', name: 'Ben' }]);
	});

	it('TODO{P}:fk2[filter, keywords, exists], filter by undefined/null property', async () => {
		// Postgres: Inherited entity (God and SuperUser) is not supported
		const res = await ctx.query({ $entity: 'User', $filter: { email: { $exists: true } } }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'god1',
				name: 'Richard David James',
				email: 'afx@rephlex.com',
			},
			{
				id: 'superuser1',
				name: 'Beatrix Kiddo',
				email: 'black.mamba@deadly-viper.com',
			},
			{
				'id': 'user1',
				'name': 'Antoine',
				'email': 'antoine@test.com',
				'accounts': ['account1-1', 'account1-2', 'account1-3'],
				'spaces': ['space-1', 'space-2'],
				'user-tags': ['tag-1', 'tag-2'],
			},
			{
				'id': 'user2',
				'name': 'Loic',
				'email': 'loic@test.com',
				'accounts': ['account2-1'],
				'spaces': ['space-2'],
				'user-tags': ['tag-3', 'tag-4'],
			},
			{
				'id': 'user3',
				'name': 'Ann',
				'email': 'ann@test.com',
				'accounts': ['account3-1'],
				'spaces': ['space-2'],
				'user-tags': ['tag-2'],
			},
			{
				id: 'user5',
				name: 'Charlize',
				email: 'charlize@test.com',
				spaces: ['space-1'],
			},
		]);
	});

	it('TODO{ST}:fk2[filter, keywords, exists], filter by undefined/null property', async () => {
		// Surreal & TypeDB: The schema and the data are not added yet
		const query = {
			$relation: 'Guest',
			$filter: {
				phone: { $exists: true },
			},
		};
		const expected = [
			{
				id: 'g1',
				name: 'John Doe',
				email: 'john.doe@example.com',
				phone: '123-456-7890',
				bookings: ['b1'],
				rooms: ['r2'],
			},
			{
				id: 'g2',
				name: 'Jane Smith',
				email: 'jane.smith@example.com',
				phone: '987-654-3210',
				bookings: ['b2'],
				rooms: ['r5'],
			},
		];
		const res = await ctx.query(query, { noMetadata: true });
		expect(deepSort(JSON.parse(JSON.stringify(res)), 'id')).toEqual(expected);
	});
});
