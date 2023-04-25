import 'jest';
import type BormClient from '../../src/index';
import { cleanup, init } from '../helpers/lifecycle';
import { deepSort } from '../helpers/matchers';

const firstUser = {
  $entity: 'User',
  name: 'John Doe',
  email: 'wrong email',
  id: undefined,
};

const secondUser = {
  $entity: 'User',
  name: 'Jane Doe',
  email: 'jane@test.com',
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

describe('Mutation init', () => {
  let dbName: string;
  let bormClient: BormClient;

  beforeAll(async () => {
    const config = await init();
    if (!config?.bormClient) {
      throw new Error('Failed to initialize BormClient');
    }
    dbName = config.dbName;
    bormClient = config.bormClient;
  }, 15000);

  it('b1[create] Basic', async () => {
    expect(bormClient).toBeDefined();

    const res = await bormClient.mutate(firstUser, { noMetadata: true });
    expect(res).toEqual({
      id: expect.any(String),
      name: 'John Doe',
      email: 'wrong email',
    });
    // @ts-expect-error - res is defined, and user can have id
    firstUser.id = res.id;
  });

  it('b2[update] Basic', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.mutate(
      {
        $entity: 'User',
        $id: firstUser.id,
        name: `John does not`,
        email: 'john@test.com',
      },
      { noMetadata: true }
    );

    expect(res).toEqual({
      name: `John does not`,
      email: 'john@test.com',
    });

    const res2 = await bormClient.query({
      $entity: 'User',
      $id: firstUser.id,
    });
    expect(res2).toEqual({
      id: firstUser.id,
      name: `John does not`,
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

    const res2 = await bormClient.query({
      $entity: 'User',
      $id: firstUser.id,
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
        id: 'u2',
        email: 'hey',
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
        $id: 'u2',
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
        $fields: ['id', { $path: 'user', $fields: ['email', { $path: 'user-tags', $fields: ['id', 'color'] }] }],
      },
      { noMetadata: true }
    );
    // @ts-expect-error - res2 is defined
    expect(deepSort(res2, 'id')).toEqual({
      id: 'r1',
      user: {
        email: 'hey',
        'user-tags': [{ id: 'ustag1' }, { id: 'ustag2' }, { id: 'ustag3', color: 'silver' }],
      },
    });

    await bormClient.mutate({
      $relation: 'User-Accounts',
      $id: 'r1',
      user: {
        $id: 'u2',
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
        $fields: ['id', { $path: 'user', $fields: ['email', { $path: 'user-tags', $fields: ['id', 'color'] }] }],
      },
      { noMetadata: true }
    );

    expect(res3).toEqual({
      id: 'r1',
      user: {
        email: 'hey',
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
      { noMetadata: true }
    );

    // @ts-expect-error
    spaceOne.id = res?.find((r) => r.name === 'Space 1').id;
    // @ts-expect-error
    spaceTwo.id = res?.find((r) => r.name === 'Space 2').id;
    // @ts-expect-error
    secondUser.id = res?.find((r) => r.name === 'Jane Doe').id;

    expect(res).toBeDefined();
    expect(res).toBeInstanceOf(Object);

    expect(JSON.parse(JSON.stringify(res))).toEqual([
      {
        email: 'jane@test.com',
        id: secondUser.id,
        name: 'Jane Doe',
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

    const res2 = await bormClient.query(
      {
        $entity: 'User',
        $id: secondUser.id,
      },
      { noMetadata: true }
    );
    // @ts-expect-error
    expect(deepSort(res2)).toEqual({
      id: secondUser.id,
      name: 'Jane Doe',
      email: 'jane@test.com',
      spaces: [spaceOne.id, spaceTwo.id].sort(),
    });
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
      { noMetadata: true }
    );

    expect(JSON.parse(JSON.stringify(res))).toEqual(
      // { id: expect.any(String), name: 'newSpace1' },
      { name: 'newSpace2' }
    );

    const res2 = await bormClient.query(
      {
        $entity: 'User',
        $id: secondUser.id,
        $fields: [{ $path: 'spaces', $id: spaceTwo.id, $fields: ['name'] }],
      },
      { noMetadata: true }
    );
    expect(res2).toEqual({
      spaces: [{ name: 'newSpace2' }], // todo there is a $id so at some point this should not be an array
    });
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
      { noMetadata: true }
    );
    expect(JSON.parse(JSON.stringify(res))).toEqual([
      {
        id: 'red',
      },
      { id: 'green' },
    ]);
  });

  it('b7[create, inherited] inheritedAttributesMutation', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.mutate(godUser, { noMetadata: true });
    expect(res).toEqual({
      id: 'squarepusher',
      name: 'Tom Jenkinson',
      email: 'tom@warp.com',
      power: 'rhythm',
      isEvil: false,
    });
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
      { noMetadata: true }
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
      { noMetadata: true }
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
      { noMetadata: true }
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
  });

  it('l1[link, add, nested, relation] Update entity by adding a new created relation children', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user5',
        'user-tags': [
          {
            name: 'a tag',
            group: { color: { id: 'purple' } }, // create new
          },
        ],
      },
      { noMetadata: true }
    );

    const resUser = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user5',
        $fields: [
          'id',
          {
            $path: 'user-tags',
            $fields: ['id', 'name', { $path: 'group', $fields: ['color'] }],
          },
        ],
      },
      { noMetadata: true }
    );
    expect(resUser).toBeDefined();
    expect(resUser).toEqual({
      id: 'user5',
      'user-tags': [{ id: expect.any(String), name: 'a tag', group: { color: 'purple' } }],
    });
  });
  it('l2[link, nested, relation] Create and update 3-level nested', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user4',
        'user-tags': [
          {
            name: 'another tag',
            group: { color: { $id: 'yellow' } }, // link to pre-existing
          },
          {
            name: 'yet another tag',
            group: { color: { $id: 'red' } }, // link to generated in the other query
          },
        ],
      },
      { noMetadata: true }
    );

    const resUser = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user4',
        $fields: [
          'id',
          {
            $path: 'user-tags',
            $fields: ['id', 'name', { $path: 'group', $fields: ['color'] }],
          },
        ],
      },
      { noMetadata: true }
    );
    expect(resUser).toBeDefined();
    expect(resUser).toEqual({
      id: 'user4',
      'user-tags': expect.arrayContaining([
        {
          id: expect.any(String),
          name: 'another tag',
          group: { color: 'yellow' },
        },
        {
          id: expect.any(String),
          name: 'yet another tag',
          group: { color: 'red' },
        },
      ]),
    });
  });

  it('l3ent [unlink, multiple, entity] unlink multiple linkfields', async () => {
    // todo 4 cases
    // case 1: Unlink a simple a-b relation (Edge = delete)
    // case 2: Unlink with target = relation (Edge unlink the role in the director relation)
    // case 3: Unlink with a relation that is a role of a relation (Edge = 'unlink',just unlink things connected to the role)
    // case 4: Unlink in a >3 role relation (Edge = 'unlink',ensure the other >2 roles stay connected )
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: null, // replace space 2 by space 1
        accounts: null,
      },
      { noMetadata: true }
    );

    const user = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'spaces', 'accounts'],
      },
      { noMetadata: true }
    );
    expect(user).toBeDefined();
    expect(user).toEqual({
      id: 'user2',
    });

    await bormClient.mutate({
      $entity: 'User',
      $id: 'user2',
      spaces: ['space-2'], // replace space 2 by space 1
      accounts: ['account2-1'],
    });
  });

  it('l3rel [unlink, multiple, relation] unlink link in relation but one role per time', async () => {
    // todo: When the relation is the self relation being modified, no need to have it as noop and then as op in the edges
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      [
        // todo: this only works if the relation has both things even if they are split here, so making both null will not work if one of those are all already empty
        {
          $relation: 'Space-User',
          $id: 'u3-s2',
          spaces: ['space1'], // replace space 2 by space 1
          users: null, // replace space 2 by space 1
        },

        /*
        { //todo: multiple match-inserts in the future to fix this 
          $relation: 'Space-User',
          $id: 'u3-s1',
          spaces: null, // replace space 2 by space 1
          users: null,
        }, */
      ],
      { noMetadata: true }
    );

    const user = await bormClient.query(
      {
        $relation: 'Space-User',
        $id: 'u3-s2',
        $fields: ['spaces', 'users', 'power', 'id'],
      },
      { noMetadata: true }
    );
    /*
    expect(user).toBeDefined();
    expect(user).toEqual({
      id: 'u3-s2',
      power: 'power1',
    });
    // Recover the state
    await bormClient.mutate({
      $relation: 'Space-User',
      $id: 'u3-s2',
      spaces: ['space-2'],
      users: ['user3'],
    }); */
  });

  it('l3relNestedTrue [unlink, multiple, relation] unlink link in relation but one role per time', async () => {
    // todo: When the relation is the self relation being modified, no need to have it as noop and then as op in the edges
    expect(bormClient).toBeDefined();

    const prehey = await bormClient.query({
      $relation: 'UserTag',
      $id: 'tag-2',
      $fields: [{ $path: 'group' }],
    });

    console.log('prehey', prehey);

    await bormClient.mutate(
      [
        // unlink all color in all the groups linked to usertag tag.2
        {
          $relation: 'UserTag',
          $id: 'tag-2',
          group: {
            $op: 'update',
            color: null,
          },
        },
      ],
      { noMetadata: true }
    );

    const hey = await bormClient.query({
      $relation: 'UserTag',
      $id: 'tag-2',
      $fields: [{ $path: 'group' }],
    });

    console.log('hey', hey);
    /*
    await bormClient.mutate(
      [
        {
          $relation: 'UserTag',
          $id: 'tag-2',
          group: {
            $op: 'noop',
            color: 'yellow',
          },
        },
      ],
      { noMetadata: true }
    );

    const hey2 = await bormClient.query({
      $relation: 'UserTag',
      $id: 'tag-2',
    });

    console.log('hey2', hey2); */
  });

  it('l4 [link, add, relation, nested] add link in complex relation', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        'user-tags': [{ $id: 'tag-2' }], // adding an existing
      },
      { noMetadata: true }
    );

    const user = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'user-tags'],
      },
      { noMetadata: true }
    );
    expect(user).toBeDefined();
    // @ts-expect-error
    expect(deepSort(user, 'id')).toEqual({
      id: 'user2',
      'user-tags': ['tag-2', 'tag-3', 'tag-4'],
    });
  });

  it('l5 [unlink, nested] unlink in complex relation', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        tags: [
          { $op: 'unlink', $id: 'tag-2' }, // unlink by id
        ],
      },
      { noMetadata: true }
    );

    const userTag = await bormClient.query(
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        $fields: ['id', 'users', 'group', 'color'],
      },
      { noMetadata: true }
    );
    expect(userTag).toBeDefined();
    console.log('userTag', userTag);

    // @ts-expect-error
    expect(deepSort(userTag, 'id')).toEqual({
      id: 'tag-2',
      // todo: add 'user2'
      users: ['user1', 'user3'], // user2 linked in l4
      // group: undefined,
      // color: undefined,
    });

    const userTagGroup = await bormClient.query(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        $fields: ['id', 'tags', 'color'],
      },
      { noMetadata: true }
    );
    expect(userTagGroup).toBeDefined();
    console.log('userTagGroup', userTagGroup);

    expect(userTagGroup).toEqual({
      id: 'utg-1',
      tags: ['tag-1'],
      color: 'yellow',
    });
  });

  it('l6 [link, many] explicit link to many', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: [
          { $op: 'link', $id: ['tag-2', 'tag-4'] }, // link by id
        ],
      },
      { noMetadata: true }
    );

    const userTagGroup = await bormClient.query(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        $fields: ['id', 'tags'],
      },
      { noMetadata: true }
    );
    expect(userTagGroup).toBeDefined();
    // @ts-expect-error
    expect(deepSort(userTagGroup, 'id')).toEqual({
      id: 'utg-2',
      tags: ['tag-2', 'tag-3', 'tag-4'], // user2 linked in l4
      // group: undefined,
      // color: undefined,
    });
  });

  it('l7 [unlink, all, nested] unlink all', async () => {
    expect(bormClient).toBeDefined();
    const UserTagGroup = await bormClient.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });
    console.log('UserTagGroup', UserTagGroup);
    await bormClient.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: null, // by default this is just an unlink, but sometimes if specified in the schema, it will be also a delete
      },
      { noMetadata: true }
    );

    const user = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'user-tags'],
      },
      { noMetadata: true }
    );
    expect(user).toBeDefined();
    // @ts-expect-error
    expect(deepSort(user, 'id')).toEqual({
      id: 'user2',
      'user-tags': ['tag-2'], // equivalent to $op: link, $id: 'space-1';
    });
    /// get it back to original state
    await bormClient.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: ['tag-2', 'tag-3', 'tag-4'],
    });
  });

  it('l8 [unlink,relation] unlink, where edge is the relation', async () => {
    expect(bormClient).toBeDefined();
    const newRelation = {
      meta: { $relation: 'UserTag', $id: 'tmp-user-tag' },
      fields: { users: ['user1', 'user3'], color: 'yellow', group: 'utg-1' },
    };
    await bormClient.mutate({ ...newRelation.meta, ...newRelation.fields, $op: 'create' });
    await bormClient.mutate(
      { ...newRelation.meta, users: [{ $op: 'unlink', $id: newRelation.fields.users }] },
      { noMetadata: true }
    );
    const userTags = await bormClient.query({ ...newRelation.meta, $fields: ['id', 'users'] }, { noMetadata: true });
    expect(userTags).toBeDefined();
    expect(userTags).toBeNull(); /// A relation with no edges is null
  });

  it('l9 [unlink,relation] nestedArrayUnlink', async () => {
    expect(bormClient).toBeDefined();
    const newRelationPayload = {
      $entity: 'User',
      $id: 'user2',
      spaces: {
        $id: 'space-2',
        dataFields: {
          id: '',
          name: 'testField',
          description: '',
          type: 'TEXT',
          cardinality: 'ONE',
          computeType: 'EDITABLE',
          kinds: ['kind-book'],
        },
      },
    };
    const newRelRes = await bormClient.mutate(newRelationPayload);
    if (!newRelRes || !Array.isArray(newRelRes) || typeof newRelRes[0] === 'string') {
      throw new Error('Mutation failed');
    }
    const dataFieldId = newRelRes[0]?.$id;
    const unlinkPayload = {
      $entity: 'User',
      $id: 'user2',
      spaces: {
        $id: 'space-2',
        dataFields: {
          $id: dataFieldId,
          kinds: [
            {
              $op: 'unlink',
              $id: 'kind-book',
            },
          ],
        },
      },
    };
    await bormClient.mutate(unlinkPayload);
    const queryRes = await bormClient.query({ $relation: 'DataField', $id: dataFieldId }, { noMetadata: true });
    expect(queryRes).toBeDefined();
    expect(queryRes).not.toBeNull();
  });

  it('l10[link,many] multipleRolesInsertion', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      { $relation: 'Space-User', id: 'u1-s1-s2', users: ['user1'], spaces: ['space-1', 'space-2'] },
      { noMetadata: true }
    );
    const res = await bormClient.query({ $relation: 'Space-User', $id: 'u1-s1-s2' }, { noMetadata: true });
    // @ts-expect-error
    expect(deepSort(res, 'id')).toEqual({
      id: 'u1-s1-s2',
      spaces: ['space-1', 'space-2'],
      users: ['user1'],
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
  it('c1[create,delete] Complex', async () => {
    expect(bormClient).toBeDefined();
    const res = await bormClient.mutate([
      {
        $entity: 'User',
        name: 'Peter',
        email: 'Peter@test.ru',
        accounts: [{ provider: 'google' }, { $op: 'create', $tempId: 'acc1', provider: 'facebook' }],
      },
      {
        $tempId: 'us1',
        $entity: 'User',
        name: 'Bob',
      },
      {
        $entity: 'User',
        name: 'Bea',
        accounts: [
          { provider: 'facebook' },
          { $tempId: 'acc1' },
          { $op: 'link', $tempId: 'gh1' },
          // { $op: 'link', $filter: { provider: 'google' } },
        ],
      },
      {
        $entity: 'Account',
        provider: 'Microsoft',
        user: { name: 'Carla' },
      },
      {
        $tempId: 'gh1',
        $entity: 'Account',
        provider: 'github',
      },
      {
        $relation: 'User-Accounts',
        accounts: [{ $tempId: 'gh1' }],
        user: { $tempId: 'us1' },
      },
    ]);
    expect(res?.length).toBe(17);
  });

  it('e1[duplicate] Duplicate creation', async () => {
    expect(bormClient).toBeDefined();
    expect(async () =>
      bormClient.mutate({
        $relation: 'User-Accounts',
        id: 'r1',
        user: {
          id: 'u2',
          'user-tags': [
            { id: 'ustag1', color: { id: 'pink' } },
            { id: 'ustag2', color: { id: 'pink' } },
          ],
        },
      })
    ).rejects.toThrowError(`Duplicate id pink`);
  });

  afterAll(async () => {
    await cleanup(dbName);
  });
});
