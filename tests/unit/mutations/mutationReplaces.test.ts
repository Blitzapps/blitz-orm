import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';
import { deepSort } from '../../helpers/matchers';

describe('Mutations: Replaces', () => {
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

	it('r1[replace] replace single roles in relation', async () => {
		expect(bormClient).toBeDefined();
		// cardinality one
		await bormClient.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr2',
				root: 'thing4',
			},
			{ preQuery: true },
		);

		// cardinality many
		await bormClient.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr2',
				things: ['thing4'],
			},
			{ preQuery: true },
		);
		const queryRes = await bormClient.query(
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
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
			{
				$relation: 'ThingRelation',
				$id: 'tr3',
				root: 'thing4',
				things: ['thing4'],
			},
			{ preQuery: true },
		);

		const queryRes = await bormClient.query(
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
		expect(bormClient).toBeDefined();

		await bormClient.mutate([
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

		const queryRes = await bormClient.query(
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
		expect(bormClient).toBeDefined();

		await bormClient.mutate({
			'$entity': 'User',
			'$id': 'user3',
			'user-tags': [
				{
					$id: 'tag-2',
					users: ['user3', 'user5'],
				},
			],
		});
		const queryRes = await bormClient.query({
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
		await bormClient.mutate({
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

	it('TODO:ri1-d[ignore ids pre-query delete] delete something that does not exist', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
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

		const queryRes = await bormClient.query(
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

	it('TODO:ri1-ul[ignore ids pre-query unlink] unlink something that does not exist', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
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

		const queryRes = await bormClient.query(
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

	it('TODO:ri1-up[ignore ids pre-query update] update something that does not exist', async () => {
		expect(bormClient).toBeDefined();

		await bormClient.mutate(
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

		const queryRes = await bormClient.query(
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
		await cleanup(bormClient, dbName);
	});
});
