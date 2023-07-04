import 'jest';

import type BormClient from '../../src/index';
import { cleanup, init } from '../helpers/lifecycle';
import { deepSort } from '../helpers/matchers';

const firstUser = {
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
      name: 'John',
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
        name: `Johns not`,
        email: 'john@test.com',
      },
      { noMetadata: true }
    );

    expect(res).toEqual({
      name: `Johns not`,
      email: 'john@test.com',
    });

    const res2 = await bormClient.query({
      $entity: 'User',
      $id: firstUser.id,
    });
    expect(res2).toEqual({
      id: firstUser.id,
      name: `Johns not`,
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

  it('b8[create, multiple, date] Next-auth example ', async () => {
    expect(bormClient).toBeDefined();

    await bormClient.mutate(
      {
        $entity: 'Session',
        user: 'user1',
        sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4',
        expires: new Date('2023-06-10T14:58:09.066Z'),
      },
      { noMetadata: true }
    );

    const sessions = await bormClient.query(
      {
        $entity: 'Session',
      },
      { noMetadata: true }
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

    const allUsers = await bormClient.query(
      {
        $entity: 'User',
        $fields: ['name'],
      },
      { noMetadata: true }
    );
    // @ts-expect-error
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
        name: 'Jane', /// coming from previous test
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

      { noMetadata: true }
    );

    /// get all users again
    const allUsers2 = await bormClient.query(
      {
        $entity: 'User',
        $fields: ['name'],
      },
      { noMetadata: true }
    );
    /// expect only original users
    // @ts-expect-error
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
        name: 'Loic',
      },
    ]);
  });

  it('u2[update, nested, error] Update all children error', async () => {
    /// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
    expect(bormClient).toBeDefined();

    try {
      await bormClient.mutate(
        {
          $entity: 'Account',
          $id: 'account3-1',
          user: {
            email: 'theNewEmailOfAnn@gmail.com',
          },
        },
        { noMetadata: true }
      );
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe(
          'Please specify if it is a create or an update: {"$entity":"User","email":"theNewEmailOfAnn@gmail.com"} '
        );
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  it('u3[update, multiple, nested(many), noId] Update only children (no id)', async () => {
    expect(bormClient).toBeDefined();

    /// cardinality MANY
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user1',
        spaces: [{ $op: 'update', name: 'space2ORspace1' }],
      },
      { noMetadata: true }
    );

    const allSpaces = await bormClient.query(
      {
        $entity: 'Space',
        $fields: ['id', 'name'],
      },
      { noMetadata: true }
    );

    // @ts-expect-error
    expect(deepSort(allSpaces, 'id')).toEqual([
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
        name: 'Production',
      },
    ]);
  });

  it('TODO:u3-multiID[update, multiple, nested(many), noId] Update only children (no id)', async () => {
    expect(bormClient).toBeDefined();

    /// cardinality MANY
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: ['user2', 'user5'],
        spaces: [{ $op: 'update', name: 'space2ORspace1Bis' }],
      },
      { noMetadata: true }
    );

    const allSpaces = await bormClient.query(
      {
        $entity: 'Space',
        $fields: ['id', 'name'],
      },
      { noMetadata: true }
    );

    expect(allSpaces).toEqual([
      {
        id: 'space-2',
        name: 'space2ORspace1Bis',
      },
      {
        id: 'space-3',
        name: 'Not-owned',
      },
      {
        id: 'space-1',
        name: 'space2ORspace1Bis',
      },
    ]);
  });

  it('TODO:u4[update, multiple, nested(one), noId] Update all children (no id)', async () => {
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
      { noMetadata: true }
    );

    const allOriginalUsers = await bormClient.query(
      {
        $entity: 'User',
        $id: ['user1', 'user2', 'user3', 'user4', 'user5'],
        $fields: ['id', 'email'],
      },
      { noMetadata: true }
    );

    // @ts-expect-error
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
  });

  it('TODO:pq1[create, nested] With pre-query, create when there is already something error', async () => {
    /// this requires pre-queries when using typeDB because it must understand there is already something and throw an error
    expect(bormClient).toBeDefined();

    const res = await bormClient.mutate(
      {
        $entity: 'Account',
        $id: 'account3-1',
        user: {
          $op: 'create',
          email: 'theNewEmailOfAnn@gmail.com',
        },
      },
      { noMetadata: true }
    );

    expect(res).toEqual({
      todo: `somehow describe that nothing happened for that particular branch, 
    or at least show that there is no 'theNewEmail' in theof new stuff`,
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
            group: { color: { $id: 'blue' } }, // link to pre-existing
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
          group: { color: 'blue' },
        },
      ]),
    });
  });

  it('l3ent[unlink, multiple, entity] unlink multiple linkfields (not rolefields)', async () => {
    // todo 4 cases
    // case 1: Unlink a simple a-b relation (Edge = delete)
    // case 2: Unlink with target = relation (Edge unlink the role in the director relation)
    // case 3: Unlink with a relation that is a role of a relation (Edge = 'unlink',just unlink things connected to the role)
    // case 4: Unlink in a >3 role relation (Edge = 'unlink',ensure the other >2 roles stay connected )
    expect(bormClient).toBeDefined();
    const originalState = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'spaces', 'accounts'],
      },
      { noMetadata: true }
    );
    expect(originalState).toEqual({
      accounts: ['account2-1'],
      id: 'user2',
      spaces: ['space-2'],
    });
    /// do the unlinks
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: null,
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

    /// recover original state
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        // spaces: ['space-2'], replaces do not work yet
        // accounts: ['account2-1'] replaces do not work yet
        spaces: [{ $id: 'space-2' }], /// temporal solution while replaces/add don't work, we just add them
        accounts: [{ $id: 'account2-1' }], /// temporal solution while replaces/add don't work, we just add them
      },
      { noMetadata: true }
    );
  });

  it('l3rel[unlink, simple, relation] unlink link in relation but one role per time', async () => {
    // todo: When the relation is the self relation being modified, no need to have it as noop and then as op in the edges
    expect(bormClient).toBeDefined();

    await bormClient.mutate(
      [
        {
          $relation: 'Space-User',
          $id: 'u3-s2',
          users: null,
        },
      ],
      { noMetadata: true }
    );

    await bormClient.mutate(
      [
        {
          $relation: 'Space-User',
          $id: 'u3-s2',
          spaces: null,
        },
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

    expect(user).toBeDefined();
    expect(user).toEqual({
      id: 'u3-s2',
      power: 'power1',
    });
    // Recover the state
    await bormClient.mutate({
      $relation: 'Space-User',
      $id: 'u3-s2',
      spaces: [{ $op: 'link', $id: 'space-2' }], // todo: simplify when replaces work
      users: [{ $op: 'link', $id: 'user3' }],
    });
  });

  it('l4[link, add, relation, nested] add link in complex relation. Also unlink test to be splitted somewhere', async () => {
    expect(bormClient).toBeDefined();
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user3',
        'user-tags': [{ $id: 'tag-3' }], // adding an existing
      },
      { noMetadata: true }
    );

    const user = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user3',
        $fields: ['id', 'user-tags'],
      },
      { noMetadata: true }
    );
    expect(user).toBeDefined();
    // @ts-expect-error
    expect(deepSort(user, 'id')).toEqual({
      id: 'user3',
      'user-tags': ['tag-2', 'tag-3'],
    });

    /// replace by deleting all and adding 3 back
    /// this would kill tag-2 if it wasnt already linked to something, so in this case it should work to link it back to tag-2
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user3',
        'user-tags': null, // removing all
      },
      { noMetadata: true }
    );
    await bormClient.mutate(
      {
        $entity: 'User',
        $id: 'user3',
        'user-tags': [{ $op: 'link', $id: 'tag-2' }], // adding an existing
      },
      { noMetadata: true }
    );

    const updatedUser = await bormClient.query(
      {
        $entity: 'User',
        $id: 'user3',
        $fields: ['id', 'user-tags'],
      },
      { noMetadata: true }
    );

    expect(updatedUser).toEqual({
      id: 'user3',
      'user-tags': ['tag-2'],
    });
  });

  it('l5[unlink, nested] unlink by id', async () => {
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

    expect(userTagGroup).toEqual({
      id: 'utg-1',
      tags: ['tag-1'],
      color: 'yellow',
    });

    await bormClient.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        tags: [
          { $op: 'link', $id: 'tag-2' }, // link it back //todo: simplify when replaces work
        ],
      },
      { noMetadata: true }
    );
  });

  it('l6[link, many] explicit link to many', async () => {
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

  it('l7[unlink, all, nested] unlink all from one particular role', async () => {
    expect(bormClient).toBeDefined();

    await bormClient.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: null, // by default this is just an unlink, but sometimes if specified in the schema, it will be also a delete
      },
      { noMetadata: true }
    );

    const UserTagGroupModified = await bormClient.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    expect(UserTagGroupModified).toBeDefined();
    // @ts-expect-error
    expect(deepSort(UserTagGroupModified, 'id')).toEqual({
      $relation: 'UserTagGroup',
      id: 'utg-2',
      $id: 'utg-2',
      color: 'blue',
    });
    /// get it back to original state
    await bormClient.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }], // todo: simplify when replaces work
    });
  });

  it('l8[create, link, relation, unsupported] Create relation and link it to multiple existing things', async () => {
    expect(bormClient).toBeDefined();

    try {
      await bormClient.mutate({
        $relation: 'UserTag',
        $op: 'create',
        id: 'tmpTag',
        users: ['user1', 'user5', 'user3'],
        color: 'yellow',
        group: 'utg-1',
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe(
          `Unsupported: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.`
        );
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  it('l9[ create,relation] Create relation multiple edges ', async () => {
    expect(bormClient).toBeDefined();

    await bormClient.mutate({
      $relation: 'UserTag',
      $op: 'create',
      id: 'tmp-user-tag3',
      users: ['user1', 'user5', 'user3'],
    });

    await bormClient.mutate(
      { $relation: 'UserTag', $id: 'tmp-user-tag3', users: [{ $op: 'unlink', $id: ['user1', 'user3'] }] },
      { noMetadata: true }
    );
    const userTags = await bormClient.query(
      { $relation: 'UserTag', $id: 'tmp-user-tag3', $fields: ['id', 'users'] },
      { noMetadata: true }
    );
    expect(userTags).toBeDefined();
    expect(userTags).toEqual({ id: 'tmp-user-tag3', users: ['user5'] });

    await bormClient.mutate(
      { $relation: 'UserTag', $id: 'tmp-user-tag3', users: [{ $op: 'unlink', $id: 'user5' }] },
      { noMetadata: true }
    );
    const userTags2 = await bormClient.query(
      { $relation: 'UserTag', $id: 'tmp-user-tag3', $fields: ['id', 'users'] },
      { noMetadata: true }
    );
    expect(userTags2).toBeNull();
    /// A relation with no edges is null
  });

  it('l10[create, link, relation] Create relation and link it to multiple existing things', async () => {
    expect(bormClient).toBeDefined();

    await bormClient.mutate({
      $relation: 'UserTag',
      $op: 'create',
      id: 'tmpTag',
      users: ['user1', 'user5', 'user3'],
      group: 'utg-1',
    });

    const newUserTag = await bormClient.query(
      {
        $relation: 'UserTag',
        $id: 'tmpTag',
      },
      { noMetadata: true }
    );

    // @ts-expect-error
    expect(deepSort(newUserTag, 'id')).toEqual({
      id: 'tmpTag',
      users: ['user1', 'user3', 'user5'],
      group: 'utg-1',
      color: 'yellow',
    });
  });

  it('TODO:l11[link, replace, relation] Get existing relation and link it to multiple existing things', async () => {
    expect(bormClient).toBeDefined();
    /// This test requires pre-queries to work in typeDB
    await bormClient.mutate({
      $relation: 'UserTag',
      $op: 'create',
      $id: 'tmpTag2',
      users: ['user1', 'user3'], /// one linkfield is linked
      /// group is undefined,
      /// the replace must work in both!
    });

    await bormClient.mutate({
      $relation: 'UserTag',
      $id: 'tmpTag2',
      users: ['user2', 'user4'],
      group: 'utg-2',
    });

    const newUserTag = await bormClient.query(
      {
        $relation: 'UserTag',
        $id: 'tmpTag2',
      },
      { noMetadata: true }
    );

    // @ts-expect-error
    expect(deepSort(newUserTag, 'id')).toEqual({
      id: 'tmpTag',
      users: ['user2', 'user4'],
      group: 'utg-2',
      color: 'blue',
    });
  });

  it('l12[link,many] Insert items in multiple', async () => {
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

  it('l13[unlink, nested, relation] Unlink in nested array', async () => {
    expect(bormClient).toBeDefined();

    /// get user 2, space 2 and then add a new dataField to it linked to the existing 'kind-book'

    const preSpace = await bormClient.query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });
    // @ts-expect-error
    expect(deepSort(preSpace, 'id')).toEqual({
      objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
      definitions: ['kind-book'],
      id: 'space-2',
      kinds: ['kind-book'],
      name: 'Dev',
      selfs: ['self1', 'self2', 'self3', 'self4'],
      users: ['user1', 'user2', 'user3'],
    });

    const newRelationPayload = {
      $entity: 'User',
      $id: 'user2',
      spaces: [
        {
          $id: 'space-2',
          dataFields: [
            {
              id: 'firstDataField',
              name: 'testField',
              description: '',
              type: 'TEXT',
              cardinality: 'ONE',
              computeType: 'EDITABLE',
              kinds: ['kind-book'],
            },
          ],
        },
      ],
    };
    const newRelRes = await bormClient.mutate(newRelationPayload);
    if (!newRelRes || !Array.isArray(newRelRes) || typeof newRelRes[0] === 'string') {
      throw new Error('Mutation failed');
    }
    const dataFieldId = newRelRes[0]?.$id;

    const postSpace = await bormClient.query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });
    // @ts-expect-error
    expect(deepSort(postSpace, 'id')).toEqual({
      objects: ['firstDataField', 'kind-book', 'self1', 'self2', 'self3', 'self4'],
      definitions: ['firstDataField', 'kind-book'],
      id: 'space-2',
      kinds: ['kind-book'],
      name: 'Dev',
      selfs: ['self1', 'self2', 'self3', 'self4'],
      users: ['user1', 'user2', 'user3'],
      fields: ['firstDataField'],
      dataFields: ['firstDataField'],
    });

    /// now the real test, get that new field and unlink it to the "kind-book"
    await bormClient.mutate({
      $entity: 'User',
      $id: 'user2',
      spaces: [
        {
          $id: 'space-2',
          dataFields: [
            {
              $id: dataFieldId,
              kinds: null,
            },
          ],
        },
      ],
    });
    const DataFieldPost = await bormClient.query({ $relation: 'DataField', $id: dataFieldId }, { noMetadata: true });

    expect(DataFieldPost).toBeDefined();
    expect(DataFieldPost).toEqual({
      cardinality: 'ONE',
      computeType: 'EDITABLE',
      id: 'firstDataField',
      name: 'testField',
      space: 'space-2',
      type: 'TEXT',
    });
  });

  it('TODO:l14 [unlink, nested, relation] Unlink in a nested field', async () => {
    // todo: parseBQL=> When the relation is the self relation being modified, no need to have it as noop and then as op in the edges
    expect(bormClient).toBeDefined();

    await bormClient.mutate(
      [
        // unlink all color in all the groups linked to usertag tag.2
        {
          $relation: 'UserTag',
          $id: 'tag-2',
          group: {
            $op: 'update', // we need to specify $op = 'update' or it will be considered as 'create'
            color: null,
          },
        },
      ],
      { noMetadata: true }
    );

    const allGroups = await bormClient.query(
      {
        $relation: 'UserTagGroup',
        $fields: ['id', 'color', 'tags'],
      },
      { noMetadata: true }
    );

    // @ts-expect-error
    expect(deepSort(allGroups, 'id')).toEqual([
      {
        id: 'utg-1',
        tags: ['tag-1', 'tag-2'],
      },
      {
        id: 'utg-2',
        tags: ['tag-3'],
        color: 'blue',
      },
    ]);

    await bormClient.mutate(
      [
        {
          $relation: 'UserTag',
          $id: 'tag-2',
          group: {
            $op: 'update',
            color: 'blue',
          },
        },
      ],
      { noMetadata: true }
    );

    const withYellow = await bormClient.query({
      $relation: 'UserTag',
      $fields: [{ $path: 'group' }],
    });

    expect(withYellow).toEqual([
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        group: {
          $relation: 'UserTagGroup',
          $id: 'utg-1',
          id: 'utg-1',
          tags: ['tag-2', 'tag-1'],
          color: 'yellow',
        },
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
  it('TODO:c1[create,delete] Complex', async () => {
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

  it('e2[create] Check for no $id field on $op create', async () => {
    expect(bormClient).toBeDefined();

    const mutation = {
      $entity: 'User',
      $op: 'create',
      $id: 'blah',
      name: 'test testerman',
      email: 'test@test.com',
    };

    try {
      await bormClient.mutate(mutation, { noMetadata: true });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe("Can't write to computed field $id. Try writing to the id field directly.");
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  afterAll(async () => {
    await cleanup(dbName);
  });
});
