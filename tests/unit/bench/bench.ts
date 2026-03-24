import { v4 as uuidv4 } from 'uuid';

import { bench, expect } from 'vitest';
import { deepRemoveMetaData } from '../../../src/helpers';
import type { BQLResponse, BQLResponseMulti, BQLResponseSingle, WithBormMetadata } from '../../../src/index';
import type { TypeGen } from '../../../src/types/typeGen';
import { createTest } from '../../helpers/createTest';
import { deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';
import type { typesSchema } from '../../mocks/generatedSchema';
import type { KindType, UserType } from '../../types/testTypes';

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

  bench(
    'TODO{TS}:i2[inherited, attributes] Entity with inherited attributes should fetch them even when querying from parent class',
    async () => {
      const res = await ctx.query({ $entity: 'User', $id: 'god1' }, { noMetadata: true });
      expect(res).toEqual({
        id: 'god1',
        name: 'Richard David James',
        email: 'afx@rephlex.com',
        power: 'mind control',
        isEvil: true,
      });
    },
  );

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

  bench('TODO{T}:mv2[multiVal, query, ONE], filter by multiVal', async () => {
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

  bench('TODO{T}:dn2[deep numbers] Big numbers', async () => {
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

  bench('TODO{T}:dn3[deep numbers] Big numbers nested', async () => {
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

  bench('fk1[filter, keywords, exists], filter by undefined/null property', async () => {
    const res = await ctx.query({ $entity: 'User', $filter: { email: { $exists: false } } }, { noMetadata: true });

    expect(deepSort(res, 'id')).toEqual([{ id: 'user4', name: 'Ben' }]);
  });

  bench('fk2[filter, keywords, exists], filter by undefined/null property', async () => {
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
        id: 'user1',
        name: 'Antoine',
        email: 'antoine@test.com',
        accounts: ['account1-1', 'account1-2', 'account1-3'],
        spaces: ['space-1', 'space-2'],
        'user-tags': ['tag-1', 'tag-2'],
      },
      {
        id: 'user2',
        name: 'Loic',
        email: 'loic@test.com',
        accounts: ['account2-1'],
        spaces: ['space-2'],
        'user-tags': ['tag-3', 'tag-4'],
      },
      {
        id: 'user3',
        name: 'Ann',
        email: 'ann@test.com',
        accounts: ['account3-1'],
        spaces: ['space-2'],
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

  bench('fk3[filter, nested] Filter by nested property', async () => {
    const res = await ctx.query(
      {
        $entity: 'User',
        $fields: ['id', 'name', { $path: 'spaces', $fields: ['id', 'name'] }],
        $filter: {
          spaces: {
            name: 'Production',
          },
        },
      },
      { noMetadata: true },
    );
    expect(res).toEqual([
      {
        id: 'user1',
        name: 'Antoine',
        spaces: [
          {
            id: 'space-1',
            name: 'Production',
          },
          {
            id: 'space-2',
            name: 'Dev',
          },
        ],
      },
      {
        id: 'user5',
        name: 'Charlize',
        spaces: [
          {
            id: 'space-1',
            name: 'Production',
          },
        ],
      },
    ]);
  });

  //Ref and FlexRef tests

  bench('TODO{T}:ref1[ref, ONE] Get reference, id only', async () => {
    const res = await ctx.query({ $entity: 'FlexRef', $id: 'fr1', $fields: ['id', 'reference'] }, { noMetadata: true });

    expect(deepSort(res, 'id')).toEqual({
      id: 'fr1',
      reference: 'user1',
    });
  });

  bench('TODO{TS}:ref1n[ref, ONE, nested] Get also nested data', async () => {
    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fr1',
        $fields: ['id', { $path: 'reference' }],
      },
      { noMetadata: true },
    );

    expect(deepSort(res, 'id')).toEqual({
      id: 'fr1',
      reference: {
        id: 'user1',
        name: 'Antoine',
        email: 'antoine@test.com',
        accounts: ['account1-1', 'account1-2', 'account1-3'],
        'space-user': ['u1-s1', 'u1-s2'],
        spaces: ['space-1', 'space-2'],
        'user-accounts': ['ua1-1', 'ua1-2', 'ua1-3'],
        'user-tags': ['tag-1', 'tag-2'],
      },
    });
  });

  bench('TODO{TS}:ref1nf[ref, ONE, nested, someFields] Get also nested data but only some fields', async () => {
    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fr1',
        $fields: ['id', { $path: 'reference', $fields: ['id', 'accounts', 'email'] }],
      },
      { noMetadata: true },
    );

    expect(deepSort(res, 'id')).toEqual({
      id: 'fr1',
      reference: { id: 'user1', accounts: ['account1-1', 'account1-2', 'account1-3'], email: 'antoine@test.com' },
    });
  });

  bench('TODO{T}:ref2[ref, MANY] Get references, id only', async () => {
    const res = await ctx.query({ $entity: 'FlexRef', $id: 'fr2' }, { noMetadata: true });

    expect(deepSort(res, 'id')).toEqual({
      id: 'fr2',
      references: ['user1', 'user2'],
    });
  });

  bench('TODO{T}:ref3[ref, flex, ONE] Get flexReference', async () => {
    const res = await ctx.query({ $entity: 'FlexRef', $id: ['fr3', 'fr4'] }, { noMetadata: true });

    expect(deepSort(res, 'id')).toEqual([
      {
        id: 'fr3',
        flexReference: 7,
      },
      {
        id: 'fr4',
        flexReference: 'user1',
      },
    ]);
  });

  bench('TODO{T}:ref4[ref, flex, MANY] Get flexReferences', async () => {
    const res = await ctx.query({ $entity: 'FlexRef', $id: 'fr5' }, { noMetadata: true });

    expect(res).toEqual({
      id: 'fr5',
      flexReferences: [7, 'user1', 'hey'],
    });
  });

  bench('TODO{TS}:ref4nf[ref, flex, MANY, nested] Get flexReferences with nested data', async () => {
    const res = await ctx.query(
      { $entity: 'FlexRef', $id: 'fr5', $fields: ['id', { $path: 'flexReferences' }] },
      { noMetadata: true },
    );

    expect(res).toEqual({
      id: 'fr5',
      flexReferences: [
        7,
        {
          id: 'user1',
          name: 'Antoine',
          email: 'antoine@test.com',
          accounts: ['account1-1', 'account1-2', 'account1-3'],
          'space-user': ['u1-s1', 'u1-s2'],
          spaces: ['space-1', 'space-2'],
          'user-accounts': ['ua1-1', 'ua1-2', 'ua1-3'],
          'user-tags': ['tag-1', 'tag-2'],
        },
        'hey',
      ],
    });
  });

  bench(
    'TODO{TS}:ref4n[ref, flex, MANY, nested, $fields] Get flexReferences with nested data but only some fields',
    async () => {
      const res = await ctx.query(
        {
          $entity: 'FlexRef',
          $id: 'fr5',
          $fields: ['id', { $path: 'flexReferences', $fields: ['id', 'name', 'user-tags'] }],
        },
        { noMetadata: true },
      );

      expect(res).toEqual({
        id: 'fr5',
        flexReferences: [
          7,
          {
            id: 'user1',
            name: 'Antoine',
            'user-tags': ['tag-1', 'tag-2'],
          },
          'hey',
        ],
      });
    },
  );

  // ======= MUTATION BENCH CASES =======

  // --- Mutation: Basic ---

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

  bench('r1[roleFields] Basic roleFields create update delete', async () => {
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

    const res3 = (await ctx.query(
      [
        { $entity: 'User', $id: ['bo-u1', 'bo-u2', 'bo-u3'] },
        {
          $relation: 'UserTag',
          $id: 'bo-ut1',
          $fields: ['id', { $path: 'users', $fields: ['id', 'name'] }],
        },
      ],
      { returnNulls: true },
    )) as BQLResponseMulti;

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

    const res4 = (await ctx.query(
      [
        { $entity: 'User', $id: ['bo-u1', 'bo-u2', 'bo-u3', 'bo-u4'] },
        {
          $relation: 'UserTag',
          $id: 'bo-ut1',
        },
      ],
      { returnNulls: true },
    )) as BQLResponseMulti;

    expect(res4[0]).toBeNull();
    expect(res4[1]).toBeNull();
  });

  bench('TODO{T}:r2[create] Basic roleFields link unlink', async () => {
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

  bench('TODO{T}:l1[direct linkField] Basic linkField', async () => {
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

    const isCleanRes = (await ctx.query(
      [
        { $entity: 'User', $id: 'l1-u1' },
        { $relation: 'UserTag', $id: ['l1-utg1', 'l1-utg2', 'l1-utg3'] },
      ],
      { returnNulls: true },
    )) as BQLResponseMulti;

    expect(isCleanRes[0]).toBeNull();
    expect(isCleanRes[1]).toBeNull();
  });

  bench('b1a[create] Basic', async () => {
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

  bench('b1b[create, update] Create a thing with an empty JSON attribute, then update it', async () => {
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

  bench('b1b[create, update] Create a thing with a JSON attribute, then update it', async () => {
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

  bench('b1b[create] Create a nested thing with a JSON attribute', async () => {
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

  bench('b2a[update] Basic', async () => {
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

  bench('b2b[update] Set null in single-attribute mutation should delete the attribute', async () => {
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

  bench('b2c[update] Set null in multi-attributes mutation should delete the attribute', async () => {
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

  bench('b2d[update] Set an empty string should update the attribute to an empty string', async () => {
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

  bench('b3e[delete, entity] Basic', async () => {
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

  bench('b3r[delete, relation] Basic', async () => {
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

  bench('b3rn[delete, relation, nested] Basic', async () => {
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

  bench('b4[create, children] Create with children', async () => {
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

  bench('b4.2[create, link] Create all then link', async () => {
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

  bench('TODO{T}:b4.3[update, link] Link ALL (without ids)', async () => {
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

  bench('TODO{TS}:b4.4[create, link] Create and link ALL at once (without ids)', async () => {
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

  bench('b5[update, children] Update children', async () => {
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

  bench('b6.1[create, withId] Create with id (override default)', async () => {
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

  bench('b6.2[create, default id] Create without id', async () => {
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

  bench('b7[create, inherited] inheritedAttributesMutation', async () => {
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

  bench('b8[create, multiple, date] Next-auth example ', async () => {
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
        expires: new Date('2023-06-10T14:58:09.066Z'),
        id: expect.any(String),
        sessionToken: '8ac4c6d7-e8ba-4e63-9e30-1d662b626ad4',
        user: 'user1',
      },
    ]);
  });

  bench('mv1[create, multiVal] ', async () => {
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
          freeForAll: new Date('2023-06-10T14:58:09.066Z'),
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

  bench('mv2[create, edit] ', async () => {
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
        freeForAll: new Date('2023-06-10T14:58:09.066Z'),
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

  bench('mv3[create, multiVal, specialChars] ', async () => {
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

  bench('n1[create, nested] nested', async () => {
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

  bench('n2[create, nested] nested, self referenced', async () => {
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

  bench('n3[delete, nested] nested delete', async () => {
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

  bench('TEMP:buffer', async () => {
    // Some failed tests generate a fail in the next test, this test is here to prevent that to happen in ui
    // todo: fix the borm / jest issue instead
    await ctx.query({ $entity: 'Space' });
  });

  bench('u1[update, multiple] Shared ids', async () => {
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

  bench('u2[update, multiple, nested(many), noId] Update children (no id)', async () => {
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

  bench('u3[update, multiple, nested(many), noId] Update but all children (no id)', async () => {
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

  bench('u4[update, multiple, nested(one), noId] Update all children (no id)', async () => {
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

  bench('ext1[role, link, extended] Link role to subtype of player', async () => {
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

  bench('ext2[rolelf, link, extended] Link linkfield target role to subtype of player', async () => {
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

  bench('ext3[relationlf, link, extended] Link linkfield target relation to subtype of player', async () => {
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

  bench('pf1[prefix, lf] Prefixed linkfield tunnel', async () => {
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
        expires: new Date('2023-06-10T14:58:09.066Z'),
        id: expect.any(String),
        user: 'god1',
      },
    ]);
  });

  bench('pf2[prefix, lf, wrong] Prefixed linkfield tunnel with wrong thing', async () => {
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
      expires: new Date('2023-06-10T14:58:09.066Z'),
      id: expect.any(String),
      user: undefined,
    });
  });

  bench('pf3[prefix, lf, tempId] Prefixed linkfield tunnel with tempId', async () => {
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

  bench('TODO{TS}:pf4[prefix, lf, tempId, wrong] Prefixed linkfield tunnel with tempId from wrong kind', async () => {
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

  bench('TODO{TS}:pf5[prefix, lf, tempId] Prefixed linkfield tunnel with tempId', async () => {
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

  bench('enum1[create, update, reset] Should reset enum value to null without error', async () => {
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

  bench('enum2[create, update, reset] Should not let reset on non nullable property', async () => {
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
        expect(err.message.startsWith('Error running SURQL mutation: Found NONE for field `requiredOption`')).toBe(
          true,
        );
      }
    }
  });

  // --- Mutation: Edges ---

  bench(
    'l1[link, add, nested, relation] Update entity by adding a new created relation children. Also test getting ids by tempId',
    async () => {
      const editedUser = await ctx.mutate(
        {
          $entity: 'User',
          $id: 'user5',
          'user-tags': [
            {
              name: 'a tag',
              $tempId: '_:newTagId',
              group: { color: { id: 'purple' } }, // create new
            },
          ],
        },
        { noMetadata: false },
      );

      /// We get the id by its tempId
      const tagId = editedUser?.find((m) => m.$tempId === '_:newTagId')?.$id;
      if (!tagId) {
        throw new Error('Tag id not found');
      }

      const resUser = await ctx.query(
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
        { noMetadata: true },
      );
      expect(resUser).toBeDefined();
      expect(resUser).toEqual({
        id: 'user5',
        'user-tags': [{ id: expect.any(String), name: 'a tag', group: { color: 'purple' } }],
      });

      /// delete the created tag, created color and group. SPlit in two because old typedb constraint, shuould merge in the future
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: tagId,
          color: { $op: 'delete' },
        },
        { noMetadata: true },
      );

      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: tagId,
          group: { $op: 'delete' },
          $op: 'delete',
        },
        { noMetadata: true },
      );

      ///check the color purple is been deleted
      const resColors = await ctx.query(
        {
          $entity: 'Color',
          $fields: ['id'],
        },
        { noMetadata: true },
      );

      expect(deepSort(resColors, 'id')).toEqual([
        {
          id: 'blue',
        },
        {
          id: 'red',
        },
        {
          id: 'yellow',
        },
      ]);
    },
  );

  bench('l2[link, nested, relation] Create and update 3-level nested. Also test getting ids by type', async () => {
    //create two colors for this test
    await ctx.mutate(
      [
        {
          $entity: 'Color',
          $op: 'create',
          id: 'l2-yellow',
        },
        {
          $entity: 'Color',
          $op: 'create',
          id: 'l2-blue',
        },
      ],
      { noMetadata: true },
    );
    const mutation = await ctx.mutate(
      {
        $entity: 'User',
        $id: 'user4',
        'user-tags': [
          {
            name: 'another tag',
            group: { color: { $id: 'l2-yellow' } }, // link to pre-existing
          },
          {
            name: 'yet another tag',
            group: { color: { $id: 'l2-blue' } }, // link to pre-existing
          },
        ],
      },
      { noMetadata: false },
    );

    //expect mutation to be an array
    expect(mutation).toBeDefined();
    expect(mutation).toBeInstanceOf(Array);

    //THis test also test the autogeneration of ids as we are not defining them we need to catch them to delete them
    const createdTagsIds = mutation
      ?.filter((obj) => obj.$op === 'create' && obj.$thing === 'UserTag')
      .map((obj) => obj.$id);

    const createdTagGroupsIds = mutation
      ?.filter((obj) => obj.$op === 'create' && obj.$thing === 'UserTagGroup')
      .map((obj) => obj.$id);

    expect(createdTagsIds.length).toBe(2);

    const resUser = await ctx.query(
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
      { noMetadata: true },
    );

    ///Clean:  now delete the two new tags
    await ctx.mutate(
      {
        $relation: 'UserTag',
        $id: createdTagsIds,
        $op: 'delete',
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: createdTagGroupsIds,
        $op: 'delete',
      },
      { noMetadata: true },
    );
    //and colors
    await ctx.mutate(
      {
        $entity: 'Color',
        $id: ['l2-yellow', 'l2-blue'],
        $op: 'delete',
      },
      { noMetadata: true },
    );

    //Check the results
    expect(resUser).toBeDefined();
    expect(resUser).toEqual({
      id: 'user4',
      'user-tags': expect.arrayContaining([
        {
          id: expect.any(String),
          name: 'another tag',
          group: { color: 'l2-yellow' },
        },
        {
          id: expect.any(String),
          name: 'yet another tag',
          group: { color: 'l2-blue' },
        },
      ]),
    });
  });

  bench('l3ent[unlink, multiple, entity] unlink multiple linkFields (not roleFields)', async () => {
    // todo 4 cases
    // case 1: Unlink a simple a-b relation (Edge = delete)
    // case 2: Unlink with target = relation (Edge unlink the role in the director relation)
    // case 3: Unlink with a relation that is a role of a relation (Edge = 'unlink',just unlink things connected to the role)
    // case 4: Unlink in a >3 role relation (Edge = 'unlink',ensure the other >2 roles stay connected )
    const originalState = await ctx.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'spaces', 'accounts'],
      },
      { noMetadata: true },
    );

    expect(originalState).toEqual({
      accounts: ['account2-1'],
      id: 'user2',
      spaces: ['space-2'],
    });
    /// do the unlinks
    await ctx.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: null,
        accounts: null,
      },
      { noMetadata: true },
    );

    const user = await ctx.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'spaces', 'accounts'],
      },
      { noMetadata: true },
    );

    expect(user).toBeDefined();
    expect(user).toEqual({
      id: 'user2',
    });

    /// recover original state
    await ctx.mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: [{ $op: 'unlink' }, { $op: 'link', $id: 'space-2' }],
        accounts: [{ $op: 'unlink' }, { $op: 'link', $id: 'account2-1' }],
      },
      { noMetadata: true },
    );
    const user2 = await ctx.query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'spaces', 'accounts'],
      },
      { noMetadata: true },
    );
    expect(user2).toBeDefined();
    expect(user2).toEqual({
      id: 'user2',
      spaces: ['space-2'],
      accounts: ['account2-1'],
    });
  });

  bench('l3rel[unlink, simple, relation] unlink link in relation but one role per time', async () => {
    // todo: When the relation is the self relation being modified, no need to have it as match and then as op in the edges

    await ctx.mutate(
      [
        {
          $relation: 'Space-User',
          $id: 'u3-s2',
          users: null,
        },
      ],
      { noMetadata: true },
    );

    await ctx.mutate(
      [
        {
          $relation: 'Space-User',
          $id: 'u3-s2',
          spaces: null,
        },
      ],
      { noMetadata: true },
    );

    const user = await ctx.query(
      {
        $relation: 'Space-User',
        $id: 'u3-s2',
        $fields: ['spaces', 'users', 'power', 'id'],
      },
      { noMetadata: true },
    );

    expect(user).toBeDefined();
    expect(user).toEqual({
      id: 'u3-s2',
      power: 'power1',
    });
    // Recover the state
    await ctx.mutate({
      $relation: 'Space-User',
      $id: 'u3-s2',
      spaces: [{ $op: 'link', $id: 'space-2' }], // todo: simplify when replaces work
      users: [{ $op: 'link', $id: 'user3' }],
    });
  });

  bench(
    'l4[link, add, relation, nested] add link in complex relation. Also unlink test to be splitted somewhere',
    async () => {
      await ctx.mutate(
        {
          $entity: 'User',
          $id: 'user3',
          'user-tags': [{ $id: 'tag-3' }], // adding an existing
        },
        { noMetadata: true },
      );

      const user = await ctx.query(
        {
          $entity: 'User',
          $id: 'user3',
          $fields: ['id', 'user-tags'],
        },
        { noMetadata: true },
      );
      expect(user).toBeDefined();
      expect(deepSort(user, 'id')).toEqual({
        id: 'user3',
        'user-tags': ['tag-2', 'tag-3'],
      });

      /// replace by deleting all and adding 3 back
      /// this would kill tag-2 if it wasnt already linked to something, so in this case it should work to link it back to tag-2
      await ctx.mutate(
        {
          $entity: 'User',
          $id: 'user3',
          'user-tags': null, // removing all
        },
        { noMetadata: true },
      );
      await ctx.mutate(
        {
          $entity: 'User',
          $id: 'user3',
          'user-tags': [{ $op: 'link', $id: 'tag-2' }], // adding an existing
        },
        { noMetadata: true },
      );

      const updatedUser = await ctx.query(
        {
          $entity: 'User',
          $id: 'user3',
          $fields: ['id', 'user-tags'],
        },
        { noMetadata: true },
      );

      expect(updatedUser).toEqual({
        id: 'user3',
        'user-tags': ['tag-2'],
      });
    },
  );

  bench('l5[unlink, nested] unlink by id', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        tags: [
          { $op: 'unlink', $id: 'tag-2' }, // unlink by id
        ],
      },
      { noMetadata: true },
    );

    const userTag = await ctx.query(
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        $fields: ['id', 'users', 'group', 'color'],
      },
      { noMetadata: true },
    );
    expect(userTag).toBeDefined();

    expect(deepSort(userTag, 'id')).toEqual({
      id: 'tag-2',
      // todo: add 'user2'
      users: ['user1', 'user3'], // user2 linked in l4
      // group: undefined,
      // color: undefined,
    });

    const userTagGroup = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        $fields: ['id', 'tags', 'color'],
      },
      { noMetadata: true },
    );
    expect(userTagGroup).toBeDefined();

    expect(userTagGroup).toEqual({
      id: 'utg-1',
      tags: ['tag-1'],
      color: 'yellow',
    });

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        tags: [
          { $op: 'link', $id: 'tag-2' }, // link it back //todo: simplify when replaces work
        ],
      },
      { noMetadata: true },
    );
  });

  bench('l6[link, many] explicit link to many', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: [
          { $op: 'link', $id: ['tag-2', 'tag-4'] }, // link by id
        ],
      },
      { noMetadata: true },
    );

    const userTagGroup = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        $fields: ['id', 'tags'],
      },
      { noMetadata: true },
    );
    expect(userTagGroup).toBeDefined();

    expect(deepSort(userTagGroup, 'id')).toEqual({
      id: 'utg-2',
      tags: ['tag-2', 'tag-3', 'tag-4'], // user2 linked in l4
      // group: undefined,
      // color: undefined,
    });

    //Get tag-2 its original group
    try {
      await ctx.mutate({
        $relation: 'UserTag',
        $id: 'tag-2',
        group: 'utg-1',
      });
    } catch (_error) {
      //it is normal that this throws an error in typeDB as card one is not properly m anaged yet and it did not replace ut-1 which is still linked
    }
  });

  bench('l7[unlink, all, nested] unlink all from one particular role', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: null, // by default this is just an unlink, but sometimes if specified in the schema, it will be also a delete
      },
      { noMetadata: true },
    );

    const UserTagGroupModified = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    expect(UserTagGroupModified).toBeDefined();

    expect(deepSort(UserTagGroupModified, 'id')).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      id: 'utg-2',
      $id: 'utg-2',
      color: 'blue',
      space: 'space-3',
    });
    /// get it back to original state
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }], // todo: simplify when replaces work
    });
  });

  bench('l7b[unlink, all, nested] unlink all from two roles', async () => {
    // todo: test where we try to delete both but only one is actually there (which will not work with current typeDB features)
    /* const original = await bormClient.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    }); */

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: null, // by default this is just an unlink, but sometimes if specified in the schema, it will be also a delete
        color: null,
      },
      { noMetadata: true },
    );

    const UserTagGroupModified = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    expect(UserTagGroupModified).toBeDefined();

    expect(deepSort(UserTagGroupModified, 'id')).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      id: 'utg-2',
      $id: 'utg-2',
      space: 'space-3',
    });
    /// get it back to original state
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }], // todo: simplify when replaces work
      color: { $op: 'link', $id: 'blue' }, // todo: simplify when replaces work
    });

    const utg2 = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    expect(utg2).toBeDefined();
    expect(deepSort(utg2, 'id')).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      id: 'utg-2',
      $id: 'utg-2',
      space: 'space-3',
      tags: ['tag-3'],
      color: 'blue',
    });
  });

  bench('l7c[unlink, all, nested] unlink all from two roles but one is empty', async () => {
    //note: should not work but it does lol
    /* const original = await bormClient.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    //console.log('original', original); 
		*/

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: null, // by default this is just an unlink, but sometimes if specified in the schema, it will be also a delete
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        tags: null,
        color: null,
      },
      { noMetadata: true },
    );

    /*const post = await bormClient.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    //console.log('post', post); */

    const UserTagGroupModified = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
    });

    expect(UserTagGroupModified).toBeDefined();

    expect(deepSort(UserTagGroupModified, 'id')).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      id: 'utg-2',
      $id: 'utg-2',
      space: 'space-3',
    });
    /// get it back to original state
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }], // todo: simplify when replaces work
      color: { $op: 'link', $id: 'blue' }, // todo: simplify when replaces work
    });
  });

  bench('l8[create, link, relation, unsupported] Create relation and link it to multiple existing things', async () => {
    try {
      await ctx.mutate({
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
          "[Wrong format]: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.",
        );
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('l9[create,relation] Create relation multiple edges. Relation without roles should disappear', async () => {
    //surrealDB needs self-aware transactions to make this work, we can't delete orphan relations as they might get updated in the same transaction
    await ctx.mutate({
      $relation: 'UserTag',
      $op: 'create',
      id: 'tmp-user-tag3',
      users: ['user1', 'user5', 'user3'],
    });

    await ctx.mutate(
      {
        $relation: 'UserTag',
        $id: 'tmp-user-tag3',
        users: [{ $op: 'unlink', $id: ['user1', 'user3'] }],
      },
      { noMetadata: true },
    );
    const userTags = await ctx.query(
      { $relation: 'UserTag', $id: 'tmp-user-tag3', $fields: ['id', 'users'] },
      { noMetadata: true },
    );
    expect(userTags).toBeDefined();
    expect(userTags).toEqual({ id: 'tmp-user-tag3', users: ['user5'] });

    await ctx.mutate(
      {
        $relation: 'UserTag',
        $id: 'tmp-user-tag3',
        users: [{ $op: 'unlink', $id: 'user5' }],
      },
      { noMetadata: true },
    );

    try {
      //todo: Remove this once we can automatically delete orphan relations in surrealDB
      await ctx.mutate({
        $relation: 'UserTag',
        $id: 'tmp-user-tag3',
        $op: 'delete',
      });
    } catch (_error) {
      //this will fail in typeDB as it is already deleted.
    }
    const userTags2 = await ctx.query(
      { $relation: 'UserTag', $id: 'tmp-user-tag3', $fields: ['id', 'users'] },
      { noMetadata: true },
    );
    expect(userTags2).toBeNull(); /// A relation with no edges is null
  });

  bench('l10[create, link, relation] Create relation and link it to multiple existing things', async () => {
    await ctx.mutate({
      $relation: 'UserTag',
      $op: 'create',
      id: 'tmpTag',
      users: ['user1', 'user5', 'user3'],
      group: 'utg-1',
    });

    const newUserTag = await ctx.query(
      {
        $relation: 'UserTag',
        $id: 'tmpTag',
      },
      { noMetadata: true },
    );

    expect(deepSort(newUserTag, 'id')).toEqual({
      id: 'tmpTag',
      users: ['user1', 'user3', 'user5'],
      group: 'utg-1',
      color: 'yellow',
    });

    //clean the tmpTag
    await ctx.mutate({
      $relation: 'UserTag',
      $id: 'tmpTag',
      $op: 'delete',
    });
  });

  bench.skip(
    'TODO{S}l11[link, replace, relation] Get existing relation and link it to multiple existing things',
    async () => {
      //NOT TODO actually, there is a more strict version
      /// Just some pre-checks
      const tag2pre = await ctx.query(
        { $relation: 'UserTag', $id: 'tag-2', $fields: ['id', { $path: 'group', $fields: ['id', 'color'] }] },
        { noMetadata: true },
      );
      expect(tag2pre).toEqual({
        id: 'tag-2',
        group: { id: 'utg-1', color: 'yellow' },
      });

      /// The real test starts
      // todo: l11b and c, recover original l11. Issue with typedb as it tries to insert one color per tag
      /// This test requires pre-queries to work in typeDB
      await ctx.mutate({
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'l11-group',
        space: { id: 'tempSpace' }, /// one linkField is linked
        color: { id: 'tempYellow' },
        tags: ['tag-1', 'tag-2'], //this should replace the previous userTagGroup
        /// group is undefined,
        /// the replace must work in both!
      });

      await ctx.mutate({
        $relation: 'UserTagGroup',
        $id: 'l11-group',
        tags: ['tag-1', 'tag-4'],
        color: { $op: 'create', id: 'tempBlue' },
        // group: { $op: 'link', $id: 'utg-2' },
      });

      const newUserTagGroup = await ctx.query(
        {
          $relation: 'UserTagGroup',
          $id: 'l11-group',
        },
        { noMetadata: true },
      );

      expect(deepSort(newUserTagGroup, 'id')).toEqual({
        id: 'l11-group',
        tags: ['tag-1', 'tag-4'],
        color: 'tempBlue',
        space: 'tempSpace',
      });

      /// clean created groups
      await ctx.mutate({
        $relation: 'UserTagGroup',
        $id: 'l11-group',
        color: { $op: 'delete' },
        $op: 'delete',
      });

      await ctx.mutate({
        $thing: 'Color',
        $thingType: 'entity',
        $id: 'tempYellow',
        $op: 'delete',
      });

      const colors = await ctx.query(
        {
          $entity: 'Color',
          $fields: ['id'],
        },
        { noMetadata: true },
      );

      expect(deepSort(colors, 'id')).toEqual([{ id: 'blue' }, { id: 'red' }, { id: 'yellow' }]);
    },
  );

  bench(
    'TODO{T}:l11-strict[link, replace, relation] Get existing relation and link it to multiple existing things',
    async () => {
      /// Just some pre-checks
      const tag2pre = await ctx.query(
        { $relation: 'UserTag', $id: 'tag-2', $fields: ['id', { $path: 'group', $fields: ['id', 'color'] }] },
        { noMetadata: true },
      );
      expect(tag2pre).toEqual({
        id: 'tag-2',
        group: { id: 'utg-1', color: 'yellow' },
      });

      /// The real test starts
      // todo: l11b and c, recover original l11. Issue with typedb as it tries to insert one color per tag
      /// This test requires pre-queries to work in typeDB
      await ctx.mutate({
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'l11-group',
        space: { id: 'tempSpace' }, /// one linkField is linked
        color: { id: 'tempYellow' },
        tags: ['tag-1', 'tag-2'], //this should replace the previous userTagGroup
        /// group is undefined,
        /// the replace must work in both!
      });

      // More checks that only work in surrealDB because the replaces of card one are not managed in typeDB yet

      const modifiedTag2pre = await ctx.query(
        { $relation: 'UserTag', $id: 'tag-2', $fields: ['id', { $path: 'group', $fields: ['id', 'color'] }] },
        { noMetadata: true },
      );
      expect(modifiedTag2pre).toEqual({
        id: 'tag-2',
        group: { id: 'l11-group', color: 'tempYellow' },
      });

      //end checks

      await ctx.mutate({
        $relation: 'UserTagGroup',
        $id: 'l11-group',
        tags: ['tag-1', 'tag-4'],
        color: { $op: 'create', id: 'tempBlue' },
        // group: { $op: 'link', $id: 'utg-2' },
      });

      const newUserTagGroup = await ctx.query(
        {
          $relation: 'UserTagGroup',
          $id: 'l11-group',
        },
        { noMetadata: true },
      );

      expect(deepSort(newUserTagGroup, 'id')).toEqual({
        id: 'l11-group',
        tags: ['tag-1', 'tag-4'],
        color: 'tempBlue',
        space: 'tempSpace',
      });

      /// clean created groups
      await ctx.mutate({
        $relation: 'UserTagGroup',
        $id: 'l11-group',
        color: { $op: 'delete' },
        $op: 'delete',
      });

      await ctx.mutate({
        $thing: 'Color',
        $thingType: 'entity',
        $id: 'tempYellow',
        $op: 'delete',
      });

      const colors = await ctx.query(
        {
          $entity: 'Color',
          $fields: ['id'],
        },
        { noMetadata: true },
      );

      expect(deepSort(colors, 'id')).toEqual([{ id: 'blue' }, { id: 'red' }, { id: 'yellow' }]);

      /// post checks
      const utg1post = (await ctx.query(
        { $relation: 'UserTagGroup', $id: 'utg-1', $fields: ['id', 'tags'] },
        { noMetadata: true },
      )) as BQLResponseSingle;
      expect(utg1post?.tags).toBeUndefined();

      //put the groups back
      await ctx.mutate([
        { $relation: 'UserTag', $id: ['tag-2', 'tag-1'], $op: 'update', group: { $op: 'link', $id: 'utg-1' } },
      ]);

      const tag2post = await ctx.query(
        { $relation: 'UserTag', $id: 'tag-2', $fields: ['id', { $path: 'group', $fields: ['id', 'color'] }] },
        { noMetadata: true },
      );
      expect(tag2post).toEqual({
        id: 'tag-2',
        group: { id: 'utg-1', color: 'yellow' },
      });
    },
  );

  bench('l12[link,many] Insert items in multiple', async () => {
    await ctx.mutate(
      {
        $relation: 'Space-User',
        id: 'u1-s1-s2',
        users: ['user1'],
        spaces: ['space-1', 'space-2'],
      },
      { noMetadata: true },
    );
    const res = await ctx.query({ $relation: 'Space-User', $id: 'u1-s1-s2' }, { noMetadata: true });

    expect(deepSort(res, 'id')).toEqual({
      id: 'u1-s1-s2',
      spaces: ['space-1', 'space-2'],
      users: ['user1'],
    });

    //check that user1 is not repeated in space-2 as it was already there

    const res2 = await ctx.query(
      { $entity: 'Space', $id: ['space-1', 'space-2'], $fields: ['id', 'users'] },
      { noMetadata: true },
    );

    expect(deepSort(res2, 'id')).toEqual([
      { id: 'space-1', users: ['user1', 'user5'] },
      { id: 'space-2', users: ['user1', 'user2', 'user3'] },
    ]);
  });

  bench('l13[unlink, nested, relation, extends] Unlink in nested array[l3ent,b4]', async () => {
    /// get user 2, space 2 and then add a new dataField to it linked to the existing 'kind-book'

    const preUser = await ctx.query(
      { $entity: 'User', $id: 'user2', $fields: ['id', { $path: 'spaces' }] },
      { noMetadata: true },
    );

    expect(deepSort(preUser, 'id')).toEqual({
      id: 'user2',
      spaces: [
        {
          objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
          definitions: ['kind-book'],
          id: 'space-2',
          kinds: ['kind-book'],
          name: 'Dev',
          selfs: ['self1', 'self2', 'self3', 'self4'],
          users: ['user1', 'user2', 'user3'],
        },
      ],
    });

    const newRelRes = await ctx.mutate({
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
    });

    const kindBook = (await ctx.query({ $relation: 'Kind', $id: 'kind-book' }, { noMetadata: true })) as KindType;
    expect(kindBook?.dataFields).toEqual(['firstDataField']);

    if (!newRelRes || !Array.isArray(newRelRes) || typeof newRelRes[0] === 'string') {
      throw new Error('Mutation failed');
    }

    const postSpace = await ctx.query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });

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
    await ctx.mutate({
      $entity: 'User',
      $id: 'user2',
      spaces: [
        {
          $id: 'space-2',
          dataFields: [
            {
              $id: 'firstDataField',
              kinds: null,
            },
          ],
        },
      ],
    });

    const DataFieldPostPostWithoutKind = await ctx.query(
      { $relation: 'DataField', $id: 'firstDataField' },
      { noMetadata: true },
    );

    expect(DataFieldPostPostWithoutKind).toBeDefined();
    expect(DataFieldPostPostWithoutKind).toEqual({
      cardinality: 'ONE',
      computeType: 'EDITABLE',
      id: 'firstDataField',
      name: 'testField',
      description: '',
      space: 'space-2',
      type: 'TEXT',
    });
  });

  bench('l14[unlink, nested, relation] Unlink all in role', async () => {
    await ctx.mutate(
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
      { noMetadata: true },
    );

    const t2 = await ctx.query(
      { $relation: 'UserTag', $id: 'tag-2', $fields: ['color', { $path: 'group', $fields: ['id', 'color'] }] },
      { noMetadata: true },
    );
    expect(t2).toBeDefined();
    expect(t2).toEqual({
      group: { id: 'utg-1' },
    });

    // put yellow back
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-1',
      color: { $op: 'link', $id: 'yellow' },
    });

    const t2Back = await ctx.query(
      { $relation: 'UserTag', $id: 'tag-2', $fields: ['color', { $path: 'group', $fields: ['id', 'color'] }] },
      { noMetadata: true },
    );

    expect(t2Back).toEqual({
      color: 'yellow',
      group: { color: 'yellow', id: 'utg-1' },
    });
  });

  bench('l15[replace, nested, ONE, role] replace role in nested', async () => {
    await ctx.mutate({
      $relation: 'UserTag',
      $id: 'tag-2',
      group: {
        $op: 'update', // we need to specify $op = 'update' or it will be considered as 'create'
        color: 'blue', // this is not updating blue, this is updating the group, to replace current color to yellow
      },
    });

    const t2 = await ctx.query(
      { $relation: 'UserTag', $id: 'tag-2', $fields: [{ $path: 'group', $fields: ['id', 'color'] }] },
      { noMetadata: true },
    );
    expect(t2).toBeDefined();
    expect(t2).toEqual({
      group: { id: 'utg-1', color: 'blue' },
    });

    // put yellow back

    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-1',
      color: 'yellow', //replacing it back to yellow
    });
  });

  bench('l15b[unlink, link, nested, relation] Unlink in a nested field', async () => {
    //check the original state is correct
    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        color: 'yellow',
      },
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        color: 'blue',
      },
    ]);
    /// this test unlinks nested, then links nested edge
    await ctx.mutate(
      // unlink all color in all the groups linked to usertag tag.2
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        group: {
          $op: 'update', // we need to specify $op = 'update' or it will be considered as 'create'
          color: null, //this should unlink the color of the utg connected to tag-2, so the yellow gets unlinked frp, tag-1 and tag-2 which shared group 1
        },
      },
      { noMetadata: true },
    );

    const withoutColor = await ctx.query(
      { $relation: 'UserTag', $id: 'tag-2', $fields: ['id', { $path: 'group', $fields: ['id', 'color'] }] },
      { noMetadata: true },
    );

    expect(withoutColor).toEqual({
      id: 'tag-2',
      group: { id: 'utg-1' },
    });

    //checking no other group has been modified
    const allGroups = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $fields: ['id', 'color', 'tags'],
      },
      { noMetadata: true },
    );

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

    ///now tag-2 (so utg-1) ot be red (two groups can't have the same color as color.group is card ONE)
    await ctx.mutate(
      [
        {
          $relation: 'UserTag',
          $id: 'tag-2',
          group: {
            $op: 'update',
            color: 'red',
          },
        },
      ],
      { noMetadata: true },
    );

    const userTags = await ctx.query(
      {
        $relation: 'UserTag',
        $fields: ['id', { $path: 'group' }],
      },
      { noMetadata: true },
    );

    expect(deepSort(userTags, 'id')).toEqual([
      {
        id: 'tag-1',
        group: {
          id: 'utg-1',
          tags: ['tag-1', 'tag-2'],
          color: 'red',
        },
      },
      {
        id: 'tag-2',
        group: {
          id: 'utg-1',
          tags: ['tag-1', 'tag-2'],
          color: 'red',
        },
      },
      {
        id: 'tag-3',
        group: {
          id: 'utg-2',
          tags: ['tag-3'],
          space: 'space-3',
          color: 'blue',
        },
      },
      {
        id: 'tag-4',
      },
    ]);

    /// and now we get yellow back into utg-1 (reverted) and blue into utg-2
    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        color: 'yellow',
      },
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        color: 'blue',
      },
    ]);
  });

  bench('TODO{TS}:l16[replace, nested, create, replace] replacing nested under a create', async () => {
    await ctx.mutate({
      $entity: 'Thing',
      id: 'temp1',
      root: {
        $op: 'link',
        $id: 'tr10',
        extra: 'thing2', //replace thing1 to thing2 onLink
      },
    });

    const res = await ctx.query(
      {
        $entity: 'Thing',
        $id: 'temp1',
        $fields: ['id', { $path: 'root', $fields: ['extra'] }],
      },
      { noMetadata: true },
    );

    expect(res).toEqual({
      id: 'temp1',
      root: { $id: 'tr10', extra: 'thing2' },
    });
  });

  bench('TODO{T}:l17[link] Link ONE role to MANY link field in create operation', async () => {
    await ctx.mutate({
      $entity: 'Space',
      $op: 'create',
      id: 'l17-space-x',
    });

    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'l17-utg-a',
        space: 'l17-space-x',
      },
    ]);

    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'l17-utg-b',
        space: 'l17-space-x',
      },
    ]);

    const spaceX = await ctx.query(
      { $entity: 'Space', $id: 'l17-space-x', $fields: ['id', 'userTagGroups'] },
      { noMetadata: true },
    );

    const groupA = await ctx.query(
      { $relation: 'UserTagGroup', $id: 'l17-utg-a', $fields: ['id', 'space'] },
      { noMetadata: true },
    );

    const groupB = await ctx.query(
      { $relation: 'UserTagGroup', $id: 'l17-utg-b', $fields: ['id', 'space'] },
      { noMetadata: true },
    );

    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: ['l17-utg-a', 'l17-utg-b'],
      $op: 'delete',
    });

    await ctx.mutate({
      $entity: 'Space',
      $id: 'l17-space-x',
      $op: 'delete',
    });

    expect(spaceX).toEqual({
      id: 'l17-space-x',
      userTagGroups: ['l17-utg-a', 'l17-utg-b'],
    });

    expect(groupA).toEqual({
      id: 'l17-utg-a',
      space: 'l17-space-x',
    });

    expect(groupB).toEqual({
      id: 'l17-utg-b',
      space: 'l17-space-x',
    });
  });

  bench('TODO{T}:l18[link] Link ONE role to MANY link field with update operation', async () => {
    // We can't create a relation that has no field or linked to anything.
    // So we need to create the init space first to link it to the UserTagGroup.
    await ctx.mutate({
      $entity: 'Space',
      $op: 'create',
      id: 'l17-space-init',
    });

    await ctx.mutate({
      $entity: 'Space',
      $op: 'create',
      id: 'l17-space-x',
    });

    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'l17-utg-a',
        space: 'l17-space-init',
      },
    ]);

    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'l17-utg-b',
        space: 'l17-space-init',
      },
    ]);

    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'update',
        $id: 'l17-utg-a',
        space: 'l17-space-x',
      },
    ]);

    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'update',
        $id: 'l17-utg-b',
        space: 'l17-space-x',
      },
    ]);

    const spaceX = await ctx.query(
      { $entity: 'Space', $id: 'l17-space-x', $fields: ['id', 'userTagGroups'] },
      { noMetadata: true },
    );

    const groupA = await ctx.query(
      { $relation: 'UserTagGroup', $id: 'l17-utg-a', $fields: ['id', 'space'] },
      { noMetadata: true },
    );

    const groupB = await ctx.query(
      { $relation: 'UserTagGroup', $id: 'l17-utg-b', $fields: ['id', 'space'] },
      { noMetadata: true },
    );

    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: ['l17-utg-a', 'l17-utg-b'],
      $op: 'delete',
    });

    await ctx.mutate({
      $entity: 'Space',
      $id: ['l17-space-init', 'l17-space-x'],
      $op: 'delete',
    });

    expect(spaceX).toEqual({
      id: 'l17-space-x',
      userTagGroups: ['l17-utg-a', 'l17-utg-b'],
    });

    expect(groupA).toEqual({
      id: 'l17-utg-a',
      space: 'l17-space-x',
    });

    expect(groupB).toEqual({
      id: 'l17-utg-b',
      space: 'l17-space-x',
    });
  });

  bench('TODO{T}:l19[link] Link ONE link field to MANY role in create operation', async () => {
    // We can't create a relation that has no field or linked to anything.
    // So we need to create the main hook first to link it to the hook parent.
    await ctx.mutate({
      $entity: 'Hook',
      $op: 'create',
      id: 'l17-main-hook',
      requiredOption: 'a',
    });

    await ctx.mutate({
      $relation: 'HookParent',
      $op: 'create',
      id: 'l17-hook-parent-x',
      mainHook: 'l17-main-hook',
    });

    await ctx.mutate([
      {
        $entity: 'Hook',
        $op: 'create',
        id: 'l17-hook-a',
        requiredOption: 'a',
        hookParent: 'l17-hook-parent-x',
      },
    ]);

    await ctx.mutate([
      {
        $entity: 'Hook',
        $op: 'create',
        id: 'l17-hook-b',
        requiredOption: 'a',
        hookParent: 'l17-hook-parent-x',
      },
    ]);

    const hookParentX = await ctx.query(
      { $relation: 'HookParent', $id: 'l17-hook-parent-x', $fields: ['id', 'hooks'] },
      { noMetadata: true },
    );

    const hookA = await ctx.query(
      { $entity: 'Hook', $id: 'l17-hook-a', $fields: ['id', 'hookParent'] },
      { noMetadata: true },
    );

    const hookB = await ctx.query(
      { $entity: 'Hook', $id: 'l17-hook-b', $fields: ['id', 'hookParent'] },
      { noMetadata: true },
    );

    await ctx.mutate({
      $entity: 'Hook',
      $id: ['l17-main-hook', 'l17-hook-a', 'l17-hook-b'],
      $op: 'delete',
    });

    await ctx.mutate({
      $relation: 'HookParent',
      $id: 'l17-hook-parent-x',
      $op: 'delete',
    });

    expect(hookParentX).toEqual({
      id: 'l17-hook-parent-x',
      hooks: ['l17-hook-a', 'l17-hook-b'],
    });

    expect(hookA).toEqual({
      id: 'l17-hook-a',
      hookParent: 'l17-hook-parent-x',
    });

    expect(hookB).toEqual({
      id: 'l17-hook-b',
      hookParent: 'l17-hook-parent-x',
    });
  });

  bench('TODO{T}:l20[link] Link ONE link field to MANY role in update operation', async () => {
    // We can't create a relation that has no field or linked to anything.
    // So we need to create the main hook first to link it to the hook parent.
    await ctx.mutate({
      $entity: 'Hook',
      $op: 'create',
      id: 'l17-main-hook',
      requiredOption: 'a',
    });

    await ctx.mutate({
      $relation: 'HookParent',
      $op: 'create',
      id: 'l17-hook-parent-x',
      mainHook: 'l17-main-hook',
    });

    await ctx.mutate([
      {
        $entity: 'Hook',
        $op: 'create',
        id: 'l17-hook-a',
        requiredOption: 'a',
      },
    ]);

    await ctx.mutate([
      {
        $entity: 'Hook',
        $op: 'create',
        id: 'l17-hook-b',
        requiredOption: 'a',
      },
    ]);

    await ctx.mutate([
      {
        $entity: 'Hook',
        $op: 'update',
        $id: 'l17-hook-a',
        hookParent: 'l17-hook-parent-x',
      },
    ]);

    await ctx.mutate([
      {
        $entity: 'Hook',
        $op: 'update',
        $id: 'l17-hook-b',
        hookParent: 'l17-hook-parent-x',
      },
    ]);

    const hookParentX = await ctx.query(
      { $relation: 'HookParent', $id: 'l17-hook-parent-x', $fields: ['id', 'hooks'] },
      { noMetadata: true },
    );

    const hookA = await ctx.query(
      { $entity: 'Hook', $id: 'l17-hook-a', $fields: ['id', 'hookParent'] },
      { noMetadata: true },
    );

    const hookB = await ctx.query(
      { $entity: 'Hook', $id: 'l17-hook-b', $fields: ['id', 'hookParent'] },
      { noMetadata: true },
    );

    await ctx.mutate({
      $entity: 'Hook',
      $id: ['l17-main-hook', 'l17-hook-a', 'l17-hook-b'],
      $op: 'delete',
    });

    await ctx.mutate({
      $relation: 'HookParent',
      $id: 'l17-hook-parent-x',
      $op: 'delete',
    });

    expect(hookParentX).toEqual({
      id: 'l17-hook-parent-x',
      hooks: ['l17-hook-a', 'l17-hook-b'],
    });

    expect(hookA).toEqual({
      id: 'l17-hook-a',
      hookParent: 'l17-hook-parent-x',
    });

    expect(hookB).toEqual({
      id: 'l17-hook-b',
      hookParent: 'l17-hook-parent-x',
    });
  });

  // Todo: ask loic why there's an all link
  bench('TODO{TS}:rep2b[replace, unlink, link, many] Replace using unlink + link , all link', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG',
      tags: ['tag-1', 'tag-2'],
      color: 'blue',
    });

    /// the mutation to be tested
    await ctx.mutate({
      $id: 'tmpUTG',
      $relation: 'UserTagGroup',
      tags: [{ $op: 'unlink' }, { $op: 'link' }], //should unlink everything, then link everything
    });

    const tmpUTG = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $fields: ['tags'],
    });

    expect(deepSort(tmpUTG)).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG',
      tags: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
    });

    //clean changes by deleting the new tmpUTG
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $op: 'delete',
    });
  });

  bench('TODO{TS}:rep2c[replace, unlink, link, many] Replace using unlink + link , all link', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG',
      tags: ['tag-1', 'tag-2'],
      color: 'blue',
    });

    /// the mutation to be tested
    await ctx.mutate({
      $id: 'tmpUTG',
      $relation: 'UserTagGroup',
      tags: [{ $op: 'link' }], //should link  to every tag but not repeat tag-1 and tag-2
    });

    const tmpUTG = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $fields: ['tags'],
    });

    expect(deepSort(tmpUTG)).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG',
      tags: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
    });

    //clean changes by deleting the new tmpUTG
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $op: 'delete',
    });
  });

  bench('rep3[replace, many, multi] Replace multiple fields', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG1',
      tags: ['tag-1', 'tag-2'],
      //no color
    });

    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG2',
      tags: ['tag-1', 'tag-3'],
      color: 'blue',
    });

    /// the mutations to be tested:
    await ctx.mutate({
      $id: 'tmpUTG1',
      $relation: 'UserTagGroup',
      $op: 'update',
      tags: ['tag-4'], // this actually should fail, because we are assigning two userTagGroup to the same tag and tags can have a single utg.
      color: 'yellow',
    });

    const tmpUTG1 = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG1',
      $fields: ['tags', 'color'],
    });
    expect(tmpUTG1).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG1',
      tags: ['tag-4'],
      color: 'yellow',
    });

    await ctx.mutate({
      $id: 'tmpUTG2',
      $relation: 'UserTagGroup',
      $op: 'update',
      tags: ['tag-4'],
      color: 'yellow',
    });

    const tmpUTG2 = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG2',
      $fields: ['tags', 'color'],
    });

    expect(tmpUTG2).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG2',
      tags: ['tag-4'],
      color: 'yellow',
    });

    expect(tmpUTG2).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG2',
      tags: ['tag-4'],
      color: 'yellow',
    });

    //clean changes by deleting the new tmpUTGs
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: ['tmpUTG1', 'tmpUTG2'],
      $op: 'delete',
    });
    // put blue and yellow into their respective owners
    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        color: 'blue',
      },
      {
        $relation: 'UserTagGroup',
        $id: 'utg-1',
        color: 'yellow',
      },
    ]);
  });

  bench('rep4[replace, multiId] Replace multiple ids', async () => {
    /// create two tags
    await ctx.mutate([
      {
        $thing: 'UserTag',
        id: 'rep4-tag1',
        users: [{ $thing: 'User', id: 'rep4-u1' }],
      },
      {
        $thing: 'UserTag',
        id: 'rep4-tag2',
        users: [{ $thing: 'User', id: 'rep4-u2' }],
      },
      {
        $thing: 'User',
        id: 'rep4-u3',
      },
    ]);

    /// the mutations to be tested:
    await ctx.mutate({
      $thing: 'UserTag',
      $id: ['rep4-tag1', 'rep4-tag2'],
      users: ['rep4-u3'],
    });

    const tag = await ctx.query(
      {
        $relation: 'UserTag',
        $id: ['rep4-tag1', 'rep4-tag2'],
        $fields: ['id', 'users'],
      },
      { noMetadata: true },
    );
    expect(deepSort(tag)).toEqual([
      {
        id: 'rep4-tag1',
        users: ['rep4-u3'],
      },
      {
        id: 'rep4-tag2',
        users: ['rep4-u3'],
      },
    ]);

    //clean changes by deleting the new things
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $id: ['rep4-tag1', 'rep4-tag2'],
        $op: 'delete',
      },
      { $thing: 'User', $id: ['rep4-u1', 'rep4-u2', 'rep4-u3'], $op: 'delete' },
    ]);
  });

  bench('rep5[replace, cardOne] Replace indirectly a card one field', async () => {
    const preUtg2 = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        $fields: ['id', 'color'],
      },
      { noMetadata: true },
    );

    expect(preUtg2).toEqual({
      id: 'utg-2',
      color: 'blue',
    });

    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'utg-rep5',
      color: 'blue',
    });

    const postUtg2 = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'utg-2',
        $fields: ['id', 'color'],
      },
      { noMetadata: true },
    );

    const postBlue = await ctx.query(
      {
        $thing: 'Color',
        $thingType: 'entity',
        $id: 'blue',
        $fields: ['group', 'id'],
      },
      { noMetadata: true },
    );

    expect(postBlue).toEqual({
      id: 'blue',
      group: 'utg-rep5',
    });

    expect(postUtg2).toEqual({
      id: 'utg-2',
      color: undefined,
    });

    //clean changes by linking it back to utg-2
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      color: 'blue',
    });
  });

  bench('TODO{T}:one1[link, cardinality one] link a cardinality one relation', async () => {
    //create UserTagGroup with a tag
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'utg-one1',
      tags: [{ id: 'tag-one1', $op: 'create', users: ['user1'] }],
    });

    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'utg-one2',
      tags: [{ $id: 'tag-one1', $op: 'link' }],
    });

    //now if we query tag-one it has to be linked exclusively to utg-one2
    const tag1 = await ctx.query(
      { $id: 'tag-one1', $relation: 'UserTag', $fields: ['id', 'group'] },
      { noMetadata: true },
    );
    expect(tag1).toEqual({ id: 'tag-one1', group: 'utg-one2' });

    //clean changes by deleting the new tmpUTGs
    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $id: ['utg', 'tmpUTG2'],
        $op: 'delete',
      },
      {
        $relation: 'UserTag',
        $id: 'tag-one1',
        $op: 'delete',
      },
    ]);
  });

  bench('TODO{TS}:h1[unlink, hybrid] hybrid intermediary relation and direct relation', async () => {
    await ctx.mutate([
      {
        $entity: 'User',
        id: 'h1-user',
        accounts: [
          {
            id: 'h1-account1',
          },
        ],
      },
      {
        $entity: 'Account',
        id: 'h1-account2',
      },
      {
        $entity: 'Account',
        id: 'h1-account3',
      },
    ]);

    ///this one should actually only link account-ml3
    await ctx.mutate({
      $relation: 'User-Accounts',
      id: 'h1-user-account1and3',
      user: 'h1-user',
      accounts: ['h1-account2', 'h1-account3'],
    });

    await ctx.mutate({
      $entity: 'User',
      $id: 'h1-user',
      accounts: [{ $op: 'unlink', $id: 'h1-account3' }], //should not unlink account-ml1
    });

    const res = await ctx.query({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'h1-user',
      $fields: ['accounts'],
    });

    expect(deepSort(res)).toEqual({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'h1-user',
      accounts: ['h1-account1', 'h1-account2'],
    });

    //delete all
    await ctx.mutate([
      {
        $entity: 'User',
        $op: 'delete',
        $id: 'user',
      },
      {
        $entity: 'Account',
        $op: 'delete',
        $id: 'h1-account1',
      },
      {
        $entity: 'Account',
        $op: 'delete',
        $id: 'h1-account2',
      },
      {
        $entity: 'Account',
        $op: 'delete',
        $id: 'h1-account3',
      },
    ]);
  });

  bench('TODO{TS}:h2[link, hybrid] hybrid intermediary relation and direct relation', async () => {
    await ctx.mutate([
      {
        $entity: 'Account',
        id: 'account-ml2',
      },
      {
        $entity: 'Account',
        id: 'account-ml2',
      },
      {
        $entity: 'Account',
        id: 'account-ml2',
      },
    ]);
    ///this one should actually only link account-ml3
    await ctx.mutate({
      $relation: 'User-Accounts',
      id: 'user-ml1-account-ml1',
      user: 'user-ml1',
      accounts: ['account-ml1', 'account-ml3'],
    });

    await ctx.mutate({
      $entity: 'User',
      $id: 'user-ml1',
      accounts: [{ $op: 'unlink', $id: 'account-ml3' }],
    });

    const res = await ctx.query({
      $entity: 'User',
      $id: 'user-ml1',
      $fields: ['accounts'],
    });

    expect(deepSort(res)).toEqual({
      $entity: 'User',
      $id: 'user-ml1',
      accounts: ['account-ml1', 'account-ml2'],
    });
  });

  bench(
    'lm-i1[link and unlink many, intermediary] linking and unlinking many things at once with intermediary, not batched, on-create',
    async () => {
      // create user with 3 spaces

      await ctx.mutate({
        $entity: 'User',
        id: 'ul-many-1',
        spaces: [
          {
            $op: 'link',
            $id: 'space-1',
          },
          {
            $op: 'link',
            $id: 'space-2',
          },
          {
            $op: 'link',
            $id: 'space-3',
          },
        ],
      });

      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-1',
        spaces: [
          {
            $op: 'unlink',
            $id: 'space-1',
          },
          {
            $op: 'unlink',
            $id: 'space-2',
          },
        ],
      });

      const res = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-1',
        $fields: ['spaces', 'id'],
      });

      expect(deepSort(res)).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-1',
        id: 'ul-many-1',
        spaces: ['space-3'],
      });

      // delete user
      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-1',
        $op: 'delete',
      });
    },
  );

  bench(
    'lm-i2[link and unlink many] linking and unlinking many things at once with intermediary, batched, on-create',
    async () => {
      // todo: User with same id

      await ctx.mutate({
        $entity: 'User',
        id: 'ul-many-2',
        spaces: [
          {
            $op: 'link',
            $id: ['space-1', 'space-2', 'space-3'],
          },
        ],
      });

      const res1 = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-2',
        $fields: ['spaces', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-2',
        id: 'ul-many-2',
        spaces: ['space-1', 'space-2', 'space-3'],
      });

      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-2',
        spaces: [
          {
            $op: 'unlink',
            $id: ['space-1', 'space-2'],
          },
        ],
      });

      const res = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-2',
        $fields: ['spaces'],
      });

      expect(deepSort(res)).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-2',
        spaces: ['space-3'],
      });

      // delete user
      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-2',
        $op: 'delete',
      });
    },
  );

  bench(
    'lm-i3[link and unlink many, intermediary] linking and unlinking many things at once with intermediary, not batched, pre-created',
    async () => {
      await ctx.mutate({
        $entity: 'User',
        id: 'ul-many-3',
      });

      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-3',
        spaces: [
          {
            $op: 'link',
            $id: 'space-1',
          },
          {
            $op: 'link',
            $id: 'space-2',
          },
          {
            $op: 'link',
            $id: 'space-3',
          },
        ],
      });

      const res1 = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-3',
        $fields: ['spaces', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-3',
        id: 'ul-many-3',
        spaces: ['space-1', 'space-2', 'space-3'],
      });

      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-3',
        spaces: [
          {
            $op: 'unlink',
            $id: 'space-1',
          },
          {
            $op: 'unlink',
            $id: 'space-2',
          },
        ],
      });

      const res = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-3',
        $fields: ['spaces'],
      });

      expect(deepSort(res)).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-3',
        spaces: ['space-3'],
      });

      // delete user
      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-3',
        $op: 'delete',
      });
    },
  );

  bench(
    'lm-i4[link and unlink many, intermediary] linking and unlinking many things at once batched with intermediary, batched, pre-created',
    async () => {
      await ctx.mutate({
        $entity: 'User',
        id: 'ul-many-4',
      });

      // todo: intermediary has multiple of same ids

      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-4',
        spaces: [
          {
            $op: 'link',
            $id: ['space-1', 'space-2', 'space-3'],
          },
        ],
      });

      const res1 = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-4',
        $fields: ['spaces', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-4',
        id: 'ul-many-4',
        spaces: ['space-1', 'space-2', 'space-3'],
      });

      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-4',
        spaces: [
          {
            $op: 'unlink',
            $id: ['space-1', 'space-2'],
          },
        ],
      });

      const res = await ctx.query({
        $entity: 'User',
        $id: 'ul-many-4',
        $fields: ['spaces', 'id'],
      });

      expect(deepSort(res)).toEqual({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'ul-many-4',
        id: 'ul-many-4',
        spaces: ['space-3'],
      });

      // delete user
      await ctx.mutate({
        $entity: 'User',
        $id: 'ul-many-4',
        $op: 'delete',
      });
    },
  );

  bench(
    'lm-ni1[link and unlink many] linking and unlinking many things at once without intermediary, not batched, on-create',
    async () => {
      await ctx.mutate([
        {
          $relation: 'Kind',
          id: 'k1',
          space: 'space-1',
        },
        {
          $relation: 'Kind',
          id: 'k2',
          space: 'space-1',
        },
        {
          $relation: 'Kind',
          id: 'k3',
          space: 'space-1',
        },
      ]);

      await ctx.mutate({
        $relation: 'Field',
        id: 'link-many-1',
        kinds: [
          {
            $op: 'link',
            $id: 'k1',
          },
          {
            $op: 'link',
            $id: 'k2',
          },
          {
            $op: 'link',
            $id: 'k3',
          },
        ],
      });

      const res1 = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-1',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-1',
        id: 'link-many-1',
        kinds: ['k1', 'k2', 'k3'],
      });

      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-1',
        kinds: [
          {
            $op: 'unlink',
            $id: 'k1',
          },
          {
            $op: 'unlink',
            $id: 'k2',
          },
        ],
      });

      const res = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-1',
        $fields: ['kinds', 'id'],
      });

      // todo: it's only unlinking the first unlink, error occurring after pre-query

      expect(deepSort(res, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-1',
        id: 'link-many-1',
        kinds: ['k3'],
      });

      // cleaning
      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-1',
        $op: 'delete',
      });
    },
  );

  bench(
    'lm-ni2[link and unlink many] linking and unlinking many things at once without intermediary, batched, on-create',
    async () => {
      await ctx.mutate({
        $relation: 'Field',
        id: 'link-many-2',
        kinds: [
          {
            $op: 'link',
            $id: ['k1', 'k2', 'k3'],
          },
        ],
      });

      // todo: it's not creating with batched, error occurring after pre-query

      const res1 = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-2',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-2',
        id: 'link-many-2',
        kinds: ['k1', 'k2', 'k3'],
      });

      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-2',
        kinds: [
          {
            $op: 'unlink',
            $id: ['k1', 'k2'],
          },
        ],
      });

      const res = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-2',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-2',
        id: 'link-many-2',
        kinds: ['k3'],
      });

      // cleaning
      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-2',
        $op: 'delete',
      });
    },
  );

  bench(
    'lm-ni3[link and unlink many] linking and unlinking many things at once without intermediary, not batched, pre-created',
    async () => {
      // await bormClient.mutate([
      // 	{
      // 		$relation: 'Kind',
      // 		id: 'k1',
      // 		space: 'space-1',
      // 	},
      // 	{
      // 		$relation: 'Kind',
      // 		id: 'k2',
      // 		space: 'space-1',
      // 	},
      // 	{
      // 		$relation: 'Kind',
      // 		id: 'k3',
      // 		space: 'space-1',
      // 	},
      // ]);

      await ctx.mutate({
        $relation: 'Field',
        id: 'link-many-3',
        space: 'space-1',
      });

      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-3',
        kinds: [
          {
            $op: 'link',
            $id: 'k1',
          },
          {
            $op: 'link',
            $id: 'k2',
          },
          {
            $op: 'link',
            $id: 'k3',
          },
        ],
      });

      // todo: it's only linking 1, error occurring after pre-query

      const res1 = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-3',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-3',
        id: 'link-many-3',
        kinds: ['k1', 'k2', 'k3'],
      });

      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-3',
        kinds: [
          {
            $op: 'unlink',
            $id: 'k1',
          },
          {
            $op: 'unlink',
            $id: 'k2',
          },
        ],
      });

      const res = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-3',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-3',
        id: 'link-many-3',
        kinds: ['k3'],
      });

      // cleaning
      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-3',
        $op: 'delete',
      });

      await ctx.mutate([
        {
          $relation: 'Kind',
          $id: 'k1',
          $op: 'delete',
        },
        {
          $relation: 'Kind',
          $id: 'k2',
          $op: 'delete',
        },
        {
          $relation: 'Kind',
          $id: 'k3',
          $op: 'delete',
        },
      ]);
    },
  );

  bench(
    'lm-ni4[link and unlink many] linking and unlinking many things at once without intermediary, batched, pre-created',
    async () => {
      // This test fails if upper tests fail

      await ctx.mutate([
        {
          $relation: 'Kind',
          id: 'k1',
          space: 'space-1',
        },
        {
          $relation: 'Kind',
          id: 'k2',
          space: 'space-1',
        },
        {
          $relation: 'Kind',
          id: 'k3',
          space: 'space-1',
        },
      ]);

      await ctx.mutate({
        $relation: 'Field',
        id: 'link-many-4',
        space: 'space-1',
      });

      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-4',
        kinds: [
          {
            $op: 'link',
            $id: ['k1', 'k2', 'k3'],
          },
        ],
      });

      const res1 = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-4',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res1, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-4',
        id: 'link-many-4',
        kinds: ['k1', 'k2', 'k3'],
      });

      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-4',
        kinds: [
          {
            $op: 'unlink',
            $id: ['k1', 'k2'],
          },
        ],
      });

      const res = await ctx.query({
        $relation: 'Field',
        $id: 'link-many-4',
        $fields: ['kinds', 'id'],
      });

      expect(deepSort(res, 'id')).toEqual({
        $thing: 'Field',
        $thingType: 'relation',
        $id: 'link-many-4',
        id: 'link-many-4',
        kinds: ['k3'],
      });

      // cleaning
      await ctx.mutate({
        $relation: 'Field',
        $id: 'link-many-4',
        $op: 'delete',
      });

      await ctx.mutate([
        {
          $relation: 'Kind',
          $id: 'k1',
          $op: 'delete',
        },
        {
          $relation: 'Kind',
          $id: 'k2',
          $op: 'delete',
        },
        {
          $relation: 'Kind',
          $id: 'k3',
          $op: 'delete',
        },
      ]);
    },
  );

  bench(
    'd-pq1[delete with pre query, intermediary, nested] delete mutation from root and delete children with intermediary',
    async () => {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'delete-test',
          spaces: [
            {
              id: 'd-space-1',
              dataFields: [
                {
                  id: 'd-dataField-1',
                  values: [
                    {
                      id: 'd-dataValue-1',
                    },
                  ],
                  expression: { $op: 'create', id: 'd-expression-1' },
                },
                {
                  id: 'd-dataField-2',
                  values: [{ id: 'd-dataValue-2' }],
                },
                {
                  id: 'd-dataField-3',
                  expression: { $op: 'create', id: 'd-expression-2' },
                },
                {
                  id: 'd-dataField-4',
                },
              ],
            },
          ],
        },
      ]);

      await ctx.mutate({
        $entity: 'User',
        $id: 'delete-test',
        spaces: [
          {
            $id: 'd-space-1',
            dataFields: [
              {
                $op: 'delete',
                values: [
                  {
                    $op: 'delete',
                  },
                ],
                expression: {
                  $op: 'delete',
                },
              },
            ],
          },
        ],
      });

      const deleted = await ctx.query({
        $entity: 'User',
        $id: 'delete-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              {
                $path: 'dataFields',
                $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'],
              },
            ],
          },
        ],
      });

      const expressions = await ctx.query(
        {
          $relation: 'Expression',
        },
        { returnNulls: true },
      );

      const values = await ctx.query(
        {
          $relation: 'DataValue',
        },
        { returnNulls: true },
      );

      // cleaning
      await ctx.mutate({
        $entity: 'User',
        $id: 'delete-test',
        $op: 'delete',
        spaces: [
          {
            $id: 'd-space-1',
            $op: 'delete',
          },
        ],
      });

      expect(expressions).toBeNull();
      expect(values).toBeNull();

      expect(deepSort(deleted, 'id')).toEqual({
        spaces: [
          {
            $id: 'd-space-1',
            id: 'd-space-1',

            $thing: 'Space',
            $thingType: 'entity',
          },
        ],
        $thing: 'User',
        $thingType: 'entity',
        $id: 'delete-test',
        id: 'delete-test',
      });
    },
  );

  bench(
    'd-pq2[delete with pre query, intermediary, nested] delete mutation from root and delete children with intermediary',
    async () => {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'delete-test',
          spaces: [
            {
              id: 'd-space-2',
              dataFields: [
                {
                  id: 'd-dataField-1',
                  values: [
                    {
                      id: 'd-dataValue-1',
                    },
                  ],
                  expression: { id: 'd-expression-1' },
                },

                {
                  id: 'd-dataField-2',
                },
              ],
            },
          ],
        },
      ]);

      await ctx.mutate({
        $entity: 'User',
        $id: 'delete-test',
        spaces: [
          {
            $id: 'd-space-2',
            dataFields: [
              {
                $op: 'delete',
                $id: 'd-dataField-2',
                values: [
                  {
                    $op: 'delete',
                  },
                ],
                expression: {
                  $op: 'delete',
                },
              },
            ],
          },
        ],
      });

      const deleted = await ctx.query({
        $entity: 'User',
        $id: 'delete-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              {
                $path: 'dataFields',
                $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'],
              },
            ],
          },
        ],
      });

      expect(deepSort(deleted, 'id')).toEqual({
        spaces: [
          {
            $id: 'd-space-2',
            id: 'd-space-2',
            $thing: 'Space',
            $thingType: 'entity',
            dataFields: [
              {
                $id: 'd-dataField-1',
                $thing: 'DataField',
                $thingType: 'relation',
                expression: 'd-expression-1',
                id: 'd-dataField-1',
                values: [
                  {
                    $id: 'd-dataValue-1',
                    $thing: 'DataValue',
                    $thingType: 'relation',
                    id: 'd-dataValue-1',
                  },
                ],
              },
            ],
          },
        ],
        $thing: 'User',
        $thingType: 'entity',
        $id: 'delete-test',
        id: 'delete-test',
      });
    },
  );

  bench(
    'TODO{TS}:d-pq3[delete with pre query, intermediary, nested, nothing to delete] delete mutation from root and delete children but there are no children with intermediary',
    async () => {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'delete-test',
          spaces: [
            {
              id: 'd-space-1',
              dataFields: [
                {
                  id: 'd-dataField-1',
                },
              ],
            },
          ],
        },
      ]);

      await ctx.mutate({
        $entity: 'User',
        $id: 'delete-test',
        spaces: [
          {
            $id: 'd-space-1',
            dataFields: [
              {
                $id: 'd-dataField-1',
                expression: {
                  $op: 'delete',
                },
                values: [
                  {
                    $op: 'delete',
                  },
                ],
              },
            ],
          },
        ],
      });

      const deleted = await ctx.query({
        $entity: 'User',
        $id: 'delete-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              {
                $path: 'dataFields',
                $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'],
              },
            ],
          },
        ],
      });

      expect(deepSort(deleted, 'id')).toEqual({
        spaces: [
          {
            $id: 'd-space-1',
            id: 'd-space-1',
            $thing: 'Space',
            $thingType: 'entity',
            dataFields: [
              {
                $id: 'd-dataField-1',
                $thing: 'DataField',
                $thingType: 'relation',
                id: 'd-dataField-1',
              },
            ],
          },
        ],
        $thing: 'User',
        $thingType: 'entity',
        $id: 'delete-test',
        id: 'delete-test',
      });

      // cleaning
      await ctx.mutate({
        $entity: 'User',
        $id: 'delete-test',
        $op: 'delete',
        spaces: [
          {
            $id: 'd-space-1',
            $op: 'delete',
            dataFields: [{ $op: 'delete', values: [{ $op: 'delete' }] }],
          },
        ],
      });
    },
  );

  bench(
    'ul-pq1[unlink with pre query, intermediary, nested] unlink mutation from root and delete children with intermediary',
    async () => {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'unlink-test',
          spaces: [
            {
              id: 'ul-space-1',
              dataFields: [
                {
                  id: 'ul-dataField-1',
                  values: [
                    {
                      id: 'ul-dataValue-1',
                    },
                  ],
                  expression: { $op: 'create', id: 'ul-expression-1' },
                },
                {
                  id: 'ul-dataField-2',
                  values: [{ id: 'ul-dataValue-2' }],
                },
                {
                  id: 'ul-dataField-3',
                  expression: { $op: 'create', id: 'ul-expression-2' },
                },
                {
                  id: 'ul-dataField-4',
                },
              ],
            },
          ],
        },
      ]);

      await ctx.mutate({
        $entity: 'User',
        $id: 'unlink-test',
        spaces: [
          {
            $id: 'ul-space-1',
            dataFields: [
              {
                $op: 'unlink',
                values: [
                  {
                    $op: 'unlink',
                  },
                ],
                expression: {
                  $op: 'unlink',
                },
              },
            ],
          },
        ],
      });

      const unlinked = await ctx.query({
        $entity: 'User',
        $id: 'unlink-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              {
                $path: 'dataFields',
                $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'],
              },
            ],
          },
        ],
      });

      expect(deepSort(unlinked, 'id')).toEqual({
        spaces: [
          {
            $id: 'ul-space-1',
            id: 'ul-space-1',

            $thing: 'Space',
            $thingType: 'entity',
          },
        ],
        $thing: 'User',
        $thingType: 'entity',
        $id: 'unlink-test',
        id: 'unlink-test',
      });

      // cleaning
      await ctx.mutate([
        {
          $entity: 'User',
          $id: 'unlink-test',
          $op: 'delete',
          spaces: [
            {
              $id: 'ul-space-1',
              $op: 'delete',
            },
          ],
        },
      ]);
    },
  );

  bench(
    'up-pq1[update with pre query, intermediary, nested] update mutation from root and delete children with intermediary',
    async () => {
      // creating

      await ctx.mutate([
        {
          $entity: 'User',
          id: 'update-test',
          spaces: [
            {
              id: 'up-space-1',
              dataFields: [
                {
                  id: 'up-dataField-1',
                  values: [
                    {
                      id: 'up-dataValue-1',
                    },
                  ],
                  expression: { $op: 'create', id: 'up-expression-1' },
                },
                {
                  id: 'up-dataField-2',
                  values: [{ id: 'up-dataValue-2' }],
                },
                {
                  id: 'up-dataField-3',
                  expression: { $op: 'create', id: 'up-expression-2' },
                },
                {
                  id: 'up-dataField-4',
                },
              ],
            },
          ],
        },
      ]);

      await ctx.mutate({
        $entity: 'User',
        $id: 'update-test',
        spaces: [
          {
            $id: 'up-space-1',
            dataFields: [
              {
                $op: 'update',
                type: 'test-type',
                values: [
                  {
                    $op: 'update',
                    type: 'test-type',
                  },
                ],
                expression: {
                  $op: 'update',
                  value: 'test-value',
                },
              },
            ],
          },
        ],
      });

      const unlinked = await ctx.query({
        $entity: 'User',
        $id: 'update-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              {
                $path: 'dataFields',
                $fields: [
                  'id',
                  'type',
                  { $path: 'values', $fields: ['id', 'type'] },
                  { $path: 'expression', $fields: ['id', 'value'] },
                ],
              },
            ],
          },
        ],
      });

      expect(deepSort(unlinked, 'id')).toEqual({
        spaces: [
          {
            $id: 'up-space-1',
            id: 'up-space-1',
            $thing: 'Space',
            $thingType: 'entity',
            dataFields: [
              {
                $id: 'up-dataField-1',
                $thing: 'DataField',
                $thingType: 'relation',
                type: 'test-type',
                expression: {
                  $id: 'up-expression-1',
                  $thing: 'Expression',
                  $thingType: 'relation',
                  id: 'up-expression-1',
                  value: 'test-value',
                },
                id: 'up-dataField-1',
                values: [
                  {
                    $id: 'up-dataValue-1',
                    $thing: 'DataValue',
                    $thingType: 'relation',
                    id: 'up-dataValue-1',
                    type: 'test-type',
                  },
                ],
              },
              {
                $id: 'up-dataField-2',
                $thing: 'DataField',
                $thingType: 'relation',
                id: 'up-dataField-2',
                type: 'test-type',

                values: [
                  {
                    $id: 'up-dataValue-2',
                    $thing: 'DataValue',
                    $thingType: 'relation',
                    id: 'up-dataValue-2',
                    type: 'test-type',
                  },
                ],
              },
              {
                $id: 'up-dataField-3',
                $thing: 'DataField',
                $thingType: 'relation',
                type: 'test-type',

                expression: {
                  $id: 'up-expression-2',
                  $thing: 'Expression',
                  $thingType: 'relation',
                  id: 'up-expression-2',
                  value: 'test-value',
                },
                id: 'up-dataField-3',
              },
              {
                $id: 'up-dataField-4',
                $thing: 'DataField',
                $thingType: 'relation',
                id: 'up-dataField-4',
                type: 'test-type',
              },
            ],
          },
        ],
        $thing: 'User',
        $thingType: 'entity',
        $id: 'update-test',
        id: 'update-test',
      });

      // cleaning
      await ctx.mutate([
        {
          $entity: 'User',
          $id: 'update-test',
          $op: 'delete',
          spaces: [
            {
              $id: 'up-space-1',
              $op: 'delete',
              dataFields: [{ $op: 'delete', values: [{ $op: 'delete' }], expression: { $op: 'delete' } }],
            },
          ],
        },
      ]);
    },
  );

  bench('rep-del1[delete, replace, ONE] replace on cardinality ONE but deleting existing', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        id: 'rep-del1-utg1',
        color: { id: 'pink' },
      },
      { noMetadata: true },
    );
    const origin = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'rep-del1-utg1',
      },
      { noMetadata: true },
    );

    expect(origin).toBeDefined();
    expect(origin).toEqual({
      id: 'rep-del1-utg1',
      color: 'pink',
    });

    //The real test
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $thing: 'UserTagGroup',
      $id: 'rep-del1-utg1',
      color: [{ $op: 'delete' }, { $op: 'create', id: 'purple' }],
    });

    const colors = await ctx.query(
      {
        $thing: 'Color',
        $thingType: 'entity',
        $fields: ['id', 'group'],
      },
      { noMetadata: true },
    );
    const repDel = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'rep-del1-utg1',
      },
      { noMetadata: true },
    );

    expect(colors).toBeDefined();
    expect(deepSort(colors, 'id')).toEqual([
      {
        group: 'utg-2',
        id: 'blue',
      },
      {
        id: 'purple',
        group: 'rep-del1-utg1',
      },
      {
        id: 'red',
      },
      {
        group: 'utg-1',
        id: 'yellow',
      },
    ]);

    expect(repDel).toBeDefined();
    expect(repDel).toEqual({
      id: 'rep-del1-utg1',
      color: 'purple',
    });
  });

  bench('TODO:m1[Multi] Multi nested, deletion and creation same brach', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        id: 'm1-utg1',
        tags: [
          {
            id: 'm1-tag1',
            users: [
              { $thing: 'User', id: 'm1-user1' },
              { $thing: 'User', id: 'm1-user2' },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'm1-utg1',
        tags: [
          {
            $id: 'm1-tag1',
            users: [{ $op: 'delete' }, { $thing: 'User', id: 'm1-user3' }],
          },
        ],
      },
      { noMetadata: true },
    );

    const mutated = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'm1-utg1',
        $fields: ['id', { $path: 'tags', $fields: ['id', 'users'] }],
      },
      { noMetadata: true },
    );

    const users = await ctx.query(
      {
        $thing: 'User',
        $thingType: 'entity',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    expect(mutated).toBeDefined();
    expect(mutated).toEqual({
      id: 'm1-utg1',
      tags: [
        {
          id: 'm1-tag1',
          users: ['m1-user3'],
        },
      ],
    });
    expect(users).toBeDefined();
    expect(users).toContainEqual({ id: 'm1-user3' });
    expect(users).not.toContainEqual({ id: 'm1-user1' });
    expect(users).not.toContainEqual({ id: 'm1-user2' });
  });

  bench('m2[Multi, deep] Multi nested, deletion and creation same brach. Deep', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        id: 'm2-utg1',
        tags: [
          {
            id: 'm2-tag1',
            users: [
              { $thing: 'User', id: 'm2-user1', accounts: [{ id: 'm2-acc1', provider: 'github' }] },
              {
                $thing: 'User',
                id: 'm2-user2',
                accounts: [
                  { id: 'm2-acc2', provider: 'facebook' },
                  { id: 'm2-acc3', provider: 'google' },
                ],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'm2-utg1',
        tags: [
          {
            $id: 'm2-tag1',
            users: [
              { $op: 'delete', accounts: [{ $op: 'delete' }] },
              { $thing: 'User', id: 'm2-user3', accounts: [{ id: 'm2-acc4', provider: 'twitter' }] },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    const mutated = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'm2-utg1',
        $fields: ['id', { $path: 'tags', $fields: ['id', { $path: 'users', $fields: ['id', 'accounts'] }] }],
      },
      { noMetadata: true },
    );

    const users = await ctx.query(
      {
        $thing: 'User',
        $thingType: 'entity',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    const accounts = await ctx.query(
      {
        $thing: 'Account',
        $thingType: 'entity',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    expect(mutated).toBeDefined();
    expect(mutated).toEqual({
      id: 'm2-utg1',
      tags: [
        {
          id: 'm2-tag1',
          users: [{ id: 'm2-user3', accounts: ['m2-acc4'] }],
        },
      ],
    });
    expect(users).toBeDefined();
    expect(users).toContainEqual({ id: 'm2-user3' });
    expect(users).not.toContainEqual({ id: 'm2-user1' });
    expect(users).not.toContainEqual({ id: 'm2-user2' });
    expect(accounts).toBeDefined();
    expect(accounts).not.toContainEqual({ id: 'm2-acc1' });
    expect(accounts).not.toContainEqual({ id: 'm2-acc2' });
    expect(accounts).not.toContainEqual({ id: 'm2-acc3' });
    expect(accounts).toContainEqual({ id: 'm2-acc4' });
  });

  bench('TODO{TS}:m3[Multi, deep] Multi nested, deletion and creation same brach. Deeper!', async () => {
    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        id: 'm3-utg1',
        tags: [
          {
            id: 'm3-tag1',
            users: [
              {
                id: 'm3-user1',
                spaces: [
                  {
                    id: 'm3-sp1',
                    fields: [
                      {
                        id: 'm3-f1',
                        kinds: [
                          { id: 'm3-k1', space: { id: 'm3-sp3' } },
                          { id: 'm3-k2', space: { id: 'm3-sp4' } },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    const origin = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'm3-utg1',
        $fields: [
          'id',
          {
            $path: 'tags',
            $fields: [
              'id',
              {
                $path: 'users',
                $fields: ['id', { $path: 'spaces', $fields: ['id', { $path: 'fields', $fields: ['id', 'kinds'] }] }],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(origin).toBeDefined();
    expect(deepSort(origin, 'id')).toEqual({
      id: 'm3-utg1',
      tags: [
        {
          id: 'm3-tag1',
          users: [
            {
              id: 'm3-user1',
              spaces: [
                {
                  id: 'm3-sp1',
                  fields: [
                    {
                      id: 'm3-f1',
                      kinds: ['m3-k1', 'm3-k2'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    await ctx.mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'm3-utg1',
        tags: [
          {
            $id: 'm3-tag1',
            users: [
              { $op: 'delete', spaces: [{ $op: 'delete', fields: [{ $op: 'delete', kinds: [{ $op: 'delete' }] }] }] },
              {
                id: 'm3-user2',
                spaces: [
                  {
                    id: 'm3-sp2',
                    fields: [{ id: 'm3-f2', kinds: [{ id: 'm3-k3', space: { $id: 'm3-sp3', $op: 'link' } }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    const mutated = await ctx.query(
      {
        $relation: 'UserTagGroup',
        $id: 'm3-utg1',
        $fields: [
          'id',
          {
            $path: 'tags',
            $fields: [
              'id',
              {
                $path: 'users',
                $fields: ['id', { $path: 'spaces', $fields: ['id', { $path: 'fields', $fields: ['id', 'kinds'] }] }],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    const users = await ctx.query(
      {
        $thing: 'User',
        $thingType: 'entity',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    const spaces = await ctx.query(
      {
        $thing: 'Space',
        $thingType: 'entity',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    const kinds = await ctx.query(
      {
        $relation: 'Kind',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    const fields = await ctx.query(
      {
        $relation: 'Field',
        $fields: ['id'],
      },
      { noMetadata: true },
    );

    expect(mutated).toBeDefined();
    expect(mutated).toEqual({
      id: 'm3-utg1',
      tags: [
        {
          id: 'm3-tag1',
          users: [{ id: 'm3-user2', spaces: [{ id: 'm3-sp2', fields: [{ id: 'm3-f2', kinds: ['m3-k3'] }] }] }],
        },
      ],
    });
    expect(users).toBeDefined();
    expect(users).toContainEqual({ id: 'm3-user2' });
    expect(users).not.toContainEqual({ id: 'm3-user1' });
    expect(spaces).toBeDefined();
    expect(spaces).not.toContainEqual({ id: 'm3-sp1' });
    expect(spaces).toContainEqual({ id: 'm3-sp2' });
    expect(spaces).toContainEqual({ id: 'm3-sp3' });
    expect(spaces).toContainEqual({ id: 'm3-sp4' });
    expect(kinds).toBeDefined();
    expect(kinds).toContainEqual({ id: 'm3-k3' });
    expect(kinds).not.toContainEqual({ id: 'm3-k1' });
    expect(kinds).not.toContainEqual({ id: 'm3-k2' });
    expect(fields).toBeDefined();
    expect(fields).toContainEqual({ id: 'm3-f2' });
    expect(fields).not.toContainEqual({ id: 'm3-f1' });
  });

  // --- Mutations: batched and tempId ---

  bench('c0-lfr[link, create, linkfield-role] Simple tempIds', async () => {
    await ctx.mutate([
      {
        $entity: 'User',
        name: 'Hanna',
        email: 'hanna@test.ru',
        accounts: [{ $op: 'link', $tempId: '_:acc-c0' }],
      },
      {
        $tempId: '_:acc-c0',
        $op: 'create',
        $entity: 'Account',
        provider: 'MetaMask',
      },
    ]);

    const user = await ctx.query(
      { $entity: 'User', $filter: { name: 'Hanna' }, $fields: ['name', 'email', { $path: 'accounts' }] },
      { noMetadata: true },
    );
    expect(user).toBeDefined();
    expect(user).toEqual([
      {
        name: 'Hanna',
        email: 'hanna@test.ru',
        accounts: [
          {
            id: expect.any(String),
            provider: 'MetaMask',
            isSecureProvider: false,
            user: expect.any(String),
          },
        ],
      },
    ]);

    // clean
    await ctx.mutate([
      {
        $entity: 'User',
        $filter: { name: 'Hanna' },
        $op: 'delete',
        accounts: [{ $op: 'delete' }],
      },
    ]);
  });

  bench('c0-rf[link, create, roleField] Simple tempIds', async () => {
    await ctx.mutate([
      {
        $relation: 'UserTag',
        id: 'c0-tag',
        group: [{ $op: 'link', $tempId: '_:group-c0' }],
        users: [{ $thing: 'User', name: 'c0-rf-user' }],
      },
      {
        $tempId: '_:group-c0',
        $op: 'create',
        $relation: 'UserTagGroup',
      },
    ]);

    const UserTag = await ctx.query(
      { $relation: 'UserTag', $id: 'c0-tag', $fields: ['id', { $path: 'group' }] },
      { noMetadata: true },
    );
    expect(UserTag).toBeDefined();
    expect(UserTag).toEqual({
      id: 'c0-tag',
      group: {
        id: expect.any(String),
        tags: ['c0-tag'],
      },
    });
  });

  bench('c1[multi, create, link] Simple tempIds', async () => {
    const res = await ctx.mutate([
      {
        $entity: 'User',
        name: 'Peter',
        email: 'Peter@test.ru',
        accounts: [{ provider: 'google' }, { $op: 'link', $tempId: '_:acc1' }],
      },
      {
        $tempId: '_:acc1',
        $op: 'create',
        $entity: 'Account',
        provider: 'MetaMask',
      },
    ]);

    const peter = await ctx.query(
      {
        $entity: 'User',
        $fields: ['id', { $path: 'accounts', $fields: ['id', 'provider'] }],
        $filter: { name: 'Peter' },
      },
      { noMetadata: true },
    );

    expect(peter).toBeDefined();
    expect(peter).toEqual([
      {
        id: expect.any(String),
        accounts: expect.arrayContaining([
          {
            id: expect.any(String),
            provider: 'google',
          },
          {
            id: expect.any(String),
            provider: 'MetaMask',
          },
        ]),
      },
    ]);
    expect((peter as any)[0].accounts).toHaveLength(2);

    const acc1Id = (res as any[])?.find((r) => r.$tempId === '_:acc1')?.id;

    const account = await ctx.query({ $entity: 'Account', $id: acc1Id });
    expect(account).toBeDefined();
    expect(account).toEqual({
      $thing: 'Account',
      $thingType: 'entity',
      $id: acc1Id,
      id: acc1Id,
      provider: 'MetaMask',
      isSecureProvider: false,
      // expect any string as the user id is generated by the server
      user: expect.any(String),
    });
  });

  bench('c1r[multi, create, link] nested tempIds in relation', async () => {
    const res = await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        $tempId: '_:utg1',
      },
      {
        $relation: 'UserTag',
        name: 'hey',
        users: [{ $thing: 'User', name: 'toDelete' }],
        group: { $tempId: '_:utg1', $op: 'link' },
      },
    ]);

    const utg1Id = (res as any[])?.find((r) => r.$tempId === '_:utg1')?.id;

    const utg = await ctx.query({
      $relation: 'UserTagGroup',
      $id: utg1Id,
      $fields: ['id', { $path: 'tags', $fields: ['id', 'name', 'users'] }],
    });
    expect(utg).toBeDefined();
    expect(utg).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: utg1Id,
      id: utg1Id,
      tags: [
        {
          $id: expect.any(String),
          $thing: 'UserTag',
          $thingType: 'relation',
          id: expect.any(String),
          name: 'hey',
          users: [expect.any(String)],
        },
      ],
    });
  });

  bench('c2[multi, create, link] Nested tempIds simple', async () => {
    const res = await ctx.mutate([
      {
        $entity: 'Account',
        provider: 'Facebook',
        user: {
          $tempId: '_:bea',
          $thing: 'User',
          $op: 'link',
        },
      },
      {
        $entity: 'Account',
        provider: 'Google',
        user: {
          $thing: 'User',
          $op: 'create', // atm we need to indicate 'create' whrn using $tempId
          $tempId: '_:bea',
          name: 'Bea',
          email: 'bea@gmail.com',
        },
      },
    ]);
    const beaId = (res as any[])?.find((r) => r.$tempId === '_:bea')?.id;

    const res2 = await ctx.query(
      {
        $entity: 'User',
        $id: beaId,
        $fields: ['id', 'name', 'email', { $path: 'accounts', $fields: ['provider'] }],
      },
      { noMetadata: true },
    );

    expect(res2).toBeDefined();
    expect(res2).toEqual({
      id: beaId,
      name: 'Bea',
      email: 'bea@gmail.com',
      accounts: expect.arrayContaining([{ provider: 'Facebook' }, { provider: 'Google' }]),
    });
    expect((res2 as any).accounts).toHaveLength(2);
    // delete all
    await ctx.mutate([
      {
        $entity: 'User',
        $id: beaId, // not "bea" as before
        $op: 'delete',
        accounts: [{ $op: 'delete' }],
      },
    ]);
  });

  bench('c2r[multi, create, link] nested tempIds in relation', async () => {
    const res = await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $tempId: '_:utg1',
        $op: 'create',
        color: { id: 'darkGreen' },
        tags: [{ id: 'tggege', users: [{ $op: 'create', $thing: 'User', $tempId: '_:us' }] }],
      },
      {
        $relation: 'UserTag',
        id: 'deletableTag',
        name: 'hey',
        users: [{ $tempId: '_:us', $op: 'link', $thing: 'User' }],
        group: { $tempId: '_:utg1', $op: 'link', $thing: 'UserTagGroup' }, // todo => group: '_:utg1'
      },
    ]);

    const usId = (res as Array<{ $tempId: string; id: string }>)?.find((r) => r.$tempId === '_:us')?.id;
    const utg1Id = (res as Array<{ $tempId: string; id: string }>)?.find((r) => r.$tempId === '_:utg1')?.id;

    const user = await ctx.query(
      {
        $entity: 'User',
        $id: usId,
        $fields: ['id', 'name', { $path: 'user-tags', $fields: ['color', 'group', 'users', 'name'] }],
      },
      { noMetadata: true },
    );
    expect(user).toBeDefined();

    const expectedUser = {
      id: usId,
      name: 'toDelete',
      'user-tags': [
        {
          color: 'darkGreen',
          group: utg1Id,
          users: [usId],
        },
        {
          color: 'darkGreen',
          name: 'hey',
          group: utg1Id,
          users: [usId],
        },
      ],
    };
    // @ts-expect-error - TODO description
    expectArraysInObjectToContainSameElements(user, expectedUser);

    // clean

    await ctx.mutate([
      {
        $entity: 'User',
        $id: usId,
        $op: 'delete',
      },
      {
        $relation: 'UserTagGroup',
        $id: utg1Id,
        $op: 'delete',
      },
      {
        $relation: 'UserTag',
        $id: 'tggege',
        $op: 'delete',
      },
      {
        $relation: 'UserTag',
        $id: 'deletableTag',
        $op: 'delete',
      },
    ]);
  });

  bench('c3[multi, create, link] Nested tempIds triple', async () => {
    const res = await ctx.mutate([
      {
        $entity: 'Account',
        provider: 'Facebook',
        user: {
          $tempId: '_:bea',
          $thing: 'User',
          $op: 'link',
        },
      },
      {
        $entity: 'Account',
        provider: 'Metamask',
        user: {
          $tempId: '_:bea',
          $thing: 'User',
          $op: 'link',
        },
      },
      {
        $entity: 'Account',
        provider: 'Google',
        user: {
          $thing: 'User',
          $op: 'create', // atm we need to indicate 'create' whrn using $tempId
          $tempId: '_:bea',
          name: 'Bea',
          email: 'bea@gmail.com',
        },
      },
    ]);
    const beaId = (res as Array<{ $tempId: string; id: string }>)?.find((r) => r.$tempId === '_:bea')?.id;

    const res2 = await ctx.query({ $entity: 'User', $id: beaId });
    expect(res2).toBeDefined();
    expect(res2).toEqual({
      $thing: 'User',
      $thingType: 'entity',
      $id: beaId,
      id: beaId,
      name: 'Bea',
      email: 'bea@gmail.com',
      accounts: [expect.any(String), expect.any(String), expect.any(String)],
    });
    // delete all
    await ctx.mutate([
      {
        $entity: 'User',
        $id: beaId,
        $op: 'delete',
        accounts: [{ $op: 'delete' }],
      },
    ]);
  });

  bench('c4[multi, create, link] Complex tempIds', async () => {
    await ctx.mutate([
      {
        $thing: 'User',
        name: 'PeterC4',
        email: 'Peter@test.ru',
        accounts: [
          { provider: 'google', $op: 'create' },
          { $op: 'create', $tempId: '_:acc1', provider: 'facebook' },
        ],
      },
      {
        $tempId: '_:us1',
        $op: 'create',
        $entity: 'User',
        name: 'Bob',
      },
      {
        $entity: 'User',
        name: 'Bea',
        accounts: [
          { provider: 'facebook' },
          { $tempId: '_:gh1', $op: 'link', $thing: 'Account' },
          // { $op: 'link', $filter: { provider: 'google' } },
        ],
      },
      {
        $entity: 'Account',
        provider: 'Microsoft',
        user: { $thing: 'User', name: 'Carla' },
      },
      {
        $tempId: '_:gh1',
        $op: 'create',
        $entity: 'Account',
        provider: 'github',
      },
      {
        $entity: 'Account',
        $tempId: '_:mm',
        $op: 'create',
        provider: 'metamask',
      },
      {
        $relation: 'User-Accounts',
        accounts: [{ $tempId: '_:mm', $op: 'link' }],
        user: { $tempId: '_:us1', $op: 'link', $thing: 'User' },
      },
    ]);

    const userAndAccounts = await ctx.query(
      {
        $entity: 'User',
        $fields: ['name', { $path: 'accounts', $fields: ['provider'] }],
        //@ts-expect-error Filter types are not correct yet //todo
        $filter: [{ name: 'Bea' }, { name: 'Bob' }, { name: 'PeterC4' }],
      },
      { noMetadata: true },
    );

    expect(userAndAccounts).toBeDefined();
    expect(deepSort(userAndAccounts, 'name')).toMatchObject([
      {
        name: 'Bea',
        accounts: expect.arrayContaining([
          expect.objectContaining({ provider: 'facebook' }),
          expect.objectContaining({ provider: 'github' }),
        ]),
      },
      { name: 'Bob', accounts: [{ provider: 'metamask' }] },
      {
        name: 'PeterC4',
        accounts: expect.arrayContaining([
          expect.objectContaining({ provider: 'facebook' }),
          expect.objectContaining({ provider: 'google' }),
        ]),
      },
    ]);
  });

  bench('c5[multi, create, link] tempIds in extended relation', async () => {
    const [res1] = await ctx.mutate([
      {
        $entity: 'Space',
        $tempId: '_:Personal',
        $op: 'create',
        name: 'Personal',
      },
    ]);

    const spaceId = res1?.id as string;

    await ctx.mutate([
      {
        $entity: 'Space',
        $id: spaceId,
        kinds: [
          {
            $op: 'create',
            $tempId: '_:person',
            name: 'c5-person',
          },
        ],
      },
    ]);

    const spaceRes = await ctx.query(
      {
        $entity: 'Space',
        $id: spaceId,
        $fields: ['kinds'],
      },
      { noMetadata: true },
    );

    expect(spaceRes).toBeDefined();
    expect(spaceRes).toEqual({
      kinds: [expect.any(String)],
    });

    //clean the new kind
    await ctx.mutate([
      {
        $entity: 'Space',
        $id: spaceId,
        kinds: [{ $op: 'delete' }],
      },
    ]);
  });

  bench('c6[multi, link] tempIds along with normalIds in string format', async () => {
    try {
      await ctx.mutate([
        {
          $entity: 'Space',
          id: 'c6-space1',
          $op: 'create',
          name: 'Personal',
        },
      ]);

      await ctx.mutate([
        {
          $entity: 'Space',
          $op: 'create',
          id: 'c6-space2',
          $tempId: '_:space2',
        },
        {
          $thing: 'User',
          id: 'c6-user1',
          $op: 'create',
          spaces: ['_:space2', 'c6-space1'],
        },
      ]);

      const userRes = await ctx.query(
        {
          $entity: 'User',
          $id: 'c6-user1',
          $fields: ['spaces'],
        },
        { noMetadata: true },
      );

      expect(userRes).toBeDefined();
      expect(deepSort(userRes, 'id')).toEqual({
        spaces: ['c6-space1', 'c6-space2'],
      });
    } finally {
      await ctx.mutate([
        {
          $entity: 'User',
          $id: 'c6-user1',
          $op: 'delete',
        },
        {
          $entity: 'Space',
          $id: 'c6-space1',
          $op: 'delete',
        },
        {
          $entity: 'Space',
          $id: 'c6-space2',
          $op: 'delete',
        },
      ]);
    }
  });

  // --- Mutation: Errors ---

  bench('e1[duplicate] Duplicate creation', async () => {
    await expect(
      ctx.mutate({
        $relation: 'User-Accounts',
        id: 'r1',
        user: {
          $thing: 'User',
          id: 'u2',
          'user-tags': [
            { id: 'ustag1', color: { id: 'pink' } },
            { id: 'ustag2', color: { id: 'pink' } },
          ],
        },
      }),
    ).rejects.toThrow('Duplicate id pink');
  });

  bench('TODO{S}:e2[relation] Error for match and $id not found', async () => {
    //Solved with prequeries in typedb, in surrealDB we need some sort of IF condition
    const mutation = {
      $relation: 'UserTagGroup',
      $id: 'non-existing-user-tag-group',
      tags: [{ $op: 'link', $id: 'tag-1' }],
    };

    const res = await ctx.mutate(mutation);
    expect(res).toStrictEqual([
      {
        $id: 'non-existing-user-tag-group',
        $error: "Does not exist or it's not linked to the parent",
      },
    ]);
  });

  bench('e3[create] Check for no $id field on $op create', async () => {
    const mutation = {
      $entity: 'User',
      $op: 'create',
      $id: 'blah',
      name: 'test testerman',
      email: 'test@test.com',
    };

    try {
      await ctx.mutate(mutation, { noMetadata: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toBe(
          "[Wrong format] Can't write to computed field $id. Try writing to the id field directly.",
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('e4[update, nested, error] Update all children error', async () => {
    /// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
    try {
      await ctx.mutate(
        {
          $entity: 'Account',
          $id: 'account3-1',
          user: {
            email: 'theNewEmailOfAnn@gmail.com',
          },
        },
        { noMetadata: true },
      );
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe('Please specify if it is a create or an update. Path: $root.0.user');
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('TODO{TS}:e5[relation] breaking the cardinality rule in a batch mutation', async () => {
    try {
      await ctx.mutate([
        {
          $entity: 'User',
          name: 'Peter',
          email: 'Peter@test.ru',
          accounts: [{ provider: 'google' }, { $op: 'link', $tempId: '_:acc1' }],
        },
        {
          $tempId: '_:acc1',
          $op: 'create',
          $entity: 'Account',
          provider: 'MetaMask',
          user: { name: 'Peter' },
        },
      ]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toBe(
          '"acc1" is connected to many entities. Entity with ID: acc1 in relation "User-Accounts" linked to multiple 2 entities in role "user".The relation\'s role is of cardinality ONE.\n',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('e7a[tempId, deletion] Delete tempId', async () => {
    // todo: antoine query of nested tempIds without op="create"

    try {
      await ctx.mutate([
        {
          $entity: 'User',
          name: 'Peter',
          email: 'Peter@test.ru',
          accounts: [{ provider: 'google', $tempId: '_:acc1', $op: 'delete' }],
        },
      ]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toBe(
          'Invalid op delete for tempId. TempIds can be created, or linked when created in another part of the same mutation.',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('e7b[tempId, unlink] Unlink tempId', async () => {
    // todo: antoine query of nested tempIds without op="create"

    try {
      await ctx.mutate([
        {
          $entity: 'User',
          name: 'Peter',
          email: 'Peter@test.ru',
          accounts: [{ provider: 'google', $tempId: '_:acc1', $op: 'unlink' }],
        },
      ]);
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe(
          'Invalid op unlink for tempId. TempIds can be created, or linked when created in another part of the same mutation.',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('e8a[multi, create, link] Incompatible tempId ops', async () => {
    try {
      await ctx.mutate([
        {
          $relation: 'UserTagGroup',
          $tempId: '_:utg1',
          $op: 'create',
        },
        {
          $relation: 'UserTag',
          name: 'hey',
          users: [{ $thing: 'User', name: 'toDelete' }],
          group: { $tempId: '_:utg1', $op: 'create' },
        },
      ]);
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe(
          '[Wrong format] Wrong operation combination for $tempId/$id "utg1". Existing: create. Current: create',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });
  bench('e8b[multi, create, link] Incompatible tempId ops', async () => {
    try {
      await ctx.mutate([
        {
          $relation: 'UserTagGroup',
          $tempId: '_:utg1',
          $op: 'link',
        },
        {
          $relation: 'UserTag',
          name: 'hey',
          users: [{ $thing: 'User', name: 'toDelete' }],
          group: { $tempId: '_:utg1', $op: 'link' },
        },
      ]);
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe("Can't link a $tempId that has not been created in the current mutation: utg1");
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{S}:m1d[delete, missing] Delete a non existing $id', async () => {
    // solved with pre-queries in typedb, for surrealDB requires some sort of if condition
    try {
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: 'tag-1',
          users: [{ $op: 'delete', $id: 'jnsndadsn' }],
        },
        { preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        //not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
        // expect(error.message).toBe('[BQLE-Q-M-1] Cannot delete $id:"jnsndadsn" because it does not exist in the DB');
        expect(error.message).toBe(
          '[BQLE-Q-M-2] Cannot delete $id:"jnsndadsn" because it is not linked to $id:"tag-1"',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{TS}:m1l[link, missing] Link a non existing $id', async () => {
    // needs more than regular pre query
    try {
      await ctx.mutate({
        $relation: 'UserTag',
        $id: 'tag-1',
        users: [{ $op: 'link', $id: 'jnsndadsn' }],
      });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('[BQLE-Q-M-1] Cannot link $id:"jnsndadsn" because it does not exist in the DB');
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{S}:m1up[update, missing] Update a non existing $id', async () => {
    // solved with pre-queries in typedb, for surrealDB requires some sort of if condition
    try {
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: 'tag-1',
          users: [{ $op: 'update', $id: 'jnsndadsn', name: 'new' }],
        },
        { preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        //not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
        // expect(error.message).toBe('[BQLE-Q-M-1] Cannot update $id:"jnsndadsn" because it does not exist in the DB');
        expect(error.message).toBe(
          '[BQLE-Q-M-2] Cannot update $id:"jnsndadsn" because it is not linked to $id:"tag-1"',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{S}:m1un[unlink, missing] Unlink a non existing $id', async () => {
    // solved with pre-queries in typedb, for surrealDB requires some sort of if condition
    try {
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: 'tag-1',
          users: [{ $op: 'unlink', $id: 'jnsndadsn' }],
        },
        { preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        //not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
        // expect(error.message).toBe('[BQLE-Q-M-1] Cannot unlink $id:"jnsndadsn" because it does not exist in the DB');
        expect(error.message).toBe(
          '[BQLE-Q-M-2] Cannot unlink $id:"jnsndadsn" because it is not linked to $id:"tag-1"',
        );
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{S}:m2d[delete, missing] Delete a non related $id', async () => {
    // solved with pre-queries in typedb, for surrealDB requires some sort of if condition
    try {
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: 'tag-1',
          users: [{ $op: 'delete', $id: 'user3' }],
        },
        { preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        //not sure if this one is possible with the current pre-queries, if it is not, you can throw the second error instead
        expect(error.message).toBe('[BQLE-Q-M-2] Cannot delete $id:"user3" because it is not linked to $id:"tag-1"');
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{S}:m2up[update, missing] Update a non related $id', async () => {
    // solved with pre-queries in typedb, for surrealDB requires some sort of if condition
    try {
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: 'tag-1',
          users: [{ $op: 'update', $id: 'user3', name: 'new' }],
        },
        { preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('[BQLE-Q-M-2] Cannot update $id:"user3" because it is not linked to $id:"tag-1"');
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{S}:m2un[unlink, missing] Unlink a non related $id', async () => {
    // solved with pre-queries in typedb, for surrealDB requires some sort of if condition
    try {
      await ctx.mutate(
        {
          $relation: 'UserTag',
          $id: 'tag-1',
          users: [{ $op: 'unlink', $id: 'user3' }],
        },
        { preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('[BQLE-Q-M-2] Cannot unlink $id:"user3" because it is not linked to $id:"tag-1"');
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{TS}:e-one1[update, cardinalityOne] Update multiple UserTagGroups with one tag', async () => {
    // Create two UserTagGroups
    await ctx.mutate([
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'e-one1-utg1',
        tags: ['tag-1'],
      },
      {
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'e-one1-utg2',
        tags: ['tag-2'],
      },
    ]);

    // Try to update both UserTagGroups with the same tag
    try {
      await ctx.mutate({
        $relation: 'UserTagGroup',
        $id: ['e-one1-utg1', 'e-one1-utg2'],
        $op: 'update',
        tags: ['tag-4'],
      });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('Cannot update $id:"e-one1-utg1" because it is not linked to $id:"tag-4"');
      } else {
        expect(true).toBe(false);
      }

      return;
    }
    throw new Error('Expected mutation to throw an error');
  });

  bench(
    'TODO{TS}:e-one2[update, cardinalityOne] create multiple UserTagGroups with one tag in same transaction',
    async () => {
      // Try to update both UserTagGroups with the same tag
      try {
        await ctx.mutate([
          {
            $relation: 'UserTagGroup',
            $op: 'create',
            id: 'e-one2-utg1',
            tags: ['tag-1'],
          },
          {
            $relation: 'UserTagGroup',
            $op: 'create',
            id: 'e-one2-utg2',
            tags: ['tag-1'],
          },
        ]);
      } catch (error: any) {
        if (error instanceof Error) {
          expect(error.message).toBe('Cannot update $id:"e-one1-utg1" because it is not linked to $id:"tag-4"');
        } else {
          expect(true).toBe(false);
        }
      }
      throw new Error('Expected mutation to throw an error');
    },
  );

  bench('e-v1[virtual] Cant insert virtual', async () => {
    try {
      await ctx.mutate([
        {
          $entity: 'Color',
          isBlue: false,
        },
      ]);
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('Virtual fields can\'t be sent to DB: "isBlue"');
      } else {
        expect(true).toBe(false);
      }

      return;
    }

    throw new Error('Expected mutation to throw an error');
  });

  bench('e-pq1[create, nested] With pre-query, link when there is already something error', async () => {
    /// this requires pre-queries when using typeDB because it must understand there is already something and throw an error
    /// link stuff is bypassed now, must work once we run pre-queries with link queries as well
    /// In surrealDB it should actually throw an error as user should be card ONE
    try {
      await ctx.mutate(
        {
          $entity: 'Account',
          $id: 'account3-1',
          user: {
            $op: 'link',
          },
        },
        { noMetadata: true, preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        expect(
          //todo: unify the error messages, and keep showing the path to the error as in typedb
          error.message === '[BQLE-Q-M-2] Cannot link on:"root.account3-1___user" because it is already occupied.' ||
            error.message.startsWith(
              'Error running SURQL mutation: [{"result":"An error occurred: [Validation] Cardinality constraint: user is',
            ) ||
            error.message.startsWith('The query was not executed due to a failed transaction'), // The new SurrealDB client returns a generic error message, may it just pick the first error coming from the DB
        ).toBe(true);
      } else {
        expect(true).toBe(false);
      }

      return;
    }
    throw new Error('Expected mutation to throw an error');
  });

  bench('e-c1d[create, nested delete] With pre-query, cannot delete under a create', async () => {
    try {
      await ctx.mutate(
        {
          $entity: 'Account',
          $op: 'create',
          user: {
            $op: 'delete',
          },
        },
        { noMetadata: true, preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('[Wrong format] Cannot delete under a create');
      } else {
        expect(true).toBe(false);
      }
      return;
    }
    throw new Error('Expected mutation to throw an error');
  });

  bench('e-c1ul[create, nested unlink] With pre-query, cannot unlink under a create', async () => {
    try {
      await ctx.mutate(
        {
          $entity: 'Account',
          $op: 'create',
          user: {
            $op: 'unlink',
            email: 'theNewEmailOfAnn@gmail.com',
          },
        },
        { noMetadata: true, preQuery: true },
      );
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('[Wrong format] Cannot unlink under a create');
      } else {
        expect(true).toBe(false);
      }
      return;
    }
    throw new Error('Expected mutation to throw an error');
  });

  bench('TODO{TS}:e-id1[replace, many, wrongId] Replace many by non existing field', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG1',
      tags: ['tag-1', 'tag-2'], //no color
    });
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG2',
      tags: ['tag-1', 'tag-3'],
      color: 'blue',
    });

    try {
      await ctx.mutate({
        $id: ['tmpUTG1', 'tmpUTG2'],
        $relation: 'UserTagGroup',
        $op: 'update',
        tags: ['tag-4'],
        color: 'red',
      });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('Cannot replace with non-existing id "red"');
      } else {
        expect(true).toBe(false);
      }
      return;
    }
    throw new Error('Expected mutation to throw an error');

    //clean changes by deleting the new tmpUTG
    /*await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: ['tmpUTG1', 'tmpUTG2'],
      $op: 'delete',
    });*/
  });

  bench('TODO{TS}:e-lm[link and unlink many] linking to things that do not exist', async () => {
    try {
      await ctx.mutate({
        $relation: 'Field',
        id: 'ul-many',
        kinds: [
          {
            $relation: 'Kind',
            $id: 'k1',
          },
          {
            $relation: 'Kind',
            $id: 'k2',
          },
          {
            $relation: 'Kind',
            $id: 'k3',
          },
        ],
      });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('Linking to things that do not exist');
      } else {
        expect(true).toBe(false);
      }
      return;
    }
    throw new Error('Expected mutation to throw an error');
  });

  bench("vi1[create, virtual, error] Can't set virtual fields", async () => {
    /// updating on cardinality === "ONE" must throw an error if not specifying if it's update or create as it is too ambiguous
    try {
      await ctx.mutate(
        {
          $entity: 'Account',
          id: 'newAccount',
          provider: 'gmail',
          isSecureProvider: true,
        },
        { noMetadata: true },
      );
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe('Virtual fields can\'t be sent to DB: "isSecureProvider"');
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('tid1[tempId, format]', async () => {
    /// throw an error when a tempId does not have the _: format
    try {
      await ctx.mutate(
        {
          $entity: 'Account',
          $tempId: 'wronglyFormattedTempId',
          provider: 'gmail',
        },
        { noMetadata: true },
      );
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe('[Wrong format] TempIds must start with "_:"');
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench("f1[format] Can't filter by $id when creating its parent", async () => {
    try {
      await ctx.mutate({
        $thing: 'Thing',
        $thingType: 'entity',
        id: 'temp1',
        root: {
          $id: 'tr10',
          extra: 'thing2',
        },
      });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe('[Wrong format] Cannot update under a create');
      } else {
        expect(true).toBe(false);
      }
      return;
    }
    throw new Error('Expected mutation to throw an error');
  });

  // --- Mutation: Filtered ---

  //DATAFIELDS
  bench('df1[filter with pre query] complete a mutation by filter', async () => {
    // creating
    await ctx.mutate([
      {
        $entity: 'User',
        id: 'f1-user',
        spaces: [
          {
            id: 'f1-space-1',
            dataFields: [
              {
                id: 'f1-dataField-1',
                type: 'toChange',
              },
              {
                id: 'f1-dataField-2',
                type: 'toChange',
              },
              {
                id: 'f1-dataField-3',
                type: 'toStay',
              },
              {
                id: 'f1-dataField-4',
                type: 'toStay',
              },
            ],
          },
        ],
      },
    ]);

    await ctx.mutate({
      $entity: 'User',
      $id: 'f1-user',
      spaces: [
        {
          $id: 'f1-space-1',
          dataFields: [
            {
              $op: 'update',
              type: 'afterChange',
              $filter: {
                type: 'toChange',
              },
            },
          ],
        },
      ],
    });

    const res = await ctx.query({
      $entity: 'User',
      $id: 'f1-user',
      $fields: [
        'id',
        {
          $path: 'spaces',
          $fields: [
            'id',
            {
              $path: 'dataFields',
              $fields: ['id', 'type'],
            },
          ],
        },
      ],
    });

    expect(deepSort(res, 'id')).toEqual({
      spaces: [
        {
          $id: 'f1-space-1',
          id: 'f1-space-1',
          $thing: 'Space',
          $thingType: 'entity',
          dataFields: [
            {
              $id: 'f1-dataField-1',
              $thing: 'DataField',
              $thingType: 'relation',
              type: 'afterChange',
              id: 'f1-dataField-1',
            },
            {
              $id: 'f1-dataField-2',
              $thing: 'DataField',
              $thingType: 'relation',
              id: 'f1-dataField-2',
              type: 'afterChange',
            },
            {
              $id: 'f1-dataField-3',
              $thing: 'DataField',
              $thingType: 'relation',
              type: 'toStay',
              id: 'f1-dataField-3',
            },
            {
              $id: 'f1-dataField-4',
              $thing: 'DataField',
              $thingType: 'relation',
              type: 'toStay',
              id: 'f1-dataField-4',
            },
          ],
        },
      ],
      $thing: 'User',
      $thingType: 'entity',
      $id: 'f1-user',
      id: 'f1-user',
    });

    // cleaning
    await ctx.mutate([
      {
        $entity: 'User',
        $id: 'f1-user',
        $op: 'delete',
        spaces: [
          {
            $id: 'f1-space-1',
            $op: 'delete',
            dataFields: [{ $op: 'delete' }],
          },
        ],
      },
    ]);
  });

  bench('df2[filter with pre query] complete a mutation by filter', async () => {
    // creating
    await ctx.mutate([
      {
        $entity: 'User',
        id: 'f1-user',
        spaces: [
          {
            id: 'f1-space-1',
            dataFields: [
              {
                id: 'f1-dataField-1',
                type: 'toChange-1',
              },
              {
                id: 'f1-dataField-2',
                type: 'toChange-1',
              },
              {
                id: 'f1-dataField-3',
                type: 'toChange-2',
              },
              {
                id: 'f1-dataField-4',
                type: 'toChange-2',
              },
            ],
          },
        ],
      },
    ]);

    await ctx.mutate({
      $entity: 'User',
      $id: 'f1-user',
      spaces: [
        {
          $id: 'f1-space-1',
          dataFields: [
            {
              $op: 'update',
              type: 'afterChange-1',
              $filter: {
                type: 'toChange-1',
              },
            },
            {
              $op: 'update',
              type: 'afterChange-2',
              $filter: {
                type: 'toChange-2',
              },
            },
          ],
        },
      ],
    });

    const res = await ctx.query({
      $entity: 'User',
      $id: 'f1-user',
      $fields: [
        'id',
        {
          $path: 'spaces',
          $fields: [
            'id',
            {
              $path: 'dataFields',
              $fields: ['id', 'type'],
            },
          ],
        },
      ],
    });

    expect(deepSort(res, 'id')).toEqual({
      spaces: [
        {
          $id: 'f1-space-1',
          id: 'f1-space-1',
          $thing: 'Space',
          $thingType: 'entity',
          dataFields: [
            {
              $id: 'f1-dataField-1',
              $thing: 'DataField',
              $thingType: 'relation',
              type: 'afterChange-1',
              id: 'f1-dataField-1',
            },
            {
              $id: 'f1-dataField-2',
              $thing: 'DataField',
              $thingType: 'relation',
              id: 'f1-dataField-2',
              type: 'afterChange-1',
            },
            {
              $id: 'f1-dataField-3',
              $thing: 'DataField',
              $thingType: 'relation',
              type: 'afterChange-2',
              id: 'f1-dataField-3',
            },
            {
              $id: 'f1-dataField-4',
              $thing: 'DataField',
              $thingType: 'relation',
              type: 'afterChange-2',
              id: 'f1-dataField-4',
            },
          ],
        },
      ],
      $thing: 'User',
      $thingType: 'entity',
      $id: 'f1-user',
      id: 'f1-user',
    });

    // cleaning
    await ctx.mutate([
      {
        $entity: 'User',
        $id: 'f1-user',
        $op: 'delete',
        spaces: [
          {
            $id: 'f1-space-1',
            $op: 'delete',
            dataFields: [{ $op: 'delete' }],
          },
        ],
      },
    ]);
  });

  //EDGEFIELDS
  bench('TODO{T}:rf1[filter, rolefield] filter by rolefield', async () => {
    //reset userTags
    await ctx.mutate([
      { $relation: 'UserTag', $id: 'tag-1', users: ['user1'] },
      { $relation: 'UserTag', $id: 'tag-2', users: ['user1', 'user3'] },
      { $relation: 'UserTag', $id: 'tag-3', users: ['user2'] },
      { $relation: 'UserTag', $id: 'tag-4', users: ['user2'] },
    ]);
    // the test
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $filter: {
          users: ['user2', 'user3'],
        },
        name: 'changedName-frf1',
      },
    ]);

    const allBaseTags = await ctx.query(
      {
        $relation: 'UserTag',
        $id: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
        $fields: ['id', 'name'],
      },
      { noMetadata: true },
    );

    expect(deepSort(allBaseTags, 'id')).toEqual([
      { id: 'tag-1' },
      { id: 'tag-2', name: 'changedName-frf1' },
      { id: 'tag-3', name: 'changedName-frf1' },
      { id: 'tag-4', name: 'changedName-frf1' },
    ]);

    //clean
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $op: 'update',
        name: null,
      },
    ]);
  });

  bench('TODO{T}:lf1[filter, linkfield, relation] filter by rolefield:rel', async () => {
    // reset utg1 tags
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-1',
      $op: 'update',
      tags: ['tag-1', 'tag-2'],
    });

    //The test
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $filter: {
          group: 'utg-1',
        },
        name: 'changedName-flf1',
      },
    ]);

    const allBaseTags = await ctx.query(
      {
        $relation: 'UserTag',
        $id: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
        $fields: ['id', 'name'],
      },
      { noMetadata: true },
    );

    expect(deepSort(allBaseTags, 'id')).toEqual([
      { id: 'tag-1', name: 'changedName-flf1' },
      { id: 'tag-2', name: 'changedName-flf1' },
      { id: 'tag-3' },
      { id: 'tag-4' },
    ]);

    //clean
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $op: 'update',
        name: null,
      },
    ]);
  });

  bench('df3[filter, delete] delete by filter should preserve non-matching siblings', async () => {
    // Create a space with a dataField that has two values with different types
    await ctx.mutate([
      {
        $entity: 'Space',
        id: 'df3-space',
        dataFields: [
          {
            id: 'df3-dataField',
            type: 'TEXT',
            values: [
              { id: 'df3-dv-1', type: 'toDelete' },
              { id: 'df3-dv-2', type: 'toKeep' },
            ],
          },
        ],
      },
    ]);

    // Verify both values exist
    const before = await ctx.query(
      {
        $relation: 'DataField',
        $id: 'df3-dataField',
        $fields: [
          'id',
          {
            $path: 'values',
            $fields: ['id', 'type'],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(deepSort(before, 'id')).toEqual({
      id: 'df3-dataField',
      values: [
        { id: 'df3-dv-1', type: 'toDelete' },
        { id: 'df3-dv-2', type: 'toKeep' },
      ],
    });

    // Delete only the value with type 'toDelete'
    await ctx.mutate({
      $relation: 'DataField',
      $id: 'df3-dataField',
      values: [
        {
          $op: 'delete',
          $filter: {
            type: 'toDelete',
          },
        },
      ],
    });

    // Verify that only the matching value was deleted
    const after = await ctx.query(
      {
        $relation: 'DataField',
        $id: 'df3-dataField',
        $fields: [
          'id',
          {
            $path: 'values',
            $fields: ['id', 'type'],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(after).toEqual({
      id: 'df3-dataField',
      values: [{ id: 'df3-dv-2', type: 'toKeep' }],
    });

    // Cleanup
    await ctx.mutate([
      {
        $entity: 'Space',
        $id: 'df3-space',
        $op: 'delete',
        dataFields: [
          {
            $op: 'delete',
            values: [{ $op: 'delete' }],
          },
        ],
      },
    ]);
  });

  bench('TODO{T}:lf2[filter, linkfield, role] filter by rolefield:role', async () => {
    // revert tagGroup tags
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      $op: 'update',
      tags: ['tag-3'],
      color: 'blue',
    });

    // the test
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $filter: {
          color: 'blue',
        },
        name: 'changedName-flf2',
      },
    ]);

    const allBaseTags = await ctx.query(
      {
        $relation: 'UserTag',
        $id: ['tag-1', 'tag-2', 'tag-3', 'tag-4'],
        $fields: ['id', 'name'],
      },
      { noMetadata: true },
    );

    expect(deepSort(allBaseTags, 'id')).toEqual([
      { id: 'tag-1' },
      { id: 'tag-2' },
      { id: 'tag-3', name: 'changedName-flf2' },
      { id: 'tag-4' },
    ]);

    //clean
    await ctx.mutate([
      {
        $relation: 'UserTag',
        $op: 'update',
        name: null,
      },
    ]);
  });

  // --- Mutation: PreHooks ---

  // field level

  bench('df[default, field] Default field', async () => {
    await ctx.mutate({
      $entity: 'Hook',
      id: 'hookDf1',
      requiredOption: 'b',
    });

    const res = await ctx.query(
      {
        $entity: 'Hook',
        $id: 'hookDf1',
        $fields: ['id', 'timestamp'],
      },
      { noMetadata: true },
    );

    //@ts-expect-error - TODO description
    const timestamp = new Date(res.timestamp);
    const currentTime = new Date();
    const twoMinutesAgo = new Date(currentTime.getTime() - 62 * 60 * 1000); //62 minutes ago because there is a bug that reduces -1 hours in local machine

    expect(timestamp instanceof Date).toBeTruthy();
    expect(timestamp >= twoMinutesAgo && timestamp <= currentTime).toBeTruthy();

    //cleanup
    await ctx.mutate({
      $entity: 'Hook',
      $op: 'delete',
      $id: 'hookDF11',
    });
  });

  bench('rf[required, field] Required field', async () => {
    try {
      await ctx.mutate({
        $entity: 'Hook',
        id: 'hook1',
      });

      //cleanup
      await ctx.mutate({
        $entity: 'Hook',
        $op: 'delete',
        id: 'hook1',
      });
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe('[Validations] Required field "requiredOption" is missing.');
      } else {
        expect(true).toBe(false);
      }
    }
  });

  bench('ef1[enum, field, one] Enum field cardinality one', async () => {
    try {
      await ctx.mutate({
        $entity: 'Hook',
        id: 'hook1',
        requiredOption: 'd',
      });
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe('[Validations] Option "d" is not a valid option for field "requiredOption".');
      } else {
        expect(true).toBe(false);
      }
    }
  });

  bench('ef2[enum, field, many] Enum field cardinality one', async () => {
    try {
      await ctx.mutate({
        $entity: 'Hook',
        id: 'hook1',
        requiredOption: 'c',
        manyOptions: ['a', 'd'],
      });
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe('[Validations] Option "d" is not a valid option for field "manyOptions".');
      } else {
        expect(true).toBe(false);
      }
    }
  });

  // node level

  bench('vfl1[validation, functions, local, thing] Basic', async () => {
    try {
      await ctx.mutate({
        $relation: 'Kind',
        id: 'kind1',
        name: 'Tyrannosaurus name',
        space: 'space-3',
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe('[Validations:thing:Kind] Name must not exist, or be less than 15 characters.');
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('vfl2[validation, functions, local, attribute] Function', async () => {
    try {
      await ctx.mutate({
        $entity: 'Hook',
        fnValidatedField: 'something@test.es',
        requiredOption: 'a',
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe('[Validations:attribute:fnValidatedField] Failed validation function.');
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('vfl3[validation, functions, local, attribute] FUnction with custom error', async () => {
    try {
      await ctx.mutate({
        $entity: 'Hook',
        fnValidatedField: 'secretTesthe@test.es',
        requiredOption: 'a',
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe(
          '[Validations:attribute:fnValidatedField] "secretTesthe@test.es" starts with "secretTest" and that\'s not allowed.',
        );
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('vfr1[validation, functions, remote, parent] Validate considering the parent', async () => {
    try {
      await ctx.mutate({
        $entity: 'Hook',
        id: 'hook-c0',
        requiredOption: 'a',
        asMainHookOf: {
          id: 'doesHaveheyYes',
          hooks: [
            {
              id: 'hook-c1',
              requiredOption: 'a',
            },
            { id: 'hook-c2', requiredOption: 'a' },
          ],
          mainHook: {
            id: 'hook-c3',
            requiredOption: 'a',
            asMainHookOf: {
              id: 'p-7',
              hooks: [
                {
                  id: 'hook-c4', //this one is the first one that should fail as its parent does not have 'hey'
                  requiredOption: 'a',
                },
                { id: 'hook-c5', requiredOption: 'a' },
              ],
            },
          },
        },
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe(
          '[Validations:thing:Hook] The parent of "hook-c4" does not have \'hey\' in its id ("p-7").',
        );
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('vflr2[validation, functions, remote, things] Check nested array', async () => {
    try {
      await ctx.mutate({
        $relation: 'Kind',
        id: 'kind1',
        fields: [{ name: 'forbiddenName' }],
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe("[Validations:thing:Kind] You can't have a field named 'forbiddenName'");
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('TODO{TS}:vflr3[validation, functions, nested, things] Check nested array, card ONE', async () => {
    try {
      await ctx.mutate({
        $relation: 'HookATag',
        id: 'vfla6-1-hey',
        hookTypeA: { requiredOption: 'a' },
      });
      // If the code doesn't throw an error, fail the test
      expect(true).toBe(false);
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error message is exactly what you expect
        expect(error.message).toBe("[Validations:thing:Kind] You can't have a field named 'forbiddenName'");
      } else {
        // If the error is not of type Error, fail the test
        expect(true).toBe(false);
      }
    }
  });

  bench('tn1[transform, node] Transform node depending on attribute', async () => {
    await ctx.mutate(
      [
        {
          $relation: 'Kind',
          id: 'tn1-k1',
          name: 'randomName',
          space: 'space-3',
        },
        {
          $relation: 'Kind',
          id: 'tn1-k2',
          name: 'secretName',
          space: 'space-3',
        },
      ],

      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'Kind',
        $fields: ['id', 'name'],
      },
      { noMetadata: true },
    );

    expect(deepSort(res, 'id')).toEqual([
      {
        id: 'kind-book',
        name: 'book',
      },
      {
        id: 'tn1-k1',
        name: 'randomName',
      },
      {
        id: 'tn1-k2',
        name: 'Not a secret',
      },
    ]);
  });

  bench('tn2[transform, children] Append children to node', async () => {
    try {
      await ctx.mutate(
        {
          $thing: 'User',
          id: 'tn2-u1',
          name: 'cheatCode',
        },
        { noMetadata: true },
      );

      const res = await ctx.query(
        {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'tn2-u1',
          $fields: ['id', 'name', { $path: 'spaces', $fields: ['id', 'name'] }],
        },
        { noMetadata: true },
      );

      expect(deepSort(res, 'id')).toEqual({
        id: 'tn2-u1',
        name: 'cheatCode',
        spaces: [{ id: 'secret', name: 'TheSecretSpace' }],
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'User',
        $thingType: 'entity',
        $op: 'delete',
        $id: 'tn2-u1',
      });
    }
  });

  bench('tn3[transform, inherited] Append children to node', async () => {
    try {
      await ctx.mutate(
        {
          $thing: 'Kind',
          id: 'secret-kind-tn3',
          space: 'space-1',
        },
        { noMetadata: true },
      );

      const res = await ctx.query(
        {
          $thing: 'Kind',
          $thingType: 'relation',
          $id: 'secret-kind-tn3-YES!',
        },
        { noMetadata: true },
      );
      expect(res).toEqual({
        id: 'secret-kind-tn3-YES!',
        space: 'space-1',
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'Kind',
        $thingType: 'relation',
        $op: 'delete',
        $ids: ['secret-kind-tn3', 'secret-kind-tn3-YES!'],
      });
    }
  });

  bench('tt1[transform, temp props] Transform using %vars', async () => {
    try {
      await ctx.mutate(
        {
          $thing: 'User',
          id: 'tt1-u1',
          '%name': 'Sinatra',
        },
        { noMetadata: true },
      );

      const res = await ctx.query(
        {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'tt1-u1',
        },
        { noMetadata: true },
      );
      expect(res).toEqual({
        id: 'tt1-u1',
        name: 'secret-Sinatra',
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'tt1-u1',
        $op: 'delete',
      });
    }
  });

  bench('tt2[transform, temp props] Transform using %vars', async () => {
    try {
      await ctx.mutate(
        {
          $thing: 'User',
          id: 'tt2-u1',
          '%modifier': { name: 'White' },
          name: 'Barry',
        },
        { noMetadata: true },
      );

      const res = await ctx.query(
        {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'tt2-u1',
        },
        { noMetadata: true },
      );
      expect(res).toEqual({
        id: 'tt2-u1',
        name: 'White',
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'tt2-u1',
        $op: 'delete',
      });
    }
  });

  bench('ctx1[transform, context] Use context', async () => {
    try {
      await ctx.mutate(
        {
          $thing: 'User',
          id: 'ctx1-u1',
          name: 'cheatCode2',
        },
        { noMetadata: true, context: { spaceId: 'mySpace' } },
      );

      const res = await ctx.query(
        {
          $thing: 'User',
          $thingType: 'entity',
          $id: 'ctx1-u1',
          $fields: ['id', 'name', { $path: 'spaces', $fields: ['id', 'name'] }],
        },
        { noMetadata: true },
      );

      expect(deepSort(res, 'id')).toEqual({
        id: 'ctx1-u1',
        name: 'cheatCode2',
        spaces: [{ id: 'mySpace' }],
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'User',
        $thingType: 'entity',
        $op: 'delete',
        $id: 'tn2-u1',
      });
    }
  });

  bench('TODO{S}:tf1[transform, fields] Use $fields for dbNode', async () => {
    try {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'mf1-user',
          name: 'John',
          email: 'john@email.com',
          spaces: [
            {
              id: 'mf1-space',
              dataFields: [
                {
                  id: 'mf1-dataField-1',
                  values: [
                    {
                      id: 'mf1-dataValue',
                    },
                  ],
                  expression: { $op: 'create', id: 'mf1-expression-1' },
                },
                {
                  id: 'mf1-dataField-2',
                  values: [{ id: 'mf1-dataValue-2' }],
                },
                {
                  id: 'mf1-dataField-3',
                  expression: { $op: 'create', id: 'mf1-expression-2' },
                },
                {
                  id: 'mf1-dataField-4',
                },
              ],
            },
          ],
        },
      ]);

      /// This test throws an error if failed, it happens inside the transformation itself
      await ctx.mutate({
        $thing: 'User',
        $id: 'mf1-user',
        name: 'Jack',
        $fields: ['email', { $path: 'spaces', $fields: [{ $path: 'dataFields', $fields: ['values', 'expression'] }] }],
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'User',
        $thingType: 'entity',
        $op: 'delete',
        $id: 'mf1-user',
      });
    }
  });

  bench('TODO{S}:tf2[transform, fields] Use $fields for dbNode nested', async () => {
    try {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'mf2-user',
          name: 'John',
          email: 'john@email.com',
          spaces: [
            {
              id: 'mf2-space',
              dataFields: [
                {
                  id: 'mf2-dataField-1',
                  values: [
                    {
                      id: 'mf2-dataValue-1',
                    },
                  ],
                  expression: { $op: 'create', id: 'mf2-expression-1' },
                },
                {
                  id: 'mf2-dataField-2',
                  values: [{ id: 'mf2-dataValue-2' }],
                },
                {
                  id: 'mf2-dataField-3',
                  expression: { $op: 'create', id: 'mf2-expression-2' },
                },
                {
                  id: 'mf2-dataField-4',
                },
              ],
            },
          ],
        },
      ]);

      await ctx.mutate({
        $thing: 'User',
        $id: 'mf2-user',
        name: 'Jack',
        spaces: [
          {
            dataFields: [
              {
                values: [{ $fields: ['id', 'type'], type: 'test-type', $op: 'update' }],
                expression: { $fields: ['id', 'type'], type: 'test-type', $op: 'update' },
                $fields: ['values', 'expression'],
                type: 'test-type',
                $op: 'update',
              },
            ],
            $fields: ['id', 'dataFields'],
            $op: 'update',
          },
        ],
        $fields: ['id', 'email'],
      });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'User',
        $thingType: 'entity',
        $op: 'delete',
        $id: 'mf2-user',
      });
    }
  });

  bench('TODO{S}:tf3[transform, fields] Use $fields for transformation', async () => {
    try {
      await ctx.mutate([
        {
          $thing: 'Color',
          $fields: ['id', 'value'],
          id: 'color-test',
          value: 'gold',
        },
      ]);

      const res1 = await ctx.query(
        {
          $thing: 'Color',
          $thingType: 'entity',
          $id: 'color-test',
          $fields: ['id', 'value'],
        },
        { noMetadata: true },
      );

      expect(res1).toEqual({
        id: 'color-test',
        value: 'gold',
      });

      await ctx.mutate([
        {
          $thing: 'Color',
          $fields: ['id', 'value'],
          $id: 'color-test',
          value: 'gold',
        },
      ]);

      const res2 = await ctx.query(
        {
          $thing: 'Color',
          $thingType: 'entity',
          $id: 'color-test',
          $fields: ['id', 'value'],
        },
        { noMetadata: true },
      );

      expect(res2).toEqual({
        id: 'color-test',
        value: 'bronze',
      });

      // await bormClient.mutate({
      // 	$thing: 'User',
      // 	$id: 'mf1-user',
      // 	name: 'Jack',
      // 	$fields: ['email', { $path: 'spaces', $fields: [{ $path: 'dataFields', $fields: ['values', 'expression'] }] }],
      // });
    } finally {
      //clean
      await ctx.mutate({
        $thing: 'Color',
        $thingType: 'entity',
        $id: 'gold',
        $op: 'delete',
      });
    }
  });

  bench('TODO{TS}:tf4[transform, fields] Use $fields for nested transformations with same types', async () => {
    // this test should pass when we add more protections over nested $ids not being the same as parent $ids in a mutation
    try {
      await ctx.mutate([
        {
          $relation: 'CascadeRelation',
          id: 'cr-1',
          things: [
            {
              id: 't-1',
              cascadeRelations: [
                {
                  id: 'cr-2',
                  things: [
                    {
                      id: 't-3',
                    },
                    {
                      id: 't-4',
                    },
                  ],
                },
                {
                  id: 'cr-3',
                  things: [
                    {
                      id: 't-5',
                    },
                    {
                      id: 't-6',
                    },
                  ],
                },
              ],
            },
            {
              id: 't-2',
              cascadeRelations: [
                {
                  id: 'cr-4',
                  things: [
                    {
                      id: 't-7',
                    },
                    {
                      id: 't-8',
                    },
                  ],
                },
                {
                  id: 'cr-5',
                  things: [
                    {
                      id: 't-9',
                    },
                    {
                      id: 't-10',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);

      const q1 = await ctx.query({
        $thing: 'CascadeRelation',
        $thingType: 'relation',
        $id: 'cr-1',
        $fields: ['things'],
      });

      const q2 = await ctx.query(
        {
          $thing: 'CascadeThing',
          $thingType: 'entity',
          $fields: ['id'],
        },
        { noMetadata: true },
      );

      expect(deepSort(q1, 'id')).toEqual({
        things: ['t-1', 't-2'],
        $thing: 'CascadeRelation',
        $thingType: 'relation',
        $id: 'cr-1',
      });

      expect(deepSort(q2, 'id')).toEqual([
        {
          id: 't-1',
        },
        {
          id: 't-10',
        },
        {
          id: 't-2',
        },
        {
          id: 't-3',
        },
        {
          id: 't-4',
        },
        {
          id: 't-5',
        },
        {
          id: 't-6',
        },
        {
          id: 't-7',
        },
        {
          id: 't-8',
        },
        {
          id: 't-9',
        },
      ]);

      await ctx.mutate({
        $thing: 'CascadeRelation',
        $id: 'cr-1',
        $op: 'delete',
        $fields: ['things'],
      });

      const q3 = await ctx.query({
        $thing: 'CascadeRelation',
        $thingType: 'relation',
        $id: 'cr-1',
        $fields: ['things'],
      });

      const q4 = await ctx.query({
        $thing: 'CascadeThing',
        $thingType: 'entity',
      });

      expect(q3).toEqual(null);
      expect(q4).toEqual(null);
    } finally {
      // //clean
      // await bormClient.mutate({
      // 	$thing: 'User',
      // 	$thingType: 'entity',
      // 	$op: 'delete',
      // 	$id: 'mf2-user',
      // });
    }
  });

  bench('TODO{S}:tf5[transform, fields] Use $fields nested looping through transformations', async () => {
    try {
      await ctx.mutate([
        {
          $entity: 'User',
          id: 'mf5-user',
          name: 'John',
          email: 'john@email.com',
          spaces: [
            {
              id: 'mf5-space',
              dataFields: [
                {
                  id: 'mf5-dataField-1',
                },
                {
                  id: 'mf5-dataField-2',
                },
                {
                  id: 'mf5-dataField-3',
                },
                {
                  id: 'mf5-dataField-4',
                },
              ],
            },
          ],
        },
      ]);

      // cascade delete

      await ctx.mutate([
        {
          $entity: 'User',
          $id: 'mf5-user',
          $op: 'delete',
          $fields: ['spaces'],
        },
      ]);

      await ctx.query([
        {
          $entity: 'User',
          $id: 'mf5-user',
        },
      ]);

      const res = await ctx.query([
        {
          $entity: 'User',
          $id: 'mf5-user',
        },
        {
          $entity: 'Space',
          $id: 'mf5-space',
        },
        {
          $relation: 'DataField',
          $id: ['mf5-dataField-1', 'mf5-dataField-4', 'mf5-dataField-3', 'mf5-dataField-4'],
        },
      ]);

      expect(res).toEqual([null, null, null]);
    } finally {
      // //clean
      // await bormClient.mutate({
      // 	$thing: 'User',
      // 	$thingType: 'entity',
      // 	$op: 'delete',
      // 	$id: 'mf2-user',
      // });
    }
  });

  bench('tf6', async () => {
    await ctx.mutate([
      {
        $entity: 'User',
        id: 'mf6-user',
        name: 'John',
        email: 'john@email.com',
        spaces: [
          {
            id: 'mf6-space',
            name: 'My space',
            dataFields: [
              {
                id: 'mf6-dataField-1',
                type: 'TEXT',
                computeType: 'COMPUTED',
              },
              {
                id: 'mf6-dataField-2',
                type: 'EMAIL',
                computeType: 'EDITABLE',
              },
            ],
          },
        ],
      },
    ]);

    await ctx.mutate([
      {
        $op: 'update',
        $entity: 'User',
        $id: ['mf6-user'],
        $fields: ['spaces', 'email', { $path: 'spaces', $fields: ['name'] }],
        email: 'jhon@gmail.com',
        spaces: [
          {
            $op: 'update',
            // $id: 'mf6-space',
            $fields: ['dataFields', 'name'],
            name: 'Our space',
            dataFields: [
              {
                $op: 'update',
                $id: ['mf6-dataField-1', 'mf6-dataField-2'],
                $fields: ['type'],
                type: 'NUMBER',
              },
              // {
              // 	$op: 'update',
              // 	$id: 'mf6-dataField-2',
              // 	$fields: ['computeType'],
              // 	type: 'NUMBER',
              // },
            ],
          },
        ],
      },
    ]);
  });

  // --- Mutation: Replaces ---

  bench('r1[replace] replace single roles in relation', async () => {
    // cardinality one
    await ctx.mutate(
      {
        $relation: 'ThingRelation',
        $id: 'tr2',
        root: 'thing4',
      },
      { preQuery: true },
    );

    // cardinality many
    await ctx.mutate(
      {
        $relation: 'ThingRelation',
        $id: 'tr2',
        things: ['thing4'],
      },
      { preQuery: true },
    );
    const queryRes = await ctx.query(
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

  bench('r2[replace] replace many roles in relation', async () => {
    await ctx.mutate(
      {
        $relation: 'ThingRelation',
        $id: 'tr3',
        root: 'thing4',
        things: ['thing4'],
      },
      { preQuery: true },
    );

    const queryRes = await ctx.query(
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

  bench('r3[replace] replace many roles in many relation', async () => {
    await ctx.mutate([
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

    const queryRes = await ctx.query(
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

  bench('r4[replace] replace depth test', async () => {
    await ctx.mutate({
      $entity: 'User',
      $id: 'user3',
      'user-tags': [
        {
          $id: 'tag-2',
          users: ['user3', 'user5'],
        },
      ],
    });
    const queryRes = await ctx.query({
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
    await ctx.mutate({
      $entity: 'User',
      $id: 'user3',
      'user-tags': [
        {
          $id: 'tag-2',
          users: ['user3', 'user1'],
        },
      ],
    });
  });

  bench('r5a[replace, unlink, link, many] Replace using unlink + link single role, by IDs', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG',
      tags: ['tag-1', 'tag-2'],
    });

    /// the mutation to be tested
    await ctx.mutate({
      $id: 'tmpUTG',
      $relation: 'UserTagGroup',
      tags: [
        { $op: 'link', $id: 'tag-3' },
        { $op: 'unlink', $id: 'tag-1' },
      ],
    });

    const tmpUTG = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $fields: ['tags'],
    });

    expect(deepSort(tmpUTG)).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG',
      tags: ['tag-2', 'tag-3'],
    });

    //clean changes by deleting the new tmpUTG
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $op: 'delete',
    });
  });

  bench('r5b[replace, unlink, link, many] Replace using unlink + link single role, by IDs. MultiIds', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG',
      tags: ['tag-1', 'tag-2', 'tag-3'],
    });

    /// the mutation to be tested
    await ctx.mutate({
      $id: 'tmpUTG',
      $relation: 'UserTagGroup',
      tags: [
        { $op: 'link', $id: 'tag-4' },
        { $op: 'unlink', $id: ['tag-1', 'tag-2'] },
      ],
    });

    const tmpUTG = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $fields: ['tags'],
    });

    expect(deepSort(tmpUTG)).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG',
      tags: ['tag-3', 'tag-4'],
    });

    //clean changes by deleting the new tmpUTG
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $op: 'delete',
    });
  });

  bench('r6a[replace, unlink, link, many] Replace using unlink + link , all unlink', async () => {
    /// create
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'tmpUTG',
      tags: ['tag-1', 'tag-2'],
      color: 'blue',
    });

    /// the mutation to be tested
    await ctx.mutate({
      $id: 'tmpUTG',
      $relation: 'UserTagGroup',
      tags: [{ $op: 'link', $id: ['tag-4', 'tag-3'] }, { $op: 'unlink' }],
    });

    const tmpUTG = await ctx.query({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $fields: ['tags'],
    });

    expect(deepSort(tmpUTG)).toEqual({
      $thing: 'UserTagGroup',
      $thingType: 'relation',
      $id: 'tmpUTG',
      tags: ['tag-3', 'tag-4'],
    });

    //clean changes by deleting the new tmpUTG
    await ctx.mutate({
      $relation: 'UserTagGroup',
      $id: 'tmpUTG',
      $op: 'delete',
    });
  });

  bench('TODO{TS}:ri1-d[ignore ids pre-query delete] delete something that does not exist', async () => {
    await ctx.mutate(
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

    const queryRes = await ctx.query(
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

  bench('TODO{TS}:ri1-ul[ignore ids pre-query unlink] unlink something that does not exist', async () => {
    await ctx.mutate(
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

    const queryRes = await ctx.query(
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

  bench('TODO{TS}:ri1-up[ignore ids pre-query update] update something that does not exist', async () => {
    await ctx.mutate(
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

    const queryRes = await ctx.query(
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

  // --- Mutation: JSON Refs ---

  bench('j1[json-refs] Single reference in JSON field', async () => {
    await ctx.mutate(
      {
        $thing: 'Company',
        id: 'jr-co1',
        name: 'TestCo',
        industry: 'Tech',
      },
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $thing: 'Account',
        id: 'jr-acc1',
        profile: { company: { $ref: 'Company:jr-co1' } },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'Account',
        $id: 'jr-acc1',
        $fields: ['id', 'profile'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      { $thing: 'Account', $op: 'delete', $id: 'jr-acc1' },
      { $thing: 'Company', $op: 'delete', $id: 'jr-co1' },
    ]);

    expect(res).toEqual({
      id: 'jr-acc1',
      profile: { company: 'jr-co1' },
    });
  });

  bench('j2[json-refs] Array of references in JSON field', async () => {
    await ctx.mutate(
      [
        { $thing: 'User', id: 'jr-u1', name: 'JR User 1' },
        { $thing: 'User', id: 'jr-u2', name: 'JR User 2' },
      ],
      { noMetadata: true },
    );

    await ctx.mutate(
      {
        $thing: 'Account',
        id: 'jr-acc2',
        profile: { team: [{ $ref: 'User:jr-u1' }, { $ref: 'User:jr-u2' }] },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'Account',
        $id: 'jr-acc2',
        $fields: ['id', 'profile'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      { $thing: 'Account', $op: 'delete', $id: 'jr-acc2' },
      { $thing: 'User', $op: 'delete', $id: 'jr-u1' },
      { $thing: 'User', $op: 'delete', $id: 'jr-u2' },
    ]);

    expect(res).toEqual({
      id: 'jr-acc2',
      profile: { team: ['jr-u1', 'jr-u2'] },
    });
  });

  bench('j3[json-refs] Mixed references and plain data in an array', async () => {
    await ctx.mutate({ $thing: 'Space', id: 'jr-sp1', name: 'JR Space' }, { noMetadata: true });

    await ctx.mutate(
      {
        $thing: 'Account',
        id: 'jr-acc3',
        profile: {
          mixed: ['Hello', { $ref: 'Space:jr-sp1' }],
        },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'Account',
        $id: 'jr-acc3',
        $fields: ['id', 'profile'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      { $thing: 'Account', $op: 'delete', $id: 'jr-acc3' },
      { $thing: 'Space', $op: 'delete', $id: 'jr-sp1' },
    ]);

    expect(res).toEqual({
      id: 'jr-acc3',
      profile: { mixed: ['Hello', 'jr-sp1'] },
    });
  });

  // --- Mutation: RefFields ---

  // 1. Entities

  bench('TODO{T}:fl1[ref, ent, one] Create entity with flexible values and read it', async () => {
    /// cardinality ONE
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        id: 'fl1-flexRef',
        reference: { $thing: 'User', $op: 'create', id: 'fl1-user', email: 'f1user@test.it' },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl1-flexRef',
        $fields: ['id', 'reference'],
      },
      { noMetadata: true },
    );

    //clean up
    await ctx.mutate([
      {
        $id: 'fl1-flexRef',
        $entity: 'FlexRef',
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'fl1-flexRef',
      reference: 'fl1-user',
    });
  });

  // 1.1 REF

  bench('TODO{T}:fl1r[ref, ent, one, replace]', async () => {
    // Create initial entity with reference
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        id: 'fl1r-flexRef',
        reference: { $thing: 'User', $op: 'create', id: 'fl1r-user1', email: 'fl1ruser1@test.it' },
      },
      { noMetadata: true },
    );

    // Replace reference with new user
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        $id: 'fl1r-flexRef',
        reference: { $thing: 'User', $op: 'create', id: 'fl1r-user2', email: 'fl1ruser2@test.it' },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl1r-flexRef',
        $fields: ['id', 'reference'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      {
        $id: 'fl1r-flexRef',
        $entity: 'FlexRef',
        $op: 'delete',
      },
      {
        $id: ['fl1r-user1', 'fl1r-user2'],
        $entity: 'User',
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'fl1r-flexRef',
      reference: 'fl1r-user2',
    });
  });

  bench('TODO{T}:fl2[ref, many] Test MANY cardinality with REF type', async () => {
    // Create a FlexRef with multiple references
    await ctx.mutate(
      {
        $thing: 'FlexRef',
        id: 'fl2-ref1',
        references: [
          { $thing: 'User', id: 'fl2-u1', name: 'User 1' },
          { $thing: 'User', id: 'fl2-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );

    // Query to verify the references
    const res = await ctx.query({
      $entity: 'FlexRef',
      $id: 'fl2-ref1',
      $fields: ['id', 'references'],
    });

    // Clean up
    await ctx.mutate([
      {
        $thing: 'FlexRef',
        $op: 'delete',
        $id: 'fl2-ref1',
      },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['fl2-u1', 'fl2-u2'],
      },
    ]);

    expect(res).toMatchObject({
      id: 'fl2-ref1',
      references: ['fl2-u1', 'fl2-u2'],
    });
  });

  bench('TODO{TS}:fl2add[ref, many, add] Add to existing', async () => {
    // Create initial entity with references
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        id: 'fl2add-ref1',
        references: [{ $thing: 'User', id: 'fl2add-u1', name: 'User 1' }],
      },
      { noMetadata: true },
    );

    // Add new reference
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        $id: 'fl2add-ref1',
        references: [{ $thing: 'User', id: 'fl2add-u2', name: 'User 2', $op: 'link' }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl2add-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $entity: 'FlexRef',
        $op: 'delete',
        $id: 'fl2add-ref1',
      },
    ]);

    expect(res).toBeDefined();
    expect(deepSort(res.references)).toEqual(['fl2add-u1', 'fl2add-u2']);
  });

  bench('TODO{TS}:fl2rem[ref, many, remove] Remove existing', async () => {
    // Create initial entity with references
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        id: 'fl2rem-ref1',
        references: [
          { $thing: 'User', id: 'fl2rem-u1', name: 'User 1' },
          { $thing: 'User', id: 'fl2rem-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );

    // Remove one reference
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        $id: 'fl2rem-ref1',
        references: [{ $op: 'unlink', $id: 'fl2rem-u1' }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl2rem-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $entity: 'FlexRef',
        $op: 'delete',
        $id: 'fl2rem-ref1',
      },
    ]);

    expect(res.references).toEqual(['fl2rem-u2']);
  });

  bench('TODO{TS}:fl2rem2[ref, many, remove, all] Remove all', async () => {
    // Create initial entity with references
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        id: 'fl2rem-ref1',
        references: [
          { $thing: 'User', id: 'fl2rem-u1', name: 'User 1' },
          { $thing: 'User', id: 'fl2rem-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );

    // Remove one reference
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        $id: 'fl2rem-ref1',
        references: null,
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl2rem-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $entity: 'FlexRef',
        $op: 'delete',
        $id: 'fl2rem-ref1',
      },
    ]);

    expect(res.references).toBeUndefined();
  });

  bench('TODO{T}:fl2rep[ref, many, replace] Replace existing', async () => {
    // Create initial entity with references
    await ctx.mutate(
      {
        $entity: 'FlexRef',
        id: 'fl2rep-ref1',
        references: [
          { $thing: 'User', id: 'fl2rep-u1', name: 'User 1' },
          { $thing: 'User', id: 'fl2rep-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );

    // Replace all references
    await ctx.mutate(
      [
        {
          $entity: 'FlexRef',
          $id: 'fl2rep-ref1',
          references: [
            { $op: 'create', $thing: 'User', id: 'fl2rep-u3' }, //todo: find a cleaner way to do this
            { $op: 'create', $thing: 'User', id: 'fl2rep-u4' },
          ],
        },
      ],

      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl2rep-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $entity: 'FlexRef',
        $op: 'delete',
        $id: 'fl2rep-ref1',
      },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['fl2rep-u1', 'fl2rep-u2', 'fl2rep-u3', 'fl2rep-u4'],
      },
    ]);

    expect(res).toBeDefined();
    expect(deepSort(res.references)).toEqual(['fl2rep-u3', 'fl2rep-u4']);
  });

  bench('TODO{T}:fl2repShort[ref, many, replace, prefix] Replace existing using prefix', async () => {
    // Create initial entity with references
    await ctx.mutate(
      [
        {
          $entity: 'FlexRef',
          id: 'fl2repShort-ref1',
          references: [
            { $thing: 'User', id: 'fl2repShort-u1', name: 'User 1' },
            { $thing: 'User', id: 'fl2repShort-u2', name: 'User 2' },
          ],
        },
        { $op: 'create', $thing: 'User', id: 'fl2repShort-u3' }, //todo: find a cleaner way to do this
        { $op: 'create', $thing: 'User', id: 'fl2repShort-u4' },
      ],
      { noMetadata: true },
    );

    // Replace all references
    await ctx.mutate(
      [
        {
          $entity: 'FlexRef',
          $id: 'fl2repShort-ref1',
          references: ['User:fl2repShort-u3', 'User:fl2repShort-u4'],
        },
      ],

      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl2repShort-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $entity: 'FlexRef',
        $op: 'delete',
        $id: 'fl2repShort-ref1',
      },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['fl2repShort-u1', 'fl2repShort-u2', 'fl2repShort-u3', 'fl2repShort-u4'],
      },
    ]);

    expect(res).toBeDefined();
    expect(deepSort(res.references)).toEqual(['fl2repShort-u3', 'fl2repShort-u4']);
  });

  // 1.2 FLEX

  bench('TODO{T}:fl3[ref, flex, one] Test ONE cardinality with FLEX type', async () => {
    // Test with reference
    await ctx.mutate(
      [
        {
          $thing: 'FlexRef',
          id: 'fl3-ref1',
          flexReference: 7,
        },
        {
          $thing: 'FlexRef',
          id: 'fl3-ref2',
          flexReference: 'jey',
        },
        {
          $thing: 'FlexRef',
          id: 'fl3-ref3',
          flexReference: { $thing: 'User', id: 'fl3-u1', name: 'User 1' },
        },
      ],
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: ['fl3-ref1', 'fl3-ref2', 'fl3-ref3'],
        $fields: ['id', 'flexReference'],
      },
      { noMetadata: true },
    );

    //clean before in case of failuer
    await ctx.mutate([
      {
        $thing: 'FlexRef',
        $op: 'delete',
        $id: ['fl3-ref1', 'fl3-ref2', 'fl3-ref3'],
      },
    ]);

    //Run the test
    expect(deepSort(res, 'id')).toEqual([
      {
        id: 'fl3-ref1',
        flexReference: 7,
      },
      {
        id: 'fl3-ref2',
        flexReference: 'jey',
      },
      {
        id: 'fl3-ref3',
        flexReference: 'fl3-u1',
      },
    ]);
  });

  bench('TODO{T}:fl4[ref, flex, many] Test MANY cardinality with FLEX type', async () => {
    // Create with mix of references and data
    await ctx.mutate(
      {
        $thing: 'FlexRef',
        id: 'fl4-ref1',
        flexReferences: [
          'hey',
          { $thing: 'User', id: 'fl4-u1', name: 'User 1' },
          8,
          { $thing: 'User', id: 'fl4-u2', name: 'User 2' },
          new Date('2024-01-01'),
        ],
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl4-ref1',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    //clean before in case of failure
    await ctx.mutate([
      {
        $thing: 'FlexRef',
        $op: 'delete',
        $id: 'fl4-ref1',
      },
    ]);

    //Run the test
    expect(res).toEqual({
      id: 'fl4-ref1',
      flexReferences: ['hey', 'fl4-u1', 8, 'fl4-u2', new Date('2024-01-01')],
    });
  });

  bench('fl5:[ref, data] Should not parse number in string format as date in refField', async () => {
    await ctx.mutate(
      {
        $thing: 'FlexRef',
        id: 'fl5-refField-string-number',
        flexReference: '8',
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl5-refField-string-number',
        $fields: ['id', 'flexReference'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate(
      {
        $thing: 'FlexRef',
        $op: 'delete',
        $id: 'fl5-refField-string-number',
      },
      { noMetadata: true },
    );

    expect(res).toEqual({
      id: 'fl5-refField-string-number',
      flexReference: '8',
    });
  });

  bench('fl6:[ref, data, weirdFormat] Should accept strings with weird formats as string', async () => {
    await ctx.mutate(
      {
        $thing: 'FlexRef',
        id: 'fl6-refField-weirdFormat',
        flexReferences: [1, '}) * 100'],
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $entity: 'FlexRef',
        $id: 'fl6-refField-weirdFormat',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    //clean up
    await ctx.mutate({
      $thing: 'FlexRef',
      $op: 'delete',
      $id: 'fl6-refField-weirdFormat',
    });

    expect(res).toEqual({
      id: 'fl6-refField-weirdFormat',
      flexReferences: [1, '}) * 100'],
    });
  });

  // 2.Relations
  // 2.1 REF

  bench('TODO{T}:flr1[ref, one, rel] Create relation with flexible values and read it', async () => {
    /// cardinality ONE
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr1-flexRefRel',
        reference: { $thing: 'User', $op: 'create', id: 'flr1-user', email: 'flr1user@test.it' },
        space: { id: 'flr1-space', name: 'flr1-space' },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr1-flexRefRel',
        $fields: ['id', 'reference'],
      },
      { noMetadata: true },
    );

    //clean up
    await ctx.mutate([
      {
        $id: 'flr1-flexRefRel',
        $relation: 'FlexRefRel',
        space: { $op: 'delete' },
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'flr1-flexRefRel',
      reference: 'flr1-user',
    });
  });

  bench('TODO{T}:flr1r[ref, one, replace] Replace existing relation reference', async () => {
    // Create initial relation with reference
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr1r-flexRefRel',
        reference: { $thing: 'User', $op: 'create', id: 'flr1r-user1', email: 'flr1ruser1@test.it' },
        space: { id: 'flr1r-space', name: 'flr1r-space' },
      },
      { noMetadata: true },
    );

    // Replace reference with new user
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'flr1r-flexRefRel',
        reference: { $thing: 'User', $op: 'create', id: 'flr1r-user2', email: 'flr1ruser2@test.it' },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr1r-flexRefRel',
        $fields: ['id', 'reference'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      {
        $id: 'flr1r-flexRefRel',
        $relation: 'FlexRefRel',
        space: { $op: 'delete' },
        $op: 'delete',
      },
      {
        $id: ['flr1r-user1', 'flr1r-user2'],
        $entity: 'User',
        $op: 'delete',
      },
    ]);

    expect(res).toEqual({
      id: 'flr1r-flexRefRel',
      reference: 'flr1r-user2',
    });
  });

  bench('TODO{T}:flr2[ref, many] Test MANY cardinality with REF type in relations', async () => {
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr2-ref1',
        references: [
          { $thing: 'User', id: 'flr2-u1', name: 'User 1' },
          { $thing: 'User', id: 'flr2-u2', name: 'User 2' },
        ],
        space: { id: 'flr2-space', name: 'flr2-space' },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'flr2-ref1',
        space: { $op: 'delete' },
      },
    ]);

    expect(res).toMatchObject({
      id: 'flr2-ref1',
      references: ['flr2-u1', 'flr2-u2'],
    });
  });

  bench('TODO{TS}:flr2add[ref, many, add] Add to existing relation references', async () => {
    // Create initial relation with references
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr2add-ref1',
        references: [{ $thing: 'User', id: 'flr2add-u1', name: 'User 1' }],
        space: { id: 'flr2add-space', name: 'flr2add-space' },
      },
      { noMetadata: true },
    );

    // Add new reference
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2add-ref1',
        references: [{ $thing: 'User', id: 'flr2add-u2', name: 'User 2', $op: 'link' }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2add-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'flr2add-ref1',
        space: { $op: 'delete' },
      },
    ]);
    expect(res).toBeDefined();
    expect(deepSort(res.references)).toEqual(['flr2add-u1', 'flr2add-u2']);
  });

  bench('TODO{TS}:flr2rem[ref, many, remove] Remove existing relation reference', async () => {
    // Create initial relation with references
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr2rem-ref1',
        references: [
          { $thing: 'User', id: 'flr2rem-u1', name: 'User 1' },
          { $thing: 'User', id: 'flr2rem-u2', name: 'User 2' },
        ],
        space: { id: 'flr2rem-space', name: 'flr2rem-space' },
      },
      { noMetadata: true },
    );

    // Remove one reference
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2rem-ref1',
        references: [{ $op: 'unlink', $id: 'flr2rem-u1' }],
      },
      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2rem-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'flr2rem-ref1',
        space: { $op: 'delete' },
      },
    ]);

    expect(res.references).toEqual(['flr2rem-u2']);
  });

  bench('TODO{T}:flr2rep[ref, many, replace] Replace existing relation references', async () => {
    // Create initial relation with references
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr2rep-ref1',
        references: [
          { $thing: 'User', id: 'flr2rep-u1', name: 'User 1' },
          { $thing: 'User', id: 'flr2rep-u2', name: 'User 2' },
        ],
        space: { id: 'flr2rep-space', name: 'flr2rep-space' },
      },
      { noMetadata: true },
    );

    // Replace all references
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2rep-ref1',
        references: [
          { $thing: 'User', id: 'flr2rep-u3', name: 'User 3' },
          { $thing: 'User', id: 'flr2rep-u4', name: 'User 4' },
        ],
      },

      { noMetadata: true },
    );

    const res = (await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr2rep-ref1',
        $fields: ['id', 'references'],
      },
      { noMetadata: true },
    )) as BQLResponseSingle;

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'flr2rep-ref1',
        space: { $op: 'delete' },
      },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['flr2rep-u3', 'flr2rep-u4', 'flr2rep-u1', 'flr2rep-u2'],
      },
    ]);

    expect(res).toBeDefined();
    expect(deepSort(res.references)).toEqual(['flr2rep-u3', 'flr2rep-u4']);
  });

  bench(
    'TODO{T}:flr2repShort[ref, many, replace, prefix] Replace existing relation references with prefixes',
    async () => {
      // Create initial relation with references
      await ctx.mutate(
        [
          {
            $relation: 'FlexRefRel',
            id: 'flr2repShort-ref1',
            references: [
              { $thing: 'User', id: 'flr2repShort-u1', name: 'User 1' },
              { $thing: 'User', id: 'flr2repShort-u2', name: 'User 2' },
            ],
            space: { id: 'flr2rep-space', name: 'flr2rep-space' },
          },
          { $thing: 'User', id: 'flr2repShort-u3', name: 'User 3' },
          { $thing: 'User', id: 'flr2repShort-u4', name: 'User 4' },
        ],

        { noMetadata: true },
      );
      // Replace all references
      await ctx.mutate(
        {
          $relation: 'FlexRefRel',
          $id: 'flr2repShort-ref1',
          references: ['User:flr2repShort-u3', 'User:flr2repShort-u4'],
        },

        { noMetadata: true },
      );

      const res = (await ctx.query(
        {
          $relation: 'FlexRefRel',
          $id: 'flr2repShort-ref1',
          $fields: ['id', 'references'],
        },
        { noMetadata: true },
      )) as BQLResponseSingle;

      // Clean up
      await ctx.mutate([
        {
          $relation: 'FlexRefRel',
          $op: 'delete',
          $id: 'flr2repShort-ref1',
          space: { $op: 'delete' },
        },
        {
          $entity: 'User',
          $op: 'delete',
          $id: ['flr2repShort-u3', 'flr2repShort-u4', 'flr2repShort-u1', 'flr2repShort-u2'],
        },
      ]);

      expect(res).toBeDefined();
      expect(deepSort(res.references)).toEqual(['flr2repShort-u3', 'flr2repShort-u4']);
    },
  );

  // 2.2 FLEX

  bench('TODO{T}:flr3[ref, flex, one] Test ONE cardinality with FLEX type in relations', async () => {
    // Test with different types of references
    await ctx.mutate(
      [
        {
          $relation: 'FlexRefRel',
          id: 'flr3-ref1',
          flexReference: 7,
          space: { id: 'flr3-space1', name: 'flr3-space1' },
        },
        {
          $relation: 'FlexRefRel',
          id: 'flr3-ref2',
          flexReference: 'jey',
          space: { id: 'flr3-space2', name: 'flr3-space2' },
        },
        {
          $relation: 'FlexRefRel',
          id: 'flr3-ref3',
          flexReference: { $thing: 'User', id: 'flr3-u1', name: 'User 1' },
          space: { id: 'flr3-space3', name: 'flr3-space3' },
        },
      ],
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: ['flr3-ref1', 'flr3-ref2', 'flr3-ref3'],
        $fields: ['id', 'flexReference'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: ['flr3-ref1', 'flr3-ref2', 'flr3-ref3'],
        space: { $op: 'delete' },
      },
    ]);

    expect(deepSort(res, 'id')).toEqual([
      {
        id: 'flr3-ref1',
        flexReference: 7,
      },
      {
        id: 'flr3-ref2',
        flexReference: 'jey',
      },
      {
        id: 'flr3-ref3',
        flexReference: 'flr3-u1',
      },
    ]);
  });

  bench('TODO{T}:flr4[ref, flex, many] Test MANY cardinality with FLEX type in relations', async () => {
    // Create with mix of references and data types
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr4-ref1',
        flexReferences: [
          'hey',
          { $thing: 'User', id: 'flr4-u1', name: 'User 1' },
          8,
          { $thing: 'User', id: 'flr4-u2', name: 'User 2' },
          new Date('2024-01-01'),
        ],
        space: { id: 'flr4-space', name: 'flr4-space' },
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr4-ref1',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'flr4-ref1',
        space: { $op: 'delete' },
      },
    ]);

    expect(res).toEqual({
      id: 'flr4-ref1',
      flexReferences: ['hey', 'flr4-u1', 8, 'flr4-u2', new Date('2024-01-01')],
    });
  });

  bench('TODO{T}:flr5[ref, flex, many,replace] Test replace in flex ref field in relations', async () => {
    // Create with mix of references and data types
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        id: 'flr5-ref1',
        flexReferences: [
          'hey',
          { $thing: 'User', id: 'flr5-u1', name: 'User 1' },
          8,
          { $thing: 'User', id: 'flr5-u2', name: 'User 2' },
          new Date('2024-01-01'),
        ],
        space: { id: 'flr5-space', name: 'flr5-space' },
      },
      { noMetadata: true },
    );

    // replace
    await ctx.mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'flr5-ref1',
        flexReferences: [new Date('1990-10-10'), 9, 'hello', { $thing: 'User', $op: 'link', $id: 'flr5-u2' }],
      },
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr5-ref1',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    // Clean up
    await ctx.mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'flr4-ref1',
        space: { $op: 'delete' },
      },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['flr5-u1', 'flr5-u2'],
      },
    ]);

    expect(res).toEqual({
      id: 'flr5-ref1',
      flexReferences: [new Date('1990-10-10T00:00:00.000Z'), 9, 'hello', 'flr5-u2'],
    });
  });

  bench('fl6:[ref, data, tempVar] Should accept strings with weird formats as string and tempVars', async () => {
    await ctx.mutate(
      [
        {
          $thing: 'FlexRefRel',
          id: 'flr6-refField-weirdFormat',
          flexReferences: ['(TARGET.{', 'User:_:flr6-u1', '} / TARGET.{', 'User:_:flr6-u2', '}) * 100'],
          space: { id: 'flr6-space', name: 'flr6-space' },
        },
        {
          $thing: 'User',
          $tempId: '_:flr6-u1',
          id: 'flr6-u1',
          name: 'User 1',
        },
        {
          $thing: 'User',
          $tempId: '_:flr6-u2',
          id: 'flr6-u2',
          name: 'User 2',
        },
      ],
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr6-refField-weirdFormat',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    //clean up
    await ctx.mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'flr6-refField-weirdFormat',
      space: { $op: 'delete' },
    });

    expect(res).toEqual({
      id: 'flr6-refField-weirdFormat',
      flexReferences: ['(TARGET.{', 'flr6-u1', '} / TARGET.{', 'flr6-u2', '}) * 100'],
    });
  });

  bench('fl7:[ref, data, tempVar] $thing:id format not triggered with other strings using ":" ', async () => {
    await ctx.mutate(
      [
        {
          $thing: 'FlexRefRel',
          id: 'flr7-refField-weirdFormat',
          flexReferences: ['hello ? yes : no', 'User:abc:xyz', 'things it can do: jumping', 'User: hey', 'User:hey '], //this should not be interpreted asa $thing:id
          space: { id: 'flr7-space', name: 'flr7-space' },
        },
      ],
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'flr7-refField-weirdFormat',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    //clean
    await ctx.mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'flr7-refField-weirdFormat',
      space: { $op: 'delete' },
    });

    expect(res).toEqual({
      id: 'flr7-refField-weirdFormat',
      flexReferences: ['hello ? yes : no', 'User:abc:xyz', 'things it can do: jumping', 'User: hey', 'User:hey '],
    });
  });

  bench('fl8:[flex, object] Should accept objects in flexReferences', async () => {
    const flexWithObject = {
      id: 'fl8-flex-with-object',
      flexReferences: [{ msg: 'Hello, world!' }],
    };
    await ctx.mutate(
      [
        {
          ...flexWithObject,
          $thing: 'FlexRefRel',
          // We need to link something when creating a relation to avoid "[Wrong format] Can't create a relation without any player".
          space: { id: 'fl8-space', name: 'fl8-space' },
        },
      ],
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'fl8-flex-with-object',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    //clean
    await ctx.mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'fl8-flex-with-object',
      space: { $op: 'delete' },
    });

    expect(res).toEqual(flexWithObject);
  });

  bench('fl9:[flex, object] Should accept an array of objects in flexReferences', async () => {
    const flexWithObject = {
      id: 'fl8-flex-with-object',
      flexReferences: [[{ msg: 'Hello, world!' }]],
    };
    await ctx.mutate(
      [
        {
          ...flexWithObject,
          $thing: 'FlexRefRel',
          // We need to link something when creating a relation to avoid "[Wrong format] Can't create a relation without any player".
          space: { id: 'fl8-space', name: 'fl8-space' },
        },
      ],
      { noMetadata: true },
    );

    const res = await ctx.query(
      {
        $relation: 'FlexRefRel',
        $id: 'fl8-flex-with-object',
        $fields: ['id', 'flexReferences'],
      },
      { noMetadata: true },
    );

    //clean
    await ctx.mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'fl8-flex-with-object',
      space: { $op: 'delete' },
    });

    expect(res).toEqual(flexWithObject);
  });

  // --- Mutation: Unsupported ---

  bench("notYet1[format] Can't update on link", async () => {
    try {
      await ctx.mutate({
        $thing: 'Thing',
        $thingType: 'entity',
        $id: 'temp1',
        root: {
          $op: 'link',
          $id: 'tr10',
          moreStuff: 'stuff', //this does not even exist in the schema, and thats fine
        },
      });
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toBe("[Unsupported] Can't update fields on Link / Unlink");
      } else {
        expect(true).toBe(false);
      }
      return;
    }
    throw new Error('Expected mutation to throw an error');
  });
});
