import 'jest';
import { v4 as uuidv4 } from 'uuid';

import { cleanup, init } from '../../helpers/lifecycle';
import { deepRemoveMetaData, deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';
import type { typesSchema } from '../../mocks/generatedSchema';
import type { TypeGen } from '../../../../src/types/typeGen';
import type { WithBormMetadata } from '../../../../src/index';
import type { UserType } from '../../types/testTypes';
import type BormClient from '../../../../src/index';

import 'jest';

describe('Query', () => {
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

	it('v1[validation] - $entity missing', async () => {
		expect(bormClient).toBeDefined();
		// @ts-expect-error - $entity is missing
		await expect(bormClient.query({})).rejects.toThrow();
	});

	it('v2[validation] - $entity not in schema', async () => {
		expect(bormClient).toBeDefined();
		await expect(bormClient.query({ $entity: 'fakeEntity' })).rejects.toThrow();
	});

	it('v3[validation] - $id not existing', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.query({ $entity: 'User', $id: 'nonExisting' });
		await expect(res).toEqual(undefined)
	});

	it('e1[entity] - basic and direct link to relation', async () => {
		expect(bormClient).toBeDefined();
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
		const res = await bormClient.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('e1.b[entity] - basic and direct link to relation sub entity', async () => {
		expect(bormClient).toBeDefined();
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
		const res = await bormClient.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('e2[entity] - filter by single $id', async () => {
		expect(bormClient).toBeDefined();
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

		const res = (await bormClient.query(query)) as UserType;

		expect(res).toBeDefined();
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('opt1[options, noMetadata', async () => {
		expect(bormClient).toBeDefined();
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
		const res = (await bormClient.query(query, {
			noMetadata: true,
		})) as UserType;
		expect(res).toBeDefined();
		expect(typeof res).not.toBe('string');

		// @ts-expect-error - res should defined
		expectArraysInObjectToContainSameElements(res, expectedRes);

		expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	});

	it('opt3a[options, returnNulll] - empty fields option in entity', async () => {
		expect(bormClient).toBeDefined();
		const query = {
			$entity: 'User',
			$id: 'user4',
			$fields: ['spaces', 'email', 'user-tags'],
		};
		const expectedRes = {
			'$thing': 'User',
			'$thingType': 'entity',
			'email': null, //Example field
			'$id': 'user4',
			'spaces': null, //example linkfield from intermediary relation
			'user-tags': null, //example linkfield from direct relation
		};
		const res = await bormClient.query(query, { returnNulls: true });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

  it('r1[relation] - basic', async () => {
		expect(bormClient).toBeDefined();
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
		const res = await bormClient.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await bormClient.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(
			expectedRes.map(({ $id: _id, $thing: _thing, $thingType: _thingType, ...rest }) => rest),
		);
	});

	it('r2[relation] - filtered fields', async () => {
		expect(bormClient).toBeDefined();
		const query = { $relation: 'User-Accounts', $fields: ['user'] };
		const expectedRes = [
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-1',
				user: 'user1',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-2',
				user: 'user1',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua1-3',
				user: 'user1',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua2-1',
				user: 'user2',
			},
			{
				$thing: 'User-Accounts',
				$thingType: 'relation',
				$id: 'ua3-1',
				user: 'user3',
			},
		];
		const res = await bormClient.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await bormClient.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'user')).toEqual(
			expectedRes.map(({ $id: _id, $thing: _thing, $thingType: _thingType, ...rest }) => rest),
		);
	});

	it('ef1[entity] - $id single', async () => {
		expect(bormClient).toBeDefined();
		const wrongRes = await bormClient.query({ $entity: 'User', $id: uuidv4() });
		expect(wrongRes).toEqual(undefined);
		const validRes = await bormClient.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['id'],
		});
		expect(validRes).toEqual({ $thing: 'User', $thingType: 'entity', $id: 'user1', id: 'user1' });
	});

	it('n1[nested] Only ids', async () => {
		expect(bormClient).toBeDefined();
		const res = await bormClient.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', 'accounts'],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$thing: 'User',
			$thingType: 'entity',
			$id: 'user1',
			name: 'Antoine',
			accounts: ['account1-1', 'account1-2', 'account1-3'],
		});
	});

	afterAll(async () => {
		await cleanup(bormClient, dbName);
	});
});
