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

  it('b3[delete] Basic', async () => {
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

    expect(JSON.parse(JSON.stringify(res))).toMatchObject([
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
    expect(deepSort(res2)).toMatchObject({
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

    expect(JSON.parse(JSON.stringify(res))).toMatchObject(
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
    expect(JSON.parse(JSON.stringify(res))).toMatchObject([
      {
        id: 'red',
      },
      { id: 'green' },
    ]);
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

  /* it('l3 [replace, entity, nested] replace link in simple relation', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: ['space-1'], // replace space 2 by space 1
      },
      { noMetadata: true }
    );

    const user = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['spaces'],
      },
      { noMetadata: true }
    );
    expect(user).toBeDefined();
    expect(user).toEqual({
      id: 'tag-2',
      spaces: ['space-1'],
    });
  }); */

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
    expect(deepSort(user, 'id')).toMatchObject({
      id: 'user2',
      'user-tags': ['tag-2', 'tag-3'], // equivalent to $op: link, $id: 'space-1';
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
    // @ts-expect-error
    expect(deepSort(userTag, 'id')).toMatchObject({
      id: 'tag-2',
      users: ['user1', 'user2', 'user3'], // user2 linked in l4
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
    // @ts-expect-error
    expect(deepSort(userTagGroup, 'id')).toMatchObject({
      id: 'utg-1',
      tags: ['tag-1'],
      color: 'yellow',
    });
  });

  it('l6 [link] explicit link', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: [
          { $op: 'link', $id: 'tag-2' }, // link by id
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
    expect(deepSort(userTagGroup, 'id')).toMatchObject({
      id: 'utg-2',
      tags: ['tag-2', 'tag-3'], // user2 linked in l4
      // group: undefined,
      // color: undefined,
    });
  });
  it('inheritedAttributesMutation', async () => {
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
  it('multipleRolesInsertion', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      { $relation: 'Space-User', id: 'u1-s1-s2', users: 'user1', spaces: ['space-1', 'space-2'] },
      { noMetadata: true }
    );
    const res = await bormClient.query({ $relation: 'Space-User', $id: 'u1-s1-s2' }, { noMetadata: true });
    expect(res).toEqual({
      id: 'u1-s1-s2',
      spaces: ['space-1', 'space-2'],
      users: ['user1'],
    });
  });

  /* it('l6 [unlink, all, nested] unlink all', async () => {
    expect(bormClient).toBeDefined();
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
    expect(deepSort(user, 'id')).toMatchObject({
      id: 'user2',
      'user-tags': ['tag-2'], // equivalent to $op: link, $id: 'space-1';
    });
  }); */

  it('[Create,delete] Complex', async () => {
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
        name: 'Ann',
        accounts: [
          { provider: 'facebook' },
          { $op: 'link', $tempId: 'acc1' },
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
        accounts: { $tempId: 'gh1' },
        user: { $tempId: 'us1' },
      },
    ]);
    expect(res?.length).toBe(17);
  });

  afterAll(async () => {
    await cleanup(dbName);
  });
});
