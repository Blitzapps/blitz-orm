import { v4 as uuidv4 } from 'uuid';

import { bench, expect } from 'vitest';
import type { WithBormMetadata } from '../../../src/index';
import type { TypeGen } from '../../../src/types/typeGen';
import { createTest } from '../../helpers/createTest';
import { deepRemoveMetaData, deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';
import type { typesSchema } from '../../mocks/generatedSchema';
import type { UserType } from '../../types/testTypes';

export const allBench = createTest('Bench', (ctx) => {
  bench('v1[validation] - $entity missing', async () => {
    // @ts-expect-error - $entity is missing
    await expect(ctx.query({})).rejects.toThrow();
  });

  bench('v2[validation] - $entity not in schema', async () => {
    await expect(ctx.query({ $entity: 'fakeEntity' })).rejects.toThrow();
  });

  bench('v3[validation] - $id not existing', async () => {
    const res = await ctx.query({ $entity: 'User', $id: 'nonExisting' });
    await expect(res).toBeNull();
  });

  bench('e1[entity] - basic and direct link to relation', async () => {
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
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user1',
        name: 'Antoine',
        email: 'antoine@test.com',
        id: 'user1',
        accounts: ['account1-1', 'account1-2', 'account1-3'],
        spaces: ['space-1', 'space-2'],
        'user-tags': ['tag-1', 'tag-2'],
      },
      {
        // '$entity': 'User',
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user2',
        name: 'Loic',
        email: 'loic@test.com',
        id: 'user2',
        accounts: ['account2-1'],
        spaces: ['space-2'],
        'user-tags': ['tag-3', 'tag-4'],
      },
      {
        // '$entity': 'User',
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user3',
        name: 'Ann',
        email: 'ann@test.com',
        id: 'user3',
        accounts: ['account3-1'],
        spaces: ['space-2'],
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

  bench('e1.b[entity] - basic and direct link to relation sub entity', async () => {
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

  bench('e2[entity] - filter by single $id', async () => {
    const query = { $entity: 'User', $id: 'user1' };
    const expectedRes = {
      // '$entity': 'User',
      $thing: 'User',
      $thingType: 'entity',
      $id: 'user1',
      name: 'Antoine',
      email: 'antoine@test.com',
      id: 'user1',
      accounts: ['account1-1', 'account1-2', 'account1-3'],
      spaces: ['space-1', 'space-2'],
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

  bench('e3[entity, nested] - direct link to relation, query nested ', async () => {
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
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user1',
        id: 'user1',
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
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user2',
        id: 'user2',
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
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user3',
        id: 'user3',
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

  bench('opt1[options, noMetadata', async () => {
    const query = { $entity: 'User', $id: 'user1' };
    const expectedRes = {
      name: 'Antoine',
      email: 'antoine@test.com',
      id: 'user1',
      accounts: ['account1-1', 'account1-2', 'account1-3'],
      spaces: ['space-1', 'space-2'],
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

  bench('TODO{TS}:opt2[options, debugger', async () => {
    const query = { $entity: 'User', $id: 'user1' };
    const expectedRes = {
      $id: 'user1',
      $entity: 'User',
      /// if this fails, other stuff fails, for some reason, fix this first
      $debugger: {
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
      name: 'Antoine',
      email: 'antoine@test.com',
      id: 'user1',
      accounts: ['account1-1', 'account1-2', 'account1-3'],
      spaces: ['space-1', 'space-2'],
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

  bench('opt3a[options, returnNull] - empty fields option in entity', async () => {
    const query = {
      $entity: 'User',
      $id: 'user4',
      $fields: ['spaces', 'email', 'user-tags'],
    };
    const expectedRes = {
      $thing: 'User',
      $thingType: 'entity',
      email: null, //Example field
      $id: 'user4',
      spaces: null, //example linkfield from intermediary relation
      'user-tags': null, //example linkfield from direct relation
    };
    const res = await ctx.query(query, { returnNulls: true });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    expect(deepSort(res, 'id')).toEqual(expectedRes);
  });

  bench('opt3b[options, returnNull] - empty fields option in entity, dont return explicit', async () => {
    const query = {
      $entity: 'User',
      $id: 'user4',
      $fields: ['spaces', 'email'],
    };
    const expectedRes = {
      $thing: 'User',
      $thingType: 'entity',
      email: null, //Example field
      $id: 'user4',
      spaces: null, //example linkfield from intermediary relation
    };
    const res = await ctx.query(query, { returnNulls: true });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    expect(deepSort(res, 'id')).toEqual(expectedRes);
  });

  bench('r1[relation] - basic', async () => {
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

  bench('r2[relation] - filtered fields', async () => {
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

  bench('r3[relation, nested] - nested entity', async () => {
    const query = {
      $relation: 'User-Accounts',
      $fields: ['id', { $path: 'user', $fields: ['name'] }],
    };
    const expectedRes = [
      {
        $thing: 'User-Accounts',
        $thingType: 'relation',
        $id: 'ua1-1',
        id: 'ua1-1',
        user: {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'user1',
          name: 'Antoine',
        },
      },
      {
        $thing: 'User-Accounts',
        $thingType: 'relation',
        $id: 'ua1-2',
        id: 'ua1-2',
        user: {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'user1',
          name: 'Antoine',
        },
      },
      {
        $thing: 'User-Accounts',
        $thingType: 'relation',
        $id: 'ua1-3',
        id: 'ua1-3',
        user: {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'user1',
          name: 'Antoine',
        },
      },
      {
        $thing: 'User-Accounts',
        $thingType: 'relation',
        $id: 'ua2-1',
        id: 'ua2-1',
        user: {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'user2',
          name: 'Loic',
        },
      },
      {
        $thing: 'User-Accounts',
        $thingType: 'relation',
        $id: 'ua3-1',
        id: 'ua3-1',
        user: {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'user3',
          name: 'Ann',
        },
      },
    ];
    const res = await ctx.query(query);
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    expect(deepSort(res, '$id')).toEqual(expectedRes);
    const resWithoutMetadata = await ctx.query(query, {
      noMetadata: true,
    });

    expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
  });

  bench('r4[relation, nested, direct] - nested relation direct on relation', async () => {
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

  bench('r5[relation nested] - that has both role, and linkfield pointing to same role', async () => {
    const query = {
      $entity: 'Color',
      $fields: ['id', 'user-tags', 'group'],
    };
    const expectedRes = [
      {
        $id: 'blue',
        $thing: 'Color',
        $thingType: 'entity',
        id: 'blue',
        group: 'utg-2',
        'user-tags': ['tag-3'],
      },
      {
        $id: 'red',
        $thing: 'Color',
        $thingType: 'entity',
        id: 'red',
      },
      {
        $id: 'yellow',
        $thing: 'Color',
        $thingType: 'entity',
        id: 'yellow',
        group: 'utg-1',
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

  bench('r6[relation nested] - relation connected to relation and a tunneled relation', async () => {
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

  bench('r7[relation, nested, direct] - nested on nested', async () => {
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
          $id: 'yellow',
          $thing: 'Color',
          $thingType: 'entity',
          id: 'yellow',
          group: 'utg-1',
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
          $id: 'yellow',
          $thing: 'Color',
          $thingType: 'entity',
          id: 'yellow',
          group: 'utg-1',
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
          $id: 'blue',
          $thing: 'Color',
          $thingType: 'entity',
          id: 'blue',
          group: 'utg-2',
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

  bench('r8[relation, nested, deep] - deep nested', async () => {
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
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user2',
        id: 'user2',
        'user-tags': [
          {
            $id: 'tag-3',
            id: 'tag-3',
            $thing: 'UserTag',
            $thingType: 'relation',
            color: {
              $thing: 'Color',
              $thingType: 'entity',
              $id: 'blue',
              id: 'blue',
              group: 'utg-2',
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
    //console.log('res', res);
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);

    expect(deepSort(res, 'id')).toEqual(expectedRes);
    const resWithoutMetadata = await ctx.query(query, {
      noMetadata: true,
    });

    expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
  });

  bench('r9[relation, nested, ids]', async () => {
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

  bench('ef1[entity] - $id single', async () => {
    const wrongRes = await ctx.query({ $entity: 'User', $id: uuidv4() });
    expect(wrongRes).toEqual(null);
    const validRes = await ctx.query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['id'],
    });
    expect(validRes).toEqual({ $thing: 'User', $thingType: 'entity', $id: 'user1', id: 'user1' });
  });

  bench('ef2[entity] - $id multiple', async () => {
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

  bench('ef3[entity] - $fields single', async () => {
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

  bench('ef4[entity] - $fields multiple', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', 'email'],
    });
    expect(res).toEqual({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'user1',
      name: 'Antoine',
      email: 'antoine@test.com',
    });
  });

  bench('ef5[entity,filter] - $filter single', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $filter: { name: 'Antoine' },
      $fields: ['name'],
    });
    // notice now it is an array. Multiple users could be called Antoine
    expect(res).toEqual([{ $thing: 'User', $thingType: 'entity', $id: 'user1', name: 'Antoine' }]);
  });

  bench('ef6[entity,filter,id] - $filter by id in filter', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $filter: { id: 'user1' },
      $fields: ['name'],
    });
    expect(res).toEqual({ $thing: 'User', $thingType: 'entity', $id: 'user1', name: 'Antoine' });
  });

  bench('ef7[entity,unique] - $filter by unique field', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $filter: { email: 'antoine@test.com' },
      $fields: ['name', 'email'],
    });
    // and now its not an array again, we used at least one property in the filter that is either the single key specified in idFields: ['id'] or has a validations.unique:true
    expect(res).toEqual({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'user1',
      name: 'Antoine',
      email: 'antoine@test.com',
    });
  });

  bench('n1[nested] Only ids', async () => {
    const res = await ctx.query({
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

  bench('n2[nested] First level all fields', async () => {
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

  bench('n3[nested, $fields] First level filtered fields', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts', $fields: ['provider'] }],
    });
    expect(res).toBeDefined();
    expect(deepSort(res)).toEqual({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'user1',
      name: 'Antoine',
      accounts: [
        { $thing: 'Account', $thingType: 'entity', $id: 'account1-1', provider: 'google' },
        { $thing: 'Account', $thingType: 'entity', $id: 'account1-2', provider: 'facebook' },
        { $thing: 'Account', $thingType: 'entity', $id: 'account1-3', provider: 'github' },
      ],
    });
  });

  bench('n4a[nested, $id] Local filter on nested, by id', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $id: ['user1', 'user2', 'user3'],
      $fields: [
        'name',
        {
          $path: 'accounts',
          $id: 'account3-1', // id specified so nested children has to be an objec and not an array
          $fields: ['provider'],
        },
      ],
    });

    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    expect(deepSort(res)).toEqual([
      {
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user1',
        name: 'Antoine',
      },
      {
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user2',
        name: 'Loic',
      },
      {
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user3',
        name: 'Ann',
        // accounts here has to be a single object, not an array because we specified an id in the nested query
        accounts: {
          $thing: 'Account',
          $thingType: 'entity',
          $id: 'account3-1',
          provider: 'facebook',
        },
      },
    ]);
  });

  bench('n4b[nested, $id] Local filter on nested depth two, by id', async () => {
    const res = await ctx.query({
      $entity: 'User',
      $id: 'user1',
      $fields: [
        {
          $path: 'spaces',
          $id: 'space-1', // id specified so nested children has to be an objec and not an array
          $fields: [{ $path: 'users', $id: 'user1', $fields: ['$id'] }],
        },
      ],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);

    expect(deepSort(res)).toEqual({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'user1',
      spaces: {
        $id: 'space-1',
        $thing: 'Space',
        $thingType: 'entity',
        users: {
          $id: 'user1',
          $thing: 'User',
          $thingType: 'entity',
        },
      },
    });
  });

  bench('nf1[nested, $filters] Local filter on nested, single id', async () => {
    const query = {
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts', $filter: { provider: 'github' } }],
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
          $id: 'account1-3',
          id: 'account1-3',
          provider: 'github',
          isSecureProvider: false,
          user: 'user1',
        },
      ],
    });
  });

  bench('nf2[nested, $filters] Local filter on nested, by field, multiple sources, some are empty', async () => {
    const res = await ctx.query({
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
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);

    expect(deepSort(res)).toEqual([
      {
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user1',
        name: 'Antoine',
        accounts: [
          // array, we can't know it was only one
          { $thing: 'Account', $thingType: 'entity', $id: 'account1-1', provider: 'google' },
        ],
      },
      {
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user2',
        name: 'Loic',
        accounts: [{ $thing: 'Account', $thingType: 'entity', $id: 'account2-1', provider: 'google' }],
      },
      {
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user3',
        name: 'Ann',
      },
    ]);
  });

  bench('nf3[nested, $filters] Local filter on nested, by link field, multiple sources', async () => {
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

  bench('nf4[nested, $filters] Local filter on nested, by link field, multiple sources', async () => {
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

  bench('TODO{TS}:nf2a[nested, $filters] Nested filter for array of ids', async () => {
    expect(true).toEqual(false);
  });

  bench('lf1[$filter] Filter by a link field with cardinality ONE', async () => {
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

  bench('lf2[$filter, $not] Filter out by a link field with cardinality ONE', async () => {
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

  bench('lf3[$filter] Filter by a link field with cardinality MANY', async () => {
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

  bench('TODO{T}:lf4[$filter, $or] Filter by a link field with cardinality MANY', async () => {
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

  bench('slo1[$sort, $limit, $offset] root', async () => {
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

  bench('slo2[$sort, $limit, $offset] sub level', async () => {
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

  bench('TODO{S}:slo3[$sort, $limit, $offset] with an empty attribute', async () => {
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

  bench('i1[inherited, attributes] Entity with inherited attributes', async () => {
    const res = await ctx.query({ $entity: 'God', $id: 'god1' }, { noMetadata: true });
    expect(res).toEqual({
      id: 'god1',
      name: 'Richard David James',
      email: 'afx@rephlex.com',
      power: 'mind control',
      isEvil: true,
    });
  });

  bench('s1[self] Relation playing a a role defined by itself', async () => {
    const res = await ctx.query({ $relation: 'Self' }, { noMetadata: true });
    expect(deepSort(res, 'id')).toEqual([
      { id: 'self1', owned: ['self2'], space: 'space-2' },
      { id: 'self2', owned: ['self3', 'self4'], owner: 'self1', space: 'space-2' },
      { id: 'self3', owner: 'self2', space: 'space-2' },
      { id: 'self4', owner: 'self2', space: 'space-2' },
    ]);
  });

  bench('ex1[extends] Query where an object plays 3 different roles because it extends 2 types', async () => {
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

  bench('ex2[extends] Query of the parent', async () => {
    /// note: fixed with an ugly workaround (getEntityName() in parseTQL.ts)
    const res = await ctx.query({ $entity: 'Space', $id: 'space-2', $fields: ['objects'] }, { noMetadata: true });
    expect(deepSort(res, 'id')).toEqual({
      objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
    });
  });

  bench('TODO{TS}:re1[repeated] Query with repeated path, different nested ids', async () => {
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

  bench('TODO{TS}:re2[repeated] Query with repeated path, different nested patterns', async () => {
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

  bench('xf1[excludedFields] Testing excluded fields', async () => {
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

  bench('xf2[excludedFields, deep] - deep nested', async () => {
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
        $thing: 'User',
        $thingType: 'entity',
        $id: 'user2',
        id: 'user2',
        'user-tags': [
          {
            $id: 'tag-3',
            id: 'tag-3',
            $thing: 'UserTag',
            $thingType: 'relation',
            color: {
              $thing: 'Color',
              $thingType: 'entity',
              $id: 'blue',
              group: 'utg-2',
              'user-tags': ['tag-3'],
              isBlue: true,
              freeForAll: 'hey',
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

  bench('xf3[excludedFields, deep] - Exclude virtual field', async () => {
    const query = {
      $entity: 'User',
      $id: 'user2',
      $fields: [
        'id',
        { $path: 'user-tags', $fields: [{ $path: 'color', $excludedFields: ['isBlue', 'totalUserTags'] }, 'id'] },
      ],
    };

    const expectedRes = {
      id: 'user2',
      'user-tags': [
        {
          id: 'tag-3',
          color: {
            id: 'blue',
            group: 'utg-2',
            'user-tags': ['tag-3'],
            freeForAll: 'hey',
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

  bench('vi1[virtual, attribute] Virtual DB field', async () => {
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

  bench('vi2[virtual, edge] Virtual DB edge field', async () => {
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

  bench('co1[computed] Virtual computed field', async () => {
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

  bench('co2[computed] Computed virtual field depending on edge id', async () => {
    const res = await ctx.query(
      { $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'user-tags', 'totalUserTags'] },
      { noMetadata: true },
    );

    expect(deepSort(res, 'id')).toEqual([
      {
        id: 'blue',
        'user-tags': ['tag-3'],
        totalUserTags: 1,
      },
      {
        id: 'yellow',
        'user-tags': ['tag-1', 'tag-2'],
        totalUserTags: 2,
      },
    ]);
  });

  bench('TODO{TS}:co3[computed], Computed virtual field depending on edge id, missing dependencies', async () => {
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

  bench('mv1[multiVal, query, ONE], get multiVal', async () => {
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

  bench('TODO{TS}:mv2[multiVal, query, ONE], filter by multiVal', async () => {
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
		bench('[entity,nested, filter] - $filter on children property', async () => {
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
		bench('[entity,nested,filter] - Simplified filter', async () => {
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
		bench('[entity,array,includes] - filter by field of cardinality many, type text: includes one ', async () => {
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
		bench('[entity,array,includesAll] - filter by field of cardinality many, type text: includes all ', async () => {
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
		bench('[entity,array,includesAny] filter by field of cardinality many, type text: includes any ', async () => {
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
		bench('[entity,includesAny,error] using array filter includesAny on cardinality=ONE error', async () => {
			expect(bormClient).toBeDefined();
			const res = await bormClient.query({
				$entity: 'User',
				$filter: { name: { $includesAny: ['x', 'y'] } },
			});
			expect(res).toThrow(TypeError);
		});
		bench('[entity,includesAll, error] using array filter includesAll on cardinality=ONE error', async () => {
			expect(bormClient).toBeDefined();
			const res = await bormClient.query({
				$entity: 'User',
				$filter: { name: { $includesAll: ['x', 'y'] } },
			});
			expect(res).toThrow(TypeError);
		});
		// OPERATORS: NOT
		bench('[entity,filter,not] - filter by field', async () => {
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
		bench('[entity,filter,not,array,includes] filter item cardinality many', async () => {
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
		bench('[entity,OR] or filter two different fields', async () => {
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

  bench('a1[$as] - as for attributes and roles and links', async () => {
    const expectedRes = {
      email_as: 'antoine@test.com',
      id: 'user1',
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

  bench('bq1[batched query] - as for attributes and roles and links', async () => {
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

  bench('j1[json] Query a thing with a JSON attribute', async () => {
    const entity = await ctx.query({
      $entity: 'Account',
      $id: 'account1-1',
      $fields: ['profile'],
    });
    expect(entity).toMatchObject({
      profile: { hobby: ['Running'] },
    });
  });

  bench('j2[json] Query a thing with an empty JSON attribute', async () => {
    const entity = await ctx.query({
      $entity: 'Account',
      $id: 'account1-2',
      $fields: ['profile'],
    });
    expect((entity as any).profile).toBeUndefined();
  });

  bench('TODO{TS}:bq2[batched query with $as] - as for attributes and roles and links', async () => {
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

  bench('dn1[deep nested] ridiculously deep nested query', async () => {
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
        $id: 'blue',
        $thing: 'Color',
        $thingType: 'entity',
        id: 'blue',
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
        $id: 'yellow',
        $thing: 'Color',
        $thingType: 'entity',
        id: 'yellow',
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

  bench('dn2[deep numbers] Big numbers', async () => {
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

  bench('dn3[deep numbers] Big numbers nested', async () => {
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
});
