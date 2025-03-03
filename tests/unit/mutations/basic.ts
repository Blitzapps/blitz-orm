/* eslint-disable prefer-destructuring */
import { v4 as uuidv4 } from 'uuid';

import { expect, it } from 'vitest';
import type { BQLResponse, BQLResponseMulti, BQLResponseSingle } from '../../../src';
import { createTest } from '../../helpers/createTest';
import { deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';

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
    id: 'squarePusher',
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
          { $thing: 'User', id: 'bo-u1', name: 'bo-u1' },
          { $thing: 'User', id: 'bo-u2', name: 'bo-u2' },
          { $thing: 'User', id: 'bo-u3', name: 'bo-u3' },
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
        users: [{ $op: 'delete' }, { $thing: 'User', id: 'bo-u4', name: 'bo-u4' }],
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
          { $thing: 'User', id: 'b0b-u1', name: 'bo-u1' },
          { $thing: 'User', id: 'b0b-u2', name: 'bo-u2' },
          { $thing: 'User', id: 'b0b-u3', name: 'bo-u3' },
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

    //CLEAN ALL
    await ctx.mutate([
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['b0b-u1', 'b0b-u2', 'b0b-u3'],
      },
      {
        $relation: 'UserTag',
        $op: 'delete',
        $id: 'b0b-ut1',
      },
    ]);
  });

  it('TODO{T}:l1[direct linkField] Basic linkField', async () => {
    // CREATE
    await ctx.mutate(
      {
        $thing: 'User',
        id: 'l1-u1',
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
      id: 'l1-u1',
      'user-tags': ['l1-utg1', 'l1-utg2'],
    });

    //LINK TO EXISTING
    await ctx.mutate(
      {
        $thing: 'User',
        $id: 'l1-u1',
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
      id: 'l1-u1',
      'user-tags': ['l1-utg1', 'l1-utg2', 'l1-utg3'],
    });

    //UPDATE ALL
    await ctx.mutate(
      {
        $thing: 'User',
        $id: 'l1-u1',
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
      id: 'l1-u1',
      'user-tags': [
        { id: 'l1-utg1', name: 'allRenamed' },
        { id: 'l1-utg2', name: 'allRenamed' },
        { id: 'l1-utg3', name: 'allRenamed' },
      ],
    });

    //UNLINK ONE
    await ctx.mutate(
      {
        $thing: 'User',
        $id: 'l1-u1',
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
      id: 'l1-u1',
      'user-tags': [
        { id: 'l1-utg2', name: 'allRenamed' },
        { id: 'l1-utg3', name: 'allRenamed' },
      ],
    });

    // DELETE REST
    await ctx.mutate(
      {
        $thing: 'User',
        $id: 'l1-u1',
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
    await ctx.mutate(firstUser, { noMetadata: true });
    const res = (await ctx.query(
      {
        $entity: 'User',
        $filter: { name: firstUser.name },
      },
      { noMetadata: true },
    )) as BQLResponse[];

    const expectedUnit = {
      id: '$unitId',
      name: 'John',
      email: 'wrong email',
    };

    expect(res).toBeInstanceOf(Array);
    const [user] = res;
    // @ts-expect-error - TODO description
    expectArraysInObjectToContainSameElements(user, expectedUnit);
    // @ts-expect-error - TODO description
    firstUser = { ...firstUser, id: user.id };
  });

  it('b1b[create, update] Create a thing with an empty JSON attribute, then update it', async () => {
    const account = {
      $thing: 'Account',
      id: uuidv4(),
    };
    await ctx.mutate(account, { noMetadata: false });

    const createRes = await ctx.query({
      $entity: 'Account',
      $id: account.id,
    });

    expect(createRes).toMatchObject(account);

    const updated = {
      ...account,
      $id: account.id,
      profile: { hobby: ['Running'] },
    };
    await ctx.mutate(updated);

    const updateRes = await ctx.query({
      $entity: 'Account',
      $id: account.id,
    });

    expect(updateRes).toMatchObject(updated);

    await ctx.mutate({
      $thing: 'Account',
      $op: 'delete',
      $id: account.id,
    });

    const deleteRes = await ctx.query({
      $entity: 'Account',
      $id: account.id,
    });

    expect(deleteRes).toBeNull();
  });

  it('b1b[create, update] Create a thing with a JSON attribute, then update it', async () => {
    const account = {
      $thing: 'Account',
      id: uuidv4(),
      profile: { hobby: ['Running'] },
    };
    await ctx.mutate(account);
    const createRes = await ctx.query({
      $entity: 'Account',
      $id: account.id,
    });
    expect(createRes).toMatchObject(account);

    const updated = {
      ...account,
      $id: account.id,
      profile: { hobby: ['Running', 'Hiking'] },
    };
    await ctx.mutate(updated);
    const updateRes = await ctx.query({
      $entity: 'Account',
      $id: account.id,
    });
    expect(updateRes).toMatchObject(updated);

    await ctx.mutate({
      $thing: 'Account',
      $op: 'delete',
      $id: account.id,
    });

    const deleteRes = await ctx.query({
      $entity: 'Account',
      $id: account.id,
    });

    expect(deleteRes).toBeNull();
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
    //console.log('RES!!', res);

    expect(res).toMatchObject([
      {
        $thing: 'User-Accounts',
        accounts: ['b1b-account1'],
        user: 'b1b-user1',
      },
    ]);
    await ctx.mutate({
      $thing: 'User',
      $op: 'delete',
      $id: user.id,
      accounts: [{ $op: 'delete' }],
    });

    const deleteRes = await ctx.query([
      {
        $entity: 'User',
        $id: user.id,
      },
      {
        $entity: 'Account',
        $id: 'b1b-account1',
      },
      {
        $relation: 'User-Accounts',
        $id: 'b1b-user1',
      },
    ]);

    expect(deleteRes).toMatchObject([null, null, null]);
  });

  it('b2a[update] Basic', async () => {
    await ctx.mutate(
      {
        $entity: 'User',
        $id: firstUser.id,
        name: 'Johns not',
        email: 'john@test.com',
      },
      { noMetadata: true },
    );

    const res = await ctx.query({
      $entity: 'User',
      $id: firstUser.id,
    });

    expect(res).toEqual({
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

    await ctx.mutate(
      {
        $op: 'update',
        $entity: 'User',
        $id: 'b2b-user',
        name: null,
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'User',
        $id: 'b2b-user',
        $fields: ['name', 'email'],
      },
      { noMetadata: true, returnNulls: true },
    );

    expect(res).toMatchObject({
      name: null,
      email: 'foo@test.com',
    });

    expect(res).toMatchObject({ email: 'foo@test.com' });

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

    await ctx.mutate(
      {
        $op: 'update',
        $entity: 'User',
        $id: 'b2c-user',
        name: null,
        email: 'bar@test.com',
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'User',
        $id: 'b2c-user',
        $fields: ['name', 'email'],
      },
      { noMetadata: true },
    );
    expect(res).toEqual({ email: 'bar@test.com' });

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

    await ctx.mutate(
      {
        $op: 'update',
        $entity: 'User',
        $id: 'b2d-user',
        email: '',
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'User',
        $id: 'b2d-user',
        $fields: ['email'],
      },
      { noMetadata: true },
    );

    expect(res).toEqual({ email: '' });

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
    await ctx.mutate({
      $entity: 'User',
      $op: 'delete',
      $id: firstUser.id,
    });

    const res = await ctx.query({
      $entity: 'User',
      $id: firstUser.id,
    });

    expect(res).toBeNull();
  });

  it('b3r[delete, relation] Basic', async () => {
    await ctx.mutate({
      $relation: 'User-Accounts',
      id: 'r1',
      user: { $thing: 'User', id: 'u1' },
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
          $thing: 'User',
          id: 'u2',
          email: 'hey',
          'user-tags': [
            { id: 'ustag1', color: { id: 'pink' } },
            { id: 'ustag2', color: { id: 'gold' } },
            { id: 'ustag3', color: { id: 'silver' } },
          ],
        },
        accounts: [{ id: 'b3rn-a2' }],
      },
      { preQuery: true },
    );
    const res1 = await ctx.query(
      {
        $entity: 'User',
        $id: 'u2',
        $fields: [{ $path: 'user-tags', $fields: ['id', 'color', 'group'] }],
      },
      { noMetadata: true },
    );
    expect(deepSort(res1, 'id')).toEqual({
      'user-tags': [
        { id: 'ustag1', color: 'pink', group: expect.any(String) },
        { id: 'ustag2', color: 'gold', group: expect.any(String) },
        { id: 'ustag3', color: 'silver', group: expect.any(String) },
      ],
    });

    await ctx.mutate(
      {
        $relation: 'User-Accounts',
        $id: 'r1',
        user: {
          $op: 'update',
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
        email: 'hey',
        'user-tags': [{ id: 'ustag1' }, { id: 'ustag2' }, { id: 'ustag3', color: 'silver' }],
      },
    });

    await ctx.mutate(
      {
        $relation: 'User-Accounts',
        $id: 'r1',
        user: {
          $op: 'update',
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
        email: 'hey',
        'user-tags': [{ id: 'ustag1' }],
      },
    });
    /// clean user and account and ustags
    await ctx.mutate([
      {
        $entity: 'User',
        $op: 'delete',
        $id: 'u2',
      },
      {
        $entity: 'Account',
        $op: 'delete',
        $id: 'b3rn-a2',
      },
      {
        $relation: 'UserTag',
        $op: 'delete',
        $id: 'ustag1',
      },
    ]);

    //now get all orphan userTagGroups and delete them (necessary for surrealDB while cant delete them automatically)
    const allUTGs = (await ctx.query(
      {
        $relation: 'UserTagGroup',
      },
      { noMetadata: true },
    )) as BQLResponseMulti;
    //filter those with no other key than 'id'
    const orphanUTGs = allUTGs.filter((utg) => Object.keys(utg).length === 1 && 'id' in utg);
    //delete them
    if (orphanUTGs.length > 0) {
      await ctx.mutate({ $op: 'delete', $relation: 'UserTagGroup', $id: orphanUTGs.map((utg) => utg.id) });
    }
  });

  it('b4[create, children] Create with children', async () => {
    await ctx.mutate(
      {
        ...secondUser,
        spaces: [{ name: spaceOne.name }, { name: spaceTwo.name }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      [
        {
          $entity: 'User',
          $filter: { name: secondUser.name },
        },
        {
          $entity: 'Space',
          $filter: { name: [spaceOne.name, spaceTwo.name] },
        },
      ],
      { noMetadata: true },
    )) as BQLResponseMulti;

    const user = res[0][0];
    secondUser.id = user.id;

    const spaces = deepSort(res[1], 'name');

    spaceOne.id = spaces[0].id;
    spaceTwo.id = spaces[1].id;

    //console.log('secondUser', secondUser);

    const relations = await ctx.query(
      {
        $relation: 'Space-User',
        //@ts-expect-error - TODO description
        $filter: { users: secondUser.id },
      },
      { noMetadata: true },
    );

    expect(user).toBeDefined();
    expect(user).toBeInstanceOf(Object);
    expect(spaces).toBeDefined();
    expect(spaces).toBeInstanceOf(Array);
    expect(relations).toBeDefined();
    expect(relations).toBeInstanceOf(Array);

    expect(user).toMatchObject({
      id: secondUser.id,
      name: secondUser.name,
      email: secondUser.email,
    });

    expect(spaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ...spaceOne, users: [secondUser.id] }),
        expect.objectContaining({ ...spaceTwo, users: [secondUser.id] }),
      ]),
    );

    expect(relations).toHaveLength(2);

    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spaces: [spaceOne.id],
          users: [secondUser.id],
        }),
        expect.objectContaining({
          spaces: [spaceTwo.id],
          users: [secondUser.id],
        }),
      ]),
    );

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
    await ctx.mutate(
      {
        ...thirdUser,
      },
      { noMetadata: true, preQuery: true },
    );

    const res1 = (await ctx.query(
      {
        $entity: 'User',
        $filter: { name: thirdUser.name },
      },
      { noMetadata: true },
    )) as BQLResponseMulti;

    // create spaces
    await ctx.mutate(
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

    const res2 = await ctx.query(
      {
        $entity: 'Space',
        $filter: { name: [spaceThree.name, spaceFour.name] },
      },
      { noMetadata: true },
    );

    thirdUser.id = res1[0].id;

    // @ts-expect-error - TODO description
    spaceThree.id = res2?.find((r) => r.name === 'Space 3').id;
    // @ts-expect-error - TODO description
    spaceFour.id = res2?.find((r) => r.name === 'Space 4').id;

    expect(res1).toBeDefined();
    expect(res1).toBeInstanceOf(Object);
    expect(res2).toBeDefined();
    expect(res2).toBeInstanceOf(Object);

    // link the user to the spaces
    await ctx.mutate(
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

    const relations = await ctx.query(
      {
        $relation: 'Space-User',
        //@ts-expect-error - TODO description
        $filter: { users: thirdUser.id },
      },
      { noMetadata: true },
    );

    expect(relations).toHaveLength(2);

    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spaces: [spaceThree.id],
          users: [thirdUser.id],
        }),
        expect.objectContaining({
          spaces: [spaceFour.id],
          users: [thirdUser.id],
        }),
      ]),
    );
  });

  it('TODO{T}:b4.3[update, link] Link ALL (without ids)', async () => {
    await ctx.mutate(
      {
        $entity: 'Space',
        id: 'b4-3-Space',
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $entity: 'Space',
        $id: 'b4-3-Space',
        users: [{ $op: 'link' }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'Space',
        $id: 'b4-3-Space',
        $fields: ['id', 'users'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    expect(res).toBeInstanceOf(Object);
    expect(res.users).toBeInstanceOf(Array);
    expect(res.users).toHaveLength(9); //including secondUser and thirdUser

    await ctx.mutate(
      {
        $entity: 'Space',
        $id: 'b4-3-Space',
        $op: 'delete',
      },
      { noMetadata: true },
    );
  });

  it('TODO{TS}:b4.4[create, link] Create and link ALL at once (without ids)', async () => {
    await ctx.mutate(
      {
        $entity: 'Space',
        id: 'b4-4-Space',
        users: [{ $op: 'link' }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'Space',
        $id: 'b4-4-Space',
        $fields: ['id', 'users'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    expect(res).toBeInstanceOf(Object);
    expect(res.users).toBeInstanceOf(Array);
    expect(res.users).toHaveLength(7);

    await ctx.mutate(
      {
        $entity: 'Space',
        $id: 'b4-4-Space',
        $op: 'delete',
      },
      { noMetadata: true },
    );
  });

  it('b5[update, children] Update children', async () => {
    await ctx.mutate(
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

    const res = await ctx.query(
      {
        $entity: 'User',
        $id: secondUser.id,
        $fields: ['id', { $path: 'spaces' }],
      },
      { noMetadata: true },
    );

    //console.log('res', res);

    if (!secondUser.id) {
      throw new Error('secondUser.id is undefined');
    }

    expect(res).toEqual(
      // { id: expect.any(String), name: 'newSpace1' },
      {
        id: secondUser.id,
        spaces: [{ name: 'newSpace2', id: spaceTwo.id, users: [secondUser.id] }],
      },
    );

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
    await ctx.mutate(
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

    const res = await ctx.query(
      {
        $entity: 'Color',
        $id: ['green', 'teal'],
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    expect(res).toHaveLength(2);

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
    await ctx.mutate(godUser, { noMetadata: true });
    const res = await ctx.query(
      {
        $entity: 'God', //Todo: this should probably work with User too
        $id: 'squarePusher',
      },
      { noMetadata: true },
    );

    expect(res).toEqual({
      id: 'squarePusher',
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

    //clean
    await ctx.mutate(
      {
        $entity: 'Session',
        $op: 'delete',
        $filter: { sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4' },
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

  it('mv3[create, multiVal, specialChars] ', async () => {
    await ctx.mutate(
      {
        $thing: 'Color',
        id: 'mv3',
        freeForAll: "it's",
      },
      { noMetadata: true },
    );

    try {
      const colors = await ctx.query(
        {
          $entity: 'Color',
          $id: 'mv3',
          $fields: ['id', 'freeForAll'],
        },
        { noMetadata: true },
      );

      expect(deepSort(colors, 'id')).toEqual({
        id: 'mv3',
        freeForAll: "it's",
      });
    } finally {
      await ctx.mutate(
        {
          $thing: 'Color',
          $op: 'delete',
          $id: 'mv3',
        },
        { noMetadata: true },
      );
    }
  });

  it('n1[create, nested] nested', async () => {
    await ctx.mutate(
      {
        $relation: 'Kind',
        id: 'n1-kind',
        name: 'myTest',
        space: 'space-3',
        dataFields: [{ id: 'n1-field', $op: 'create', name: 'myTestField', space: 'space-3' }],
      },
      { noMetadata: true },
    );

    const kinds = await ctx.query(
      {
        $relation: 'Kind',
      },
      { noMetadata: true },
    );
    const expectedKindTemplate = [
      {
        id: 'n1-kind',
        name: 'myTest',
        space: 'space-3',
        fields: ['n1-field'],
        dataFields: ['n1-field'],
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
        id: 'n1-field',
        name: 'myTestField',
        kinds: ['n1-kind'],
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
          $id: 'n1-kind',
        },
        {
          $relation: 'DataField',
          $op: 'delete',
          $id: 'n1-field',
        },
      ],
      { noMetadata: true },
    );
  });

  it('n2[create, nested] nested, self referenced', async () => {
    await ctx.mutate(
      {
        $relation: 'Kind',
        id: 'n2-kind-1',
        name: 'myTestKind1',
        space: 'space-3',
        dataFields: [
          {
            $op: 'create',
            id: 'n2-field',
            name: 'myTestField',
            space: 'space-3',
            kinds: [
              {
                $op: 'create',
                id: 'n2-kind-2',
                name: 'myTestKind2',
                space: 'space-3',
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    const kinds = await ctx.query(
      {
        $relation: 'Kind',
      },
      { noMetadata: true },
    );

    const expectedKindTemplate = [
      { id: 'kind-book', name: 'book', space: 'space-2' },
      {
        id: 'n2-kind-1',
        name: 'myTestKind1',
        space: 'space-3',
        fields: ['n2-field'],
        dataFields: ['n2-field'],
      },
      {
        id: 'n2-kind-2',
        name: 'myTestKind2',
        space: 'space-3',
        fields: ['n2-field'],
        dataFields: ['n2-field'],
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
        id: 'n2-field',
        name: 'myTestField',
        kinds: ['n2-kind-1', 'n2-kind-2'],
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
          $id: 'n2-field',
        },
        {
          $relation: 'Kind',
          $op: 'delete',
          $id: 'n2-kind-1',
        },
        {
          $relation: 'Kind',
          $op: 'delete',
          $id: 'n2-kind-2',
        },
      ],
      { noMetadata: true },
    );
  });

  it('n3[delete, nested] nested delete', async () => {
    await ctx.mutate(
      {
        $relation: 'Kind',
        id: 'n3-kind-1',
        name: 'myTestKind1',
        space: 'space-3',
        dataFields: [
          {
            $op: 'create',
            id: 'n3-field',
            name: 'myTestField',
            space: 'space-3',
            kinds: [
              {
                $op: 'create',
                id: 'n3-kind-2',
                name: 'myTestKind2',
                space: 'space-3',
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    /// delete both things
    await ctx.mutate(
      {
        $relation: 'Kind',
        $op: 'delete',
        $id: 'n3-kind-1',
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
            $thing: 'User',
            id: 'u1',
            name: 'new name',
          },
          {
            $thing: 'User',
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

  it('ext1[role, link, extended] Link role to subtype of player', async () => {
    /// cardinality ONE
    await ctx.mutate(
      {
        $relation: 'User-Accounts',
        id: 'ua-ext1',
        user: {
          $op: 'link',
          $id: 'god1',
        },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'User-Accounts',
        $id: 'ua-ext1',
        $fields: ['id', { $path: 'user', $fields: ['id', 'name'] }],
      },
      { noMetadata: true },
    );

    //clean up
    await ctx.mutate([
      {
        $id: 'ua-ext1',
        $relation: 'User-Accounts',
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'ua-ext1',
      user: {
        id: 'god1',
        name: 'Richard David James',
      },
    });
  });

  it('ext2[rolelf, link, extended] Link linkfield target role to subtype of player', async () => {
    /// cardinality ONE
    await ctx.mutate(
      {
        $entity: 'Account',
        id: 'a-ext2',
        user: {
          $op: 'link',
          $id: 'god1',
        },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'Account',
        $id: 'a-ext2',
        $fields: ['id', { $path: 'user', $fields: ['id', 'name'] }],
      },
      { noMetadata: true },
    );

    //clean up
    await ctx.mutate([
      {
        $id: 'a-ext2',
        $entity: 'Account',
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'a-ext2',
      user: {
        id: 'god1',
        name: 'Richard David James',
      },
    });
  });

  it('ext3[relationlf, link, extended] Link linkfield target relation to subtype of player', async () => {
    await ctx.mutate(
      {
        $entity: 'Space',
        $id: 'space-3',
        fields: [{ id: 'ext3-field', $thing: 'DataField', $op: 'create', name: 'myDataField' }], //so by default should be a Field but we casted into a DataField
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'Space',
        $id: 'space-3',
        $fields: ['id', { $path: 'fields', $fields: ['id', 'name'] }],
      },
      { noMetadata: false },
    );

    //clean up
    await ctx.mutate([
      {
        $id: 'ext3-field',
        $relation: 'DataField',
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'space-3',
      $id: 'space-3',
      $thing: 'Space',
      $thingType: 'entity',
      fields: [
        {
          $id: 'ext3-field',
          $thing: 'DataField', //necessary to ensure this worked
          $thingType: 'relation',
          id: 'ext3-field',
          name: 'myDataField',
        },
      ],
    });
  });

  it('pf1[prefix, lf] Prefixed linkfield tunnel', async () => {
    await ctx.mutate(
      {
        $entity: 'Session',
        user: 'God:god1',
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

    //clean
    await ctx.mutate(
      {
        $entity: 'Session',
        $op: 'delete',
        $filter: { user: 'God:god1' }, //todo: Probably this does not work, we should add the feature and tests
      },
      { noMetadata: true },
    );

    expect(sessions).toEqual([
      {
        expires: '2023-06-10T14:58:09.066Z',
        id: expect.any(String),
        user: 'god1',
      },
    ]);
  });

  it('pf2[prefix, lf, wrong] Prefixed linkfield tunnel with wrong thing', async () => {
    await ctx.mutate(
      {
        $entity: 'Session',
        user: 'God:user1',
        id: 'pf2-session',
        expires: new Date('2023-06-10T14:58:09.066Z'),
      },
      { noMetadata: true },
    );

    const sessions = await ctx.query(
      {
        $entity: 'Session',
        $id: 'pf2-session',
      },
      { noMetadata: true },
    );

    //clean
    await ctx.mutate(
      {
        $entity: 'Session',
        $op: 'delete',
        $id: 'pf2-session',
      },
      { noMetadata: true },
    );

    expect(sessions).toEqual({
      expires: '2023-06-10T14:58:09.066Z',
      id: expect.any(String),
      user: undefined,
    });
  });

  it('pf3[prefix, lf, tempId] Prefixed linkfield tunnel with tempId', async () => {
    await ctx.mutate(
      [
        {
          $entity: 'God',
          name: 'Ann',
          isEvil: false,
          power: 'walkthrough',
          $tempId: '_:tempUser',
        },
        {
          $entity: 'Session',
          user: 'God:_:tempUser',
          id: 'pf3-session',
          expires: new Date('2025-06-10T14:58:09.066Z'),
        },
      ],
      { noMetadata: true },
    );

    const sessions = await ctx.query(
      {
        $entity: 'Session',
        $id: 'pf3-session',
        $fields: ['id', { $path: 'user', $fields: ['name'] }],
      },
      { noMetadata: true },
    );

    //clean
    await ctx.mutate(
      {
        $entity: 'Session',
        $op: 'delete',
        $id: 'pf3-session',
      },
      { noMetadata: true },
    );

    expect(sessions).toEqual({
      id: expect.any(String),
      user: { name: 'Ann' },
    });
  });

  it('TODO{TS}:pf4[prefix, lf, tempId, wrong] Prefixed linkfield tunnel with tempId from wrong kind', async () => {
    try {
      await ctx.mutate(
        [
          {
            $entity: 'User',
            name: 'Ann',
            $tempId: '_:tempUser',
          },
          {
            $entity: 'Session',
            user: 'God:_:tempUser',
            id: 'pf4-session',
            expires: new Date('2025-06-10T14:58:09.066Z'),
          },
        ],
        { noMetadata: true },
      );
      throw new Error('This test should throw an error');
    } catch (err) {
      console.log('log', err);
      expect(err).toBeInstanceOf(Error);
      if (err instanceof Error) {
        expect(err.message.startsWith(`Can't link a $tempId that has not been created in the current mutation:`)).toBe(
          true,
        );
      }
    }
  });

  it('TODO{TS}:pf5[prefix, lf, tempId] Prefixed linkfield tunnel with tempId', async () => {
    try {
      await ctx.mutate(
        [
          {
            $entity: 'User',
            name: 'Bob',
            $tempId: '_:tempUser',
          },
          {
            $entity: 'Session',
            user: { $thing: 'God', $tempId: '_:tempUser' }, //notice is not the right one
            id: 'pf5-session',
            expires: new Date('2025-06-10T14:58:09.066Z'),
          },
        ],
        { noMetadata: true },
      );
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('enum1[create, update, reset] Should reset enum value to null without error', async () => {
    await ctx.mutate(
      {
        $op: 'create',
        $entity: 'Company',
        name: 'company1',
        id: 'enum1-test-1',
        industry: 'Tech',
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $op: 'update',
        $entity: 'Company',
        $id: 'enum1-test-1',
        industry: null,
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'Company',
        $id: 'enum1-test-1',
        $fields: ['id', 'industry'],
      },
      { noMetadata: true, returnNulls: true },
    );

    const res2 = await ctx.query(
      {
        $entity: 'Company',
        $id: 'enum1-test-1',
        $fields: ['id', 'industry'],
      },
      { noMetadata: true, returnNulls: false },
    );

    // Clean up
    await ctx.mutate(
      {
        $op: 'delete',
        $entity: 'Hook',
        $id: 'enum1-test-1',
      },
      { noMetadata: true },
    );

    expect(res).toEqual({
      id: 'enum1-test-1',
      industry: null,
    });
    expect(res2).toEqual({
      id: 'enum1-test-1',
      industry: undefined,
    });
  });

  it('enum2[create, update, reset] Should not let reset on non nullable property', async () => {
    await ctx.mutate(
      {
        $op: 'create',
        $entity: 'Hook',
        id: 'enum2-test-1',
        requiredOption: 'b',
      },
      { noMetadata: true },
    );

    try {
      await ctx.mutate(
        {
          $op: 'update',
          $entity: 'Hook',
          $id: 'enum2-test-1',
          requiredOption: null,
        },
        { noMetadata: true },
      );
      throw new Error('This test should throw an error');
    } catch (err) {
      if (err instanceof Error) {
        expect(
          err.message.startsWith('Error running SURQL mutation: [{"result":"Found NONE for field `requiredOption`'),
        ).toBe(true);
      }
    }
  });
});
