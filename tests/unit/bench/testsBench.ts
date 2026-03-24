import { Bench } from 'tinybench';
import type { QueryConfig, RawBQLQuery } from '../../../src';
import { init } from '../../helpers/init';

type QueryFn = (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => Promise<unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutateFn = (mutation: any, mutationConfig?: any) => Promise<unknown>;
type Ctx = { query: QueryFn; mutate: MutateFn };

const tasks: Record<string, (ctx: Ctx) => Promise<void>> = {
  // ==========================================
  // QUERIES (from tests/unit/queries/query.ts)
  // ==========================================

  // --- Validation ---
  'v1[validation] - $entity missing': async ({ query }) => {
    try {
      // @ts-expect-error - $entity is missing
      await query({});
    } catch {
      // No op
    }
  },
  'v2[validation] - $entity not in schema': async ({ query }) => {
    try {
      await query({ $entity: 'fakeEntity' });
    } catch {
      // No op
    }
  },
  'v3[validation] - $id not existing': async ({ query }) => {
    await query({ $entity: 'User', $id: 'nonExisting' });
  },

  // --- Entity ---
  'e1[entity] - basic and direct link to relation': async ({ query }) => {
    await query({ $entity: 'User' });
  },
  'e1.b[entity] - basic and direct link to relation sub entity': async ({ query }) => {
    await query({ $entity: 'God' });
  },
  'e2[entity] - filter by single $id': async ({ query }) => {
    await query({ $entity: 'User', $id: 'user1' });
  },
  'e3[entity, nested] - direct link to relation, query nested ': async ({ query }) => {
    await query({ $entity: 'User', $fields: ['id', { $path: 'user-tags' }] });
  },

  // --- Options ---
  'opt1[options, noMetadata': async ({ query }) => {
    await query(
      { $entity: 'User', $id: 'user1' },
      {
        noMetadata: true,
      },
    );
  },
  /* 'TODO{TS}:opt2[options, debugger': async ({ query }) => {
    await query(
      { $entity: 'User', $id: 'user1' },
      {
        debugger: true,
      },
    );
  }, */
  'opt3a[options, returnNull] - empty fields option in entity': async ({ query }) => {
    await query(
      {
        $entity: 'User',
        $id: 'user4',
        $fields: ['spaces', 'email', 'user-tags'],
      },
      { returnNulls: true },
    );
  },
  'opt3b[options, returnNull] - empty fields option in entity, dont return explicit': async ({ query }) => {
    await query(
      {
        $entity: 'User',
        $id: 'user4',
        $fields: ['spaces', 'email'],
      },
      { returnNulls: true },
    );
  },

  // --- Relation ---
  'r1[relation] - basic': async ({ query }) => {
    const q = { $relation: 'User-Accounts' };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r2[relation] - filtered fields': async ({ query }) => {
    const q = { $relation: 'User-Accounts', $fields: ['user'] };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r3[relation, nested] - nested entity': async ({ query }) => {
    const q = {
      $relation: 'User-Accounts',
      $fields: ['id', { $path: 'user', $fields: ['name'] }],
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r4[relation, nested, direct] - nested relation direct on relation': async ({ query }) => {
    const q = {
      $relation: 'UserTag',
      $fields: [
        'id',
        { $path: 'users', $fields: ['id'] },
        { $path: 'group', $fields: ['id'] },
        { $path: 'color', $fields: ['id'] },
      ],
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r5[relation nested] - that has both role, and linkfield pointing to same role': async ({ query }) => {
    const q = {
      $entity: 'Color',
      $fields: ['id', 'user-tags', 'group'],
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r6[relation nested] - relation connected to relation and a tunneled relation': async ({ query }) => {
    const q = {
      $relation: 'UserTag',
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r7[relation, nested, direct] - nested on nested': async ({ query }) => {
    const q = {
      $relation: 'UserTag',
      $fields: [
        'id',
        { $path: 'users', $fields: ['id', 'spaces'] },
        { $path: 'group' },
        { $path: 'color', $fields: ['id', 'user-tags', 'group'] },
      ],
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r8[relation, nested, deep] - deep nested': async ({ query }) => {
    const q = {
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
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r9[relation, nested, ids]': async ({ query }) => {
    await query({
      $relation: 'UserTagGroup',
      $id: 'utg-1',
      $fields: ['tags', 'color'],
    });
  },

  // --- Entity Fields ---
  'ef1[entity] - $id single': async ({ query }) => {
    await query({ $entity: 'User', $id: 'non-existing-uuid-for-bench' });
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['id'],
    });
  },
  'ef2[entity] - $id multiple': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: ['user1', 'user2'],
      $fields: ['id'],
    });
  },
  'ef3[entity] - $fields single': async ({ query }) => {
    await query({ $entity: 'User', $fields: ['id'] });
  },
  'ef4[entity] - $fields multiple': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', 'email'],
    });
  },
  'ef5[entity,filter] - $filter single': async ({ query }) => {
    await query({
      $entity: 'User',
      $filter: { name: 'Antoine' },
      $fields: ['name'],
    });
  },
  'ef6[entity,filter,id] - $filter by id in filter': async ({ query }) => {
    await query({
      $entity: 'User',
      $filter: { id: 'user1' },
      $fields: ['name'],
    });
  },
  'ef7[entity,unique] - $filter by unique field': async ({ query }) => {
    await query({
      $entity: 'User',
      $filter: { email: 'antoine@test.com' },
      $fields: ['name', 'email'],
    });
  },

  // --- Nested ---
  'n1[nested] Only ids': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', 'accounts'],
    });
  },
  'n2[nested] First level all fields': async ({ query }) => {
    const q = {
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts' }],
    };
    await query(q);
    await query(q, { noMetadata: true });
  },
  'n3[nested, $fields] First level filtered fields': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts', $fields: ['provider'] }],
    });
  },
  'n4a[nested, $id] Local filter on nested, by id': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: ['user1', 'user2', 'user3'],
      $fields: [
        'name',
        {
          $path: 'accounts',
          $id: 'account3-1',
          $fields: ['provider'],
        },
      ],
    });
  },
  'n4b[nested, $id] Local filter on nested depth two, by id': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: [
        {
          $path: 'spaces',
          $id: 'space-1',
          $fields: [{ $path: 'users', $id: 'user1', $fields: ['$id'] }],
        },
      ],
    });
  },

  // --- Nested Filters ---
  'nf1[nested, $filters] Local filter on nested, single id': async ({ query }) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts', $filter: { provider: { $eq: 'github' } } }],
    });
  },
  'nf2[nested, $filters] Local filter on nested, by field, multiple sources, some are empty': async ({ query }) => {
    await query({
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
  },
  'nf3[nested, $filters] Local filter on nested, by link field, multiple sources': async ({ query }) => {
    await query({
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
  },
  'nf4[nested, $filters] Local filter on nested, by link field, multiple sources': async ({ query }) => {
    await query({
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
  },

  // --- Link Filters ---
  'lf1[$filter] Filter by a link field with cardinality ONE': async ({ query }) => {
    await query(
      {
        $relation: 'User-Accounts',
        $filter: { user: 'user1' },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'lf2[$filter, $not] Filter out by a link field with cardinality ONE': async ({ query }) => {
    await query(
      {
        $relation: 'User-Accounts',
        $filter: {
          $not: { user: ['user1'] },
        },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'lf3[$filter] Filter by a link field with cardinality MANY': async ({ query }) => {
    await query(
      {
        $entity: 'User',
        $filter: { spaces: ['space-1'] },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'TODO{T}:lf4[$filter, $or] Filter by a link field with cardinality MANY': async ({ query }) => {
    await query(
      {
        $entity: 'User',
        // @ts-expect-error - TODO: This is valid syntax but requires refactoring the filters
        $filter: [{ spaces: ['space-1'] }, { email: 'ann@test.com' }],
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },

  // --- Sort, Limit, Offset ---
  'slo1[$sort, $limit, $offset] root': async ({ query }) => {
    await query(
      {
        $entity: 'Account',
        $sort: [{ field: 'provider', desc: false }, 'id'],
        $offset: 1,
        $limit: 2,
        $fields: ['id', 'provider'],
      },
      { noMetadata: true },
    );
  },
  'slo2[$sort, $limit, $offset] sub level': async ({ query }) => {
    await query(
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
  },
  /* 'TODO{S}:slo3[$sort, $limit, $offset] with an empty attribute': async ({ query }) => {
    await query(
      {
        $entity: 'User',
        $fields: ['id', 'email'],
        $sort: ['email'],
      },
      { noMetadata: true },
    );
  }, */

  // --- Inherited ---
  'i1[inherited, attributes] Entity with inherited attributes': async ({ query }) => {
    await query({ $entity: 'God', $id: 'god1' }, { noMetadata: true });
  },
  /* 'TODO{TS}:i2[inherited, attributes] Entity with inherited attributes should fetch them even when querying from parent class':
    async ({ query }) => {
      await query({ $entity: 'User', $id: 'god1' }, { noMetadata: true });
    }, */

  // --- Self ---
  's1[self] Relation playing a a role defined by itself': async ({ query }) => {
    await query({ $relation: 'Self' }, { noMetadata: true });
  },

  // --- Extends ---
  'ex1[extends] Query where an object plays 3 different roles because it extends 2 types': async ({ query }) => {
    await query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });
  },
  'ex2[extends] Query of the parent': async ({ query }) => {
    await query({ $entity: 'Space', $id: 'space-2', $fields: ['objects'] }, { noMetadata: true });
  },

  // --- Repeated ---
  /* 'TODO{TS}:re1[repeated] Query with repeated path, different nested ids': async ({ query }) => {
    await query(
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
  }, */
  /* 'TODO{TS}:re2[repeated] Query with repeated path, different nested patterns': async ({ query }) => {
    await query(
      {
        $entity: 'Space',
        $id: 'space-2',
        $fields: ['users', { $path: 'users', $id: 'user3', $fields: ['id', 'name'] }],
      },
      { noMetadata: true },
    );
  }, */

  // --- Excluded Fields ---
  'xf1[excludedFields] Testing excluded fields': async ({ query }) => {
    await query(
      {
        $entity: 'God',
        $id: 'god1',
        $excludedFields: ['email', 'isEvil'],
      },
      { noMetadata: true },
    );
  },
  'xf2[excludedFields, deep] - deep nested': async ({ query }) => {
    const q = {
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
    await query(q);
    await query(q, { noMetadata: true });
  },
  'xf3[excludedFields, deep] - Exclude virtual field': async ({ query }) => {
    const q = {
      $entity: 'User',
      $id: 'user2',
      $fields: [
        'id',
        { $path: 'user-tags', $fields: [{ $path: 'color', $excludedFields: ['isBlue', 'totalUserTags'] }, 'id'] },
      ],
    };
    await query(q, { noMetadata: true });
    await query(q, { noMetadata: true });
  },

  // --- Virtual ---
  'vi1[virtual, attribute] Virtual DB field': async ({ query }) => {
    await query({ $entity: 'Account', $fields: ['id', 'isSecureProvider'] }, { noMetadata: true });
  },
  'vi2[virtual, edge] Virtual DB edge field': async ({ query }) => {
    await query({ $entity: 'Hook' }, { noMetadata: true });
  },

  // --- Computed ---
  'co1[computed] Virtual computed field': async ({ query }) => {
    await query({ $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'isBlue'] }, { noMetadata: true });
  },
  'co2[computed] Computed virtual field depending on edge id': async ({ query }) => {
    await query(
      { $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'user-tags', 'totalUserTags'] },
      { noMetadata: true },
    );
  },
  /* 'TODO{TS}:co3[computed], Computed virtual field depending on edge id, missing dependencies': async ({ query }) => {
    await query(
      { $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'totalUserTags'] },
      { noMetadata: true },
    );
  }, */

  // --- MultiVal ---
  'mv1[multiVal, query, ONE], get multiVal': async ({ query }) => {
    await query({ $entity: 'Color', $fields: ['id', 'freeForAll'] }, { noMetadata: true });
  },
  'TODO{T}:mv2[multiVal, query, ONE], filter by multiVal': async ({ query }) => {
    await query(
      { $entity: 'Color', $filter: { freeForAll: 'hey' }, $fields: ['id', 'freeForAll'] },
      { noMetadata: true },
    );
  },

  // --- $as ---
  'a1[$as] - as for attributes and roles and links': async ({ query }) => {
    await query(
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
    );
  },

  // --- Batched Query ---
  'bq1[batched query] - as for attributes and roles and links': async ({ query }) => {
    await query(
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
    );
  },
  /* 'TODO{TS}:bq2[batched query with $as] - as for attributes and roles and links': async ({ query }) => {
    await query(
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
    );
  }, */

  // --- JSON ---
  'j1[json] Query a thing with a JSON attribute': async ({ query }) => {
    await query({
      $entity: 'Account',
      $id: 'account1-1',
      $fields: ['profile'],
    });
  },
  'j2[json] Query a thing with an empty JSON attribute': async ({ query }) => {
    await query({
      $entity: 'Account',
      $id: 'account1-2',
      $fields: ['profile'],
    });
  },

  // --- Deep Nested ---
  'dn1[deep nested] ridiculously deep nested query': async ({ query }) => {
    await query({
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
  },
  'TODO{T}:dn2[deep numbers] Big numbers': async ({ query }) => {
    await query(
      {
        $entity: 'Company',
        $filter: { employees: { name: ['Employee 78f', 'Employee 187f', 'Employee 1272f', 'Employee 9997f'] } },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'TODO{T}:dn3[deep numbers] Big numbers nested': async ({ query }) => {
    await query(
      {
        $entity: 'Company',
        $filter: { employees: { name: ['Employee 78f'] } },
        $fields: ['id', { $path: 'employees' }],
      },
      { noMetadata: true },
    );
  },

  // --- Filter Keywords ---
  'fk1[filter, keywords, exists], filter by undefined/null property': async ({ query }) => {
    await query({ $entity: 'User', $filter: { email: { $exists: false } } }, { noMetadata: true });
  },
  'fk2[filter, keywords, exists], filter by undefined/null property': async ({ query }) => {
    await query({ $entity: 'User', $filter: { email: { $exists: true } } }, { noMetadata: true });
  },
  'fk3[filter, nested] Filter by nested property': async ({ query }) => {
    await query(
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
  },

  // --- Ref / FlexRef ---
  'TODO{T}:ref1[ref, ONE] Get reference, id only': async ({ query }) => {
    await query({ $entity: 'FlexRef', $id: 'fr1', $fields: ['id', 'reference'] }, { noMetadata: true });
  },
  /* 'TODO{TS}:ref1n[ref, ONE, nested] Get also nested data': async ({ query }) => {
    await query(
      {
        $entity: 'FlexRef',
        $id: 'fr1',
        $fields: ['id', { $path: 'reference' }],
      },
      { noMetadata: true },
    );
  }, */
  /* 'TODO{TS}:ref1nf[ref, ONE, nested, someFields] Get also nested data but only some fields': async ({ query }) => {
    await query(
      {
        $entity: 'FlexRef',
        $id: 'fr1',
        $fields: ['id', { $path: 'reference', $fields: ['id', 'accounts', 'email'] }],
      },
      { noMetadata: true },
    );
  }, */
  'TODO{T}:ref2[ref, MANY] Get references, id only': async ({ query }) => {
    await query({ $entity: 'FlexRef', $id: 'fr2' }, { noMetadata: true });
  },
  'TODO{T}:ref3[ref, flex, ONE] Get flexReference': async ({ query }) => {
    await query({ $entity: 'FlexRef', $id: ['fr3', 'fr4'] }, { noMetadata: true });
  },
  'TODO{T}:ref4[ref, flex, MANY] Get flexReferences': async ({ query }) => {
    await query({ $entity: 'FlexRef', $id: 'fr5' }, { noMetadata: true });
  },
  /* 'TODO{TS}:ref4nf[ref, flex, MANY, nested] Get flexReferences with nested data': async ({ query }) => {
    await query(
      { $entity: 'FlexRef', $id: 'fr5', $fields: ['id', { $path: 'flexReferences' }] },
      { noMetadata: true },
    );
  }, */
  /* 'TODO{TS}:ref4n[ref, flex, MANY, nested, $fields] Get flexReferences with nested data but only some fields':
    async ({ query }) => {
      await query(
        {
          $entity: 'FlexRef',
          $id: 'fr5',
          $fields: ['id', { $path: 'flexReferences', $fields: ['id', 'name', 'user-tags'] }],
        },
        { noMetadata: true },
      );
    }, */

  // =============================================
  // MUTATIONS: Basic (from mutations/basic.ts)
  // =============================================

  'mut-basic:r1[roleFields] Basic roleFields create update delete': async ({ mutate, query }) => {
    await mutate(
      {
        $thing: 'UserTag',
        id: 'bench-bo-ut1',
        users: [
          { $thing: 'User', id: 'bench-bo-u1', name: 'bo-u1' },
          { $thing: 'User', id: 'bench-bo-u2', name: 'bo-u2' },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'UserTag',
        $id: 'bench-bo-ut1',
        $op: 'delete',
        users: [{ $op: 'delete' }],
      },
      { noMetadata: true },
    );
  },
  'mut-basic:b1a[create] Basic': async ({ mutate }) => {
    await mutate({ $entity: 'User', name: 'benchUser', email: 'bench@test.com' }, { noMetadata: true });
    await mutate({ $entity: 'User', $filter: { name: 'benchUser' }, $op: 'delete' });
  },
  'mut-basic:b2a[update] Basic': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'User',
        $id: 'user1',
        name: 'Antoine',
      },
      { noMetadata: true },
    );
  },
  'mut-basic:b2b[update] Set null in single-attribute mutation should delete the attribute': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'User',
        $id: 'user4',
        name: null,
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $entity: 'User',
        $id: 'user4',
        name: 'Ben',
      },
      { noMetadata: true },
    );
  },
  'mut-basic:b2c[update] Set null in multi-attributes mutation should delete the attribute': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'User',
        $id: 'user1',
        email: 'antoine@test.com',
        name: 'Antoine',
      },
      { noMetadata: true },
    );
  },
  'mut-basic:b2d[update] Set an empty string should update the attribute to an empty string': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'User',
        $id: 'user1',
        email: 'antoine@test.com',
        name: 'Antoine',
      },
      { noMetadata: true },
    );
  },
  'mut-basic:b3e[delete, entity] Basic': async ({ mutate }) => {
    await mutate({ $entity: 'User', id: 'bench-b3e-user', name: 'bench-b3e' });
    await mutate({ $entity: 'User', $id: 'bench-b3e-user', $op: 'delete' });
  },
  'mut-basic:b3r[delete, relation] Basic': async ({ mutate }) => {
    await mutate({ $relation: 'UserTag', id: 'bench-b3r-tag', users: [{ $thing: 'User', id: 'bench-b3r-u' }] });
    await mutate([{ $relation: 'UserTag', $id: 'bench-b3r-tag', $op: 'delete', users: [{ $op: 'delete' }] }]);
  },
  'mut-basic:b4[create, children] Create with children': async ({ mutate }) => {
    await mutate({
      $entity: 'User',
      id: 'bench-b4-user',
      name: 'bench-b4',
      accounts: [{ provider: 'google' }],
    });
    await mutate({
      $entity: 'User',
      $id: 'bench-b4-user',
      $op: 'delete',
      accounts: [{ $op: 'delete' }],
    });
  },
  'mut-basic:b5[update, children] Update children': async ({ mutate }) => {
    await mutate({
      $entity: 'User',
      $id: 'user1',
      name: 'Antoine',
      accounts: [{ $id: 'account1-1', $op: 'update', provider: 'google' }],
    });
    await mutate({
      $entity: 'User',
      $id: 'user1',
      accounts: [{ $id: 'account1-1', $op: 'update', provider: 'google' }],
    });
  },
  'mut-basic:b6.1[create, withId] Create with id (override default)': async ({ mutate }) => {
    await mutate({
      $entity: 'User',
      id: 'bench-b6-user',
      name: 'bench-b6',
    });
    await mutate({ $entity: 'User', $id: 'bench-b6-user', $op: 'delete' });
  },
  'mut-basic:b7[create, inherited] inheritedAttributesMutation': async ({ mutate }) => {
    await mutate({
      $entity: 'God',
      id: 'bench-god',
      name: 'bench-god',
      email: 'bench@god.com',
      power: 'speed',
      isEvil: false,
    });
    await mutate({ $entity: 'God', $id: 'bench-god', $op: 'delete' });
  },
  'mut-basic:n1[create, nested] nested': async ({ mutate }) => {
    await mutate({
      $entity: 'User',
      id: 'bench-n1-user',
      name: 'bench-n1',
      spaces: [{ id: 'bench-n1-space', name: 'bench-n1-space' }],
    });
    await mutate([
      { $entity: 'User', $id: 'bench-n1-user', $op: 'delete' },
      { $entity: 'Space', $id: 'bench-n1-space', $op: 'delete' },
    ]);
  },
  'mut-basic:u1[update, multiple] Shared ids': async ({ mutate }) => {
    await mutate({
      $entity: 'User',
      $id: 'user1',
      name: 'Antoine',
    });
  },
  'mut-basic:ext1[role, link, extended] Link role to subtype of player': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTag',
      id: 'bench-ext1-tag',
      users: [{ $thing: 'SuperUser', id: 'bench-ext1-su', name: 'bench-ext1' }],
    });
    await mutate([{ $relation: 'UserTag', $id: 'bench-ext1-tag', $op: 'delete', users: [{ $op: 'delete' }] }]);
  },
  'mut-basic:enum1[create, update, reset] Should reset enum value to null without error': async ({ mutate }) => {
    await mutate({
      $entity: 'Hook',
      id: 'bench-enum1',
      requiredOption: 'a',
      manyOptions: ['a', 'b'],
    });
    await mutate({
      $entity: 'Hook',
      $id: 'bench-enum1',
      manyOptions: null,
    });
    await mutate({ $entity: 'Hook', $id: 'bench-enum1', $op: 'delete' });
  },

  // =============================================
  // MUTATIONS: Edges (from mutations/edges.ts)
  // =============================================

  'mut-edges:l1[link, add, nested, relation] Update entity by adding a new created relation children. Also test getting ids by tempId':
    async ({ mutate }) => {
      const res = (await mutate(
        {
          $entity: 'User',
          $id: 'user5',
          'user-tags': [
            {
              name: 'bench tag',
              $tempId: '_:benchTagId',
              group: { color: { id: 'bench-purple' } },
            },
          ],
        },
        { noMetadata: false },
      )) as Array<{ $tempId?: string; $id?: string }> | undefined;
      const tagId = res?.find((m) => m.$tempId === '_:benchTagId')?.$id;
      if (tagId) {
        await mutate({ $relation: 'UserTag', $id: tagId, color: { $op: 'delete' } }, { noMetadata: true });
        await mutate(
          { $relation: 'UserTag', $id: tagId, group: { $op: 'delete' }, $op: 'delete' },
          { noMetadata: true },
        );
      }
    },
  'mut-edges:l6[link, many] explicit link to many': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTag',
      id: 'bench-l6-tag',
      users: [
        { $thing: 'User', id: 'bench-l6-u1' },
        { $thing: 'User', id: 'bench-l6-u2' },
      ],
    });
    await mutate([{ $relation: 'UserTag', $id: 'bench-l6-tag', $op: 'delete', users: [{ $op: 'delete' }] }]);
  },
  'mut-edges:l8[create, link, relation, unsupported] Create relation and link it to multiple existing things': async ({
    mutate,
  }) => {
    await mutate({
      $relation: 'UserTag',
      id: 'bench-l8-tag',
      users: [{ $op: 'link', $id: 'user1' }],
    });
    await mutate({ $relation: 'UserTag', $id: 'bench-l8-tag', $op: 'delete' });
  },
  'mut-edges:l12[link,many] Insert items in multiple': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTag',
      id: 'bench-l12-tag',
      users: [{ $thing: 'User', id: 'bench-l12-u1' }],
    });
    await mutate([{ $relation: 'UserTag', $id: 'bench-l12-tag', $op: 'delete', users: [{ $op: 'delete' }] }]);
  },
  'mut-edges:rep3[replace, many, multi] Replace multiple fields': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-rep3-utg',
      tags: ['tag-1', 'tag-2'],
    });
    await mutate({
      $id: 'bench-rep3-utg',
      $relation: 'UserTagGroup',
      tags: ['tag-3', 'tag-4'],
    });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-rep3-utg', $op: 'delete' });
  },
  'mut-edges:lm-i1[link and unlink many, intermediary] linking and unlinking many things at once with intermediary, not batched, on-create':
    async ({ mutate }) => {
      await mutate({
        $entity: 'Space',
        id: 'bench-lm-i1-space',
        users: [
          { $thing: 'User', id: 'bench-lm-i1-u1', name: 'bench1' },
          { $thing: 'User', id: 'bench-lm-i1-u2', name: 'bench2' },
        ],
      });
      await mutate([
        { $entity: 'User', $id: ['bench-lm-i1-u1', 'bench-lm-i1-u2'], $op: 'delete' },
        { $entity: 'Space', $id: 'bench-lm-i1-space', $op: 'delete' },
      ]);
    },
  'mut-edges:d-pq1[delete with pre query, intermediary, nested] delete mutation from root and delete children with intermediary':
    async ({ mutate }) => {
      await mutate({
        $entity: 'Space',
        id: 'bench-dpq1-space',
        users: [{ $thing: 'User', id: 'bench-dpq1-u1', name: 'bench-dpq1' }],
      });
      await mutate(
        { $entity: 'Space', $id: 'bench-dpq1-space', $op: 'delete', users: [{ $op: 'delete' }] },
        { preQuery: true },
      );
    },
  'mut-edges:rep-del1[delete, replace, ONE] replace on cardinality ONE but deleting existing': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTag',
      id: 'bench-repdel1-tag',
      users: [{ $thing: 'User', id: 'bench-repdel1-u1' }],
      color: { id: 'bench-repdel1-color' },
    });
    await mutate([
      { $relation: 'UserTag', $id: 'bench-repdel1-tag', $op: 'delete', users: [{ $op: 'delete' }] },
      { $entity: 'Color', $id: 'bench-repdel1-color', $op: 'delete' },
    ]);
  },

  // =============================================
  // MUTATIONS: Batched (from mutations/batched.ts)
  // =============================================

  'mut-batched:c0-lfr[link, create, linkfield-role] Simple tempIds': async ({ mutate }) => {
    await mutate([
      {
        $entity: 'User',
        name: 'bench-Hanna',
        email: 'bench-hanna@test.ru',
        accounts: [{ $op: 'link', $tempId: '_:bench-acc-c0' }],
      },
      {
        $tempId: '_:bench-acc-c0',
        $op: 'create',
        $entity: 'Account',
        provider: 'MetaMask',
      },
    ]);
    await mutate([
      {
        $entity: 'User',
        $filter: { name: 'bench-Hanna' },
        $op: 'delete',
        accounts: [{ $op: 'delete' }],
      },
    ]);
  },
  'mut-batched:c1[multi, create, link] Simple tempIds': async ({ mutate }) => {
    await mutate([
      {
        $entity: 'User',
        name: 'bench-Peter',
        email: 'bench-Peter@test.ru',
        accounts: [{ provider: 'google' }, { $op: 'link', $tempId: '_:bench-acc1' }],
      },
      {
        $tempId: '_:bench-acc1',
        $op: 'create',
        $entity: 'Account',
        provider: 'MetaMask',
      },
    ]);
    await mutate([
      {
        $entity: 'User',
        $filter: { name: 'bench-Peter' },
        $op: 'delete',
        accounts: [{ $op: 'delete' }],
      },
    ]);
  },
  'mut-batched:c2[multi, create, link] Nested tempIds simple': async ({ mutate }) => {
    const res = await mutate([
      {
        $entity: 'Account',
        provider: 'Facebook',
        user: { $tempId: '_:bench-bea', $thing: 'User', $op: 'link' },
      },
      {
        $entity: 'Account',
        provider: 'Google',
        user: {
          $thing: 'User',
          $op: 'create',
          $tempId: '_:bench-bea',
          name: 'bench-Bea',
          email: 'bench-bea@gmail.com',
        },
      },
    ]);
    const beaId = (res as Array<{ $tempId?: string; id?: string }>)?.find((r) => r.$tempId === '_:bench-bea')?.id;
    if (beaId) {
      await mutate([{ $entity: 'User', $id: beaId, $op: 'delete', accounts: [{ $op: 'delete' }] }]);
    }
  },

  // =============================================
  // MUTATIONS: Errors (from mutations/errors.ts)
  // =============================================

  'mut-errors:e1[duplicate] Duplicate creation': async ({ mutate }) => {
    try {
      await mutate({
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
      });
    } catch {
      // Expected error
    }
  },
  'mut-errors:e3[create] Check for no $id field on $op create': async ({ mutate }) => {
    try {
      await mutate(
        {
          $entity: 'User',
          $op: 'create',
          $id: 'blah',
          name: 'test testerman',
          email: 'test@test.com',
        },
        { noMetadata: true },
      );
    } catch {
      // Expected error
    }
  },
  'mut-errors:e4[update, nested, error] Update all children error': async ({ mutate }) => {
    try {
      await mutate(
        {
          $entity: 'Account',
          $id: 'account3-1',
          user: { email: 'theNewEmailOfAnn@gmail.com' },
        },
        { noMetadata: true },
      );
    } catch {
      // Expected error
    }
  },
  'mut-errors:e7a[tempId, deletion] Delete tempId': async ({ mutate }) => {
    try {
      await mutate([
        {
          $entity: 'User',
          name: 'Peter',
          email: 'Peter@test.ru',
          accounts: [{ provider: 'google', $tempId: '_:acc1', $op: 'delete' }],
        },
      ]);
    } catch {
      // Expected error
    }
  },
  'mut-errors:e7b[tempId, unlink] Unlink tempId': async ({ mutate }) => {
    try {
      await mutate([
        {
          $entity: 'User',
          name: 'Peter',
          email: 'Peter@test.ru',
          accounts: [{ provider: 'google', $tempId: '_:acc1', $op: 'unlink' }],
        },
      ]);
    } catch {
      // Expected error
    }
  },
  'mut-errors:e8a[multi, create, link] Incompatible tempId ops': async ({ mutate }) => {
    try {
      await mutate([
        { $relation: 'UserTagGroup', $tempId: '_:utg1', $op: 'create' },
        {
          $relation: 'UserTag',
          name: 'hey',
          users: [{ $thing: 'User', name: 'toDelete' }],
          group: { $tempId: '_:utg1', $op: 'create' },
        },
      ]);
    } catch {
      // Expected error
    }
  },
  'mut-errors:e8b[multi, create, link] Incompatible tempId ops': async ({ mutate }) => {
    try {
      await mutate([
        { $relation: 'UserTagGroup', $tempId: '_:utg1', $op: 'link' },
        {
          $relation: 'UserTag',
          name: 'hey',
          users: [{ $thing: 'User', name: 'toDelete' }],
          group: { $tempId: '_:utg1', $op: 'link' },
        },
      ]);
    } catch {
      // Expected error
    }
  },
  'mut-errors:e-v1[virtual] Cant insert virtual': async ({ mutate }) => {
    try {
      await mutate([{ $entity: 'Color', isBlue: false }]);
    } catch {
      // Expected error
    }
  },
  'mut-errors:e-pq1[create, nested] With pre-query, link when there is already something error': async ({ mutate }) => {
    try {
      await mutate(
        { $entity: 'Account', $id: 'account3-1', user: { $op: 'link' } },
        { noMetadata: true, preQuery: true },
      );
    } catch {
      // Expected error
    }
  },
  'mut-errors:e-c1d[create, nested delete] With pre-query, cannot delete under a create': async ({ mutate }) => {
    try {
      await mutate(
        { $entity: 'Account', $op: 'create', user: { $op: 'delete' } },
        { noMetadata: true, preQuery: true },
      );
    } catch {
      // Expected error
    }
  },
  'mut-errors:e-c1ul[create, nested unlink] With pre-query, cannot unlink under a create': async ({ mutate }) => {
    try {
      await mutate(
        {
          $entity: 'Account',
          $op: 'create',
          user: { $op: 'unlink', email: 'theNewEmailOfAnn@gmail.com' },
        },
        { noMetadata: true, preQuery: true },
      );
    } catch {
      // Expected error
    }
  },
  "mut-errors:vi1[create, virtual, error] Can't set virtual fields": async ({ mutate }) => {
    try {
      await mutate(
        { $entity: 'Account', id: 'newAccount', provider: 'gmail', isSecureProvider: true },
        { noMetadata: true },
      );
    } catch {
      // Expected error
    }
  },
  'mut-errors:tid1[tempId, format]': async ({ mutate }) => {
    try {
      await mutate({ $entity: 'Account', $tempId: 'wronglyFormattedTempId', provider: 'gmail' }, { noMetadata: true });
    } catch {
      // Expected error
    }
  },
  "mut-errors:f1[format] Can't filter by $id when creating its parent": async ({ mutate }) => {
    try {
      await mutate({
        $thing: 'Thing',
        $thingType: 'entity',
        id: 'temp1',
        root: { $id: 'tr10', extra: 'thing2' },
      });
    } catch {
      // Expected error
    }
  },

  // =============================================
  // MUTATIONS: Filtered (from mutations/filtered.ts)
  // =============================================

  'mut-filtered:df1[filter with pre query] complete a mutation by filter': async ({ mutate }) => {
    await mutate([
      {
        $entity: 'User',
        id: 'bench-f1-user',
        spaces: [
          {
            id: 'bench-f1-space-1',
            dataFields: [
              { id: 'bench-f1-df-1', type: 'toChange' },
              { id: 'bench-f1-df-2', type: 'toStay' },
            ],
          },
        ],
      },
    ]);
    await mutate({
      $entity: 'User',
      $id: 'bench-f1-user',
      spaces: [
        {
          $id: 'bench-f1-space-1',
          dataFields: [{ $op: 'update', type: 'afterChange', $filter: { type: 'toChange' } }],
        },
      ],
    });
    await mutate([
      {
        $entity: 'User',
        $id: 'bench-f1-user',
        $op: 'delete',
        spaces: [{ $id: 'bench-f1-space-1', $op: 'delete', dataFields: [{ $op: 'delete' }] }],
      },
    ]);
  },
  'mut-filtered:df3[filter, delete] delete by filter should preserve non-matching siblings': async ({ mutate }) => {
    await mutate([
      {
        $entity: 'Space',
        id: 'bench-df3-space',
        dataFields: [
          {
            id: 'bench-df3-df',
            type: 'TEXT',
            values: [
              { id: 'bench-df3-dv-1', type: 'toDelete' },
              { id: 'bench-df3-dv-2', type: 'toKeep' },
            ],
          },
        ],
      },
    ]);
    await mutate({
      $relation: 'DataField',
      $id: 'bench-df3-df',
      values: [{ $op: 'delete', $filter: { type: 'toDelete' } }],
    });
    await mutate([
      {
        $entity: 'Space',
        $id: 'bench-df3-space',
        $op: 'delete',
        dataFields: [{ $op: 'delete', values: [{ $op: 'delete' }] }],
      },
    ]);
  },

  // =============================================
  // MUTATIONS: JSON Refs (from mutations/jsonRefs.ts)
  // =============================================

  'mut-jsonRefs:j1[json-refs] Single reference in JSON field': async ({ mutate }) => {
    await mutate({ $thing: 'Company', id: 'bench-jr-co1', name: 'TestCo', industry: 'Tech' }, { noMetadata: true });
    await mutate(
      { $thing: 'Account', id: 'bench-jr-acc1', profile: { company: { $ref: 'Company:bench-jr-co1' } } },
      { noMetadata: true },
    );
    await mutate([
      { $thing: 'Account', $op: 'delete', $id: 'bench-jr-acc1' },
      { $thing: 'Company', $op: 'delete', $id: 'bench-jr-co1' },
    ]);
  },
  'mut-jsonRefs:j2[json-refs] Array of references in JSON field': async ({ mutate }) => {
    await mutate(
      [
        { $thing: 'User', id: 'bench-jr-u1', name: 'JR User 1' },
        { $thing: 'User', id: 'bench-jr-u2', name: 'JR User 2' },
      ],
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'Account',
        id: 'bench-jr-acc2',
        profile: { team: [{ $ref: 'User:bench-jr-u1' }, { $ref: 'User:bench-jr-u2' }] },
      },
      { noMetadata: true },
    );
    await mutate([
      { $thing: 'Account', $op: 'delete', $id: 'bench-jr-acc2' },
      { $thing: 'User', $op: 'delete', $id: 'bench-jr-u1' },
      { $thing: 'User', $op: 'delete', $id: 'bench-jr-u2' },
    ]);
  },
  'mut-jsonRefs:j3[json-refs] Mixed references and plain data in an array': async ({ mutate }) => {
    await mutate({ $thing: 'Space', id: 'bench-jr-sp1', name: 'JR Space' }, { noMetadata: true });
    await mutate(
      {
        $thing: 'Account',
        id: 'bench-jr-acc3',
        profile: { mixed: ['Hello', { $ref: 'Space:bench-jr-sp1' }] },
      },
      { noMetadata: true },
    );
    await mutate([
      { $thing: 'Account', $op: 'delete', $id: 'bench-jr-acc3' },
      { $thing: 'Space', $op: 'delete', $id: 'bench-jr-sp1' },
    ]);
  },

  // =============================================
  // MUTATIONS: PreHooks (from mutations/preHooks.ts)
  // =============================================

  'mut-preHooks:df[default, field] Default field': async ({ mutate }) => {
    await mutate({ $entity: 'Hook', id: 'bench-hookDf1', requiredOption: 'b' });
    await mutate({ $entity: 'Hook', $op: 'delete', $id: 'bench-hookDf1' });
  },
  'mut-preHooks:rf[required, field] Required field': async ({ mutate }) => {
    try {
      await mutate({ $entity: 'Hook', id: 'bench-hook-rf' });
    } catch {
      // Expected error: required field missing
    }
  },
  'mut-preHooks:ef1[enum, field, one] Enum field cardinality one': async ({ mutate }) => {
    try {
      await mutate({ $entity: 'Hook', id: 'bench-hook-ef1', requiredOption: 'd' });
    } catch {
      // Expected error: invalid option
    }
  },
  'mut-preHooks:ef2[enum, field, many] Enum field cardinality one': async ({ mutate }) => {
    try {
      await mutate({
        $entity: 'Hook',
        id: 'bench-hook-ef2',
        requiredOption: 'c',
        manyOptions: ['a', 'd'],
      });
    } catch {
      // Expected error: invalid option
    }
  },
  'mut-preHooks:vfl1[validation, functions, local, thing] Basic': async ({ mutate }) => {
    try {
      await mutate({
        $relation: 'Kind',
        id: 'bench-kind1',
        name: 'Tyrannosaurus name',
        space: 'space-3',
      });
    } catch {
      // Expected error: name too long
    }
  },
  'mut-preHooks:vfl2[validation, functions, local, attribute] Function': async ({ mutate }) => {
    try {
      await mutate({
        $entity: 'Hook',
        fnValidatedField: 'something@test.es',
        requiredOption: 'a',
      });
    } catch {
      // Expected error: failed validation
    }
  },
  'mut-preHooks:tn1[transform, node] Transform node depending on attribute': async ({ mutate }) => {
    await mutate(
      [
        { $relation: 'Kind', id: 'bench-tn1-k1', name: 'randomName', space: 'space-3' },
        { $relation: 'Kind', id: 'bench-tn1-k2', name: 'secretName', space: 'space-3' },
      ],
      { noMetadata: true },
    );
    await mutate([
      { $relation: 'Kind', $id: 'bench-tn1-k1', $op: 'delete' },
      { $relation: 'Kind', $id: 'bench-tn1-k2', $op: 'delete' },
    ]);
  },
  'mut-preHooks:tn2[transform, children] Append children to node': async ({ mutate }) => {
    await mutate({ $thing: 'User', id: 'bench-tn2-u1', name: 'cheatCode' }, { noMetadata: true });
    await mutate({ $thing: 'User', $thingType: 'entity', $op: 'delete', $id: 'bench-tn2-u1' });
  },
  'mut-preHooks:tt1[transform, temp props] Transform using %vars': async ({ mutate }) => {
    await mutate({ $thing: 'User', id: 'bench-tt1-u1', '%name': 'Sinatra' }, { noMetadata: true });
    await mutate({ $thing: 'User', $thingType: 'entity', $id: 'bench-tt1-u1', $op: 'delete' });
  },
  'mut-preHooks:ctx1[transform, context] Use context': async ({ mutate }) => {
    await mutate(
      { $thing: 'User', id: 'bench-ctx1-u1', name: 'cheatCode2' },
      { noMetadata: true, context: { spaceId: 'mySpace' } },
    );
    await mutate({ $thing: 'User', $thingType: 'entity', $op: 'delete', $id: 'bench-ctx1-u1' });
  },

  // =============================================
  // MUTATIONS: Replaces (from mutations/replaces.ts)
  // =============================================

  'mut-replaces:r1[replace] replace single roles in relation': async ({ mutate }) => {
    await mutate({ $relation: 'ThingRelation', $id: 'tr2', root: 'thing4' }, { preQuery: true });
    // revert
    await mutate({ $relation: 'ThingRelation', $id: 'tr2', root: 'thing2' }, { preQuery: true });
  },
  'mut-replaces:r2[replace] replace many roles in relation': async ({ mutate }) => {
    await mutate({ $relation: 'ThingRelation', $id: 'tr3', root: 'thing4', things: ['thing4'] }, { preQuery: true });
    // revert
    await mutate({ $relation: 'ThingRelation', $id: 'tr3', root: 'thing3', things: ['thing5'] }, { preQuery: true });
  },
  'mut-replaces:r5a[replace, unlink, link, many] Replace using unlink + link single role, by IDs': async ({
    mutate,
  }) => {
    await mutate({ $relation: 'UserTagGroup', $op: 'create', id: 'bench-rep-utg', tags: ['tag-1', 'tag-2'] });
    await mutate({
      $id: 'bench-rep-utg',
      $relation: 'UserTagGroup',
      tags: [
        { $op: 'link', $id: 'tag-3' },
        { $op: 'unlink', $id: 'tag-1' },
      ],
    });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-rep-utg', $op: 'delete' });
  },
  'mut-replaces:r6a[replace, unlink, link, many] Replace using unlink + link , all unlink': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-rep6-utg',
      tags: ['tag-1', 'tag-2'],
      color: 'blue',
    });
    await mutate({
      $id: 'bench-rep6-utg',
      $relation: 'UserTagGroup',
      tags: [{ $op: 'link', $id: ['tag-4', 'tag-3'] }, { $op: 'unlink' }],
    });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-rep6-utg', $op: 'delete' });
  },

  // =============================================
  // MUTATIONS: Unsupported (from mutations/unsupported.ts)
  // =============================================

  "mut-unsupported:notYet1[format] Can't update on link": async ({ mutate }) => {
    try {
      await mutate({
        $thing: 'Thing',
        $thingType: 'entity',
        $id: 'temp1',
        root: { $op: 'link', $id: 'tr10', moreStuff: 'stuff' },
      });
    } catch {
      // Expected error
    }
  },

  // =============================================
  // MUTATIONS: RefFields (from mutations/refFields.ts)
  // =============================================

  'TODO{T}:mut-refFields:fl1[ref, ent, one] Create entity with flexible values and read it': async ({
    mutate,
    query,
  }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl1-flexRef',
        reference: { $thing: 'User', $op: 'create', id: 'bench-fl1-user', email: 'bench-f1@test.it' },
      },
      { noMetadata: true },
    );
    await query({ $entity: 'FlexRef', $id: 'bench-fl1-flexRef', $fields: ['id', 'reference'] }, { noMetadata: true });
    await mutate([{ $id: 'bench-fl1-flexRef', $entity: 'FlexRef', $op: 'delete' }]);
  },
  'TODO{T}:mut-refFields:fl2[ref, many] Test MANY cardinality with REF type': async ({ mutate }) => {
    await mutate(
      {
        $thing: 'FlexRef',
        id: 'bench-fl2-ref1',
        references: [
          { $thing: 'User', id: 'bench-fl2-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-fl2-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );
    await mutate([
      { $thing: 'FlexRef', $op: 'delete', $id: 'bench-fl2-ref1' },
      { $entity: 'User', $op: 'delete', $id: ['bench-fl2-u1', 'bench-fl2-u2'] },
    ]);
  },
  'TODO{T}:mut-refFields:fl3[ref, flex, one] Test ONE cardinality with FLEX type': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl3-ref',
        flexReference: { $thing: 'User', $op: 'create', id: 'bench-fl3-user' },
      },
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl3-ref' },
      { $entity: 'User', $op: 'delete', $id: 'bench-fl3-user' },
    ]);
  },
  'mut-refFields:fl5:[ref, data] Should not parse number in string format as date in refField': async ({ mutate }) => {
    await mutate({ $entity: 'FlexRef', id: 'bench-fl5-ref', reference: '12345' }, { noMetadata: true });
    await mutate([{ $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl5-ref' }]);
  },
  'mut-refFields:fl6:[ref, data, weirdFormat] Should accept strings with weird formats as string': async ({
    mutate,
  }) => {
    await mutate({ $entity: 'FlexRef', id: 'bench-fl6-ref', reference: 'abc:123:xyz' }, { noMetadata: true });
    await mutate([{ $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl6-ref' }]);
  },

  // --- Missing Queries ---
  /* 'TODO{TS}:nf2a[nested, $filters] Nested filter for array of ids': async ({ query }) => {
    // Stub test - no query defined in original
  }, */
  '[entity,nested, filter] - $filter on children property': async ({ query }) => {
    await query({
      $entity: 'User',
      $filter: { account: { provider: { $eq: 'github' } } },
      $fields: ['name'],
    });
  },
  '[entity,nested,filter] - Simplified filter': async ({ query }) => {
    await query({
      $entity: 'User',
      $filter: { account: { provider: 'github' } },
      $fields: ['name'],
    });
  },
  '[entity,array,includes] - filter by field of cardinality many, type text: includes one ': async ({ query }) => {
    await query({
      $entity: 'post',
      $filter: { mentions: { $includes: '@antoine' } },
      $fields: ['id'],
    });
  },
  '[entity,array,includesAll] - filter by field of cardinality many, type text: includes all ': async ({ query }) => {
    await query({
      $entity: 'post',
      $filter: { mentions: { $includesAll: ['@Antoine', '@Loic'] } },
      $fields: ['id'],
    });
  },
  '[entity,array,includesAny] filter by field of cardinality many, type text: includes any ': async ({ query }) => {
    await query({
      $entity: 'post',
      $filter: { mentions: { $includesAny: ['@Antoine', '@Loic'] } },
      $fields: ['id'],
    });
  },
  '[entity,includesAny,error] using array filter includesAny on cardinality=ONE error': async ({ query }) => {
    try {
      await query({
        $entity: 'User',
        $filter: { name: { $includesAny: ['x', 'y'] } },
      });
    } catch {
      // Expected error
    }
  },
  '[entity,includesAll, error] using array filter includesAll on cardinality=ONE error': async ({ query }) => {
    try {
      await query({
        $entity: 'User',
        $filter: { name: { $includesAll: ['x', 'y'] } },
      });
    } catch {
      // Expected error
    }
  },
  '[entity,filter,not] - filter by field': async ({ query }) => {
    await query({
      $entity: 'User',
      $filter: { $not: { id: 'user1' } },
      $fields: ['id'],
    });
  },
  '[entity,filter,not,array,includes] filter item cardinality many': async ({ query }) => {
    await query({
      $entity: 'post',
      $filter: { mentions: { $not: { $includes: '@Antoine' } } },
      $fields: ['id'],
    });
  },
  '[entity,OR] or filter two different fields': async ({ query }) => {
    await query({
      $entity: 'User',
      // @ts-expect-error - TODO: This is valid syntax but requires refactoring the filters
      $filter: [{ name: 'Loic' }, { email: 'antoine@test.com' }],
      $fields: ['name'],
    });
  },

  // --- Missing Basic Mutations ---
  'mut-basic:TODO{T}:r2[create] Basic roleFields link unlink': async ({ mutate }) => {
    await mutate(
      {
        $thing: 'UserTag',
        id: 'bench-b0b-ut1',
        users: [
          { $thing: 'User', id: 'bench-b0b-u1', name: 'bo-u1' },
          { $thing: 'User', id: 'bench-b0b-u2', name: 'bo-u2' },
          { $thing: 'User', id: 'bench-b0b-u3', name: 'bo-u3' },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'UserTag',
        $id: 'bench-b0b-ut1',
        users: [{ $op: 'unlink' }],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'UserTag',
        $id: 'bench-b0b-ut1',
        users: [{ $op: 'link', $id: ['bench-b0b-u1', 'bench-b0b-u2'] }],
      },
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'User', $op: 'delete', $id: ['bench-b0b-u1', 'bench-b0b-u2', 'bench-b0b-u3'] },
      { $relation: 'UserTag', $op: 'delete', $id: 'bench-b0b-ut1' },
    ]);
  },
  'mut-basic:TODO{T}:l1[direct linkField] Basic linkField': async ({ mutate }) => {
    await mutate(
      {
        $thing: 'User',
        id: 'bench-l1-u1',
        'user-tags': [
          { id: 'bench-l1-utg1', name: 'l1-utg1' },
          { id: 'bench-l1-utg2', name: 'l1-utg2' },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'User',
        $id: 'bench-l1-u1',
        'user-tags': [{ id: 'bench-l1-utg3', name: 'l1-utg3' }],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'User',
        $id: 'bench-l1-u1',
        'user-tags': [{ $op: 'update', name: 'allRenamed' }],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'User',
        $id: 'bench-l1-u1',
        'user-tags': [{ $id: ['bench-l1-utg1'], $op: 'unlink' }],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $thing: 'User',
        $id: 'bench-l1-u1',
        'user-tags': [{ $op: 'delete' }],
      },
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'User', $op: 'delete', $id: 'bench-l1-u1' },
      { $relation: 'UserTag', $op: 'delete', $id: 'bench-l1-utg1' },
    ]);
  },
  'mut-basic:b1b[create, update] Create a thing with an empty JSON attribute, then update it': async ({ mutate }) => {
    await mutate({ $thing: 'Account', id: 'bench-b1b-empty-json' }, { noMetadata: false });
    await mutate({ $thing: 'Account', $id: 'bench-b1b-empty-json', profile: { hobby: ['Running'] } });
    await mutate({ $thing: 'Account', $op: 'delete', $id: 'bench-b1b-empty-json' });
  },
  'mut-basic:b1b[create, update] Create a thing with a JSON attribute, then update it': async ({ mutate }) => {
    await mutate({ $thing: 'Account', id: 'bench-b1b-json', profile: { hobby: ['Running'] } });
    await mutate({ $thing: 'Account', $id: 'bench-b1b-json', profile: { hobby: ['Running', 'Hiking'] } });
    await mutate({ $thing: 'Account', $op: 'delete', $id: 'bench-b1b-json' });
  },
  'mut-basic:b1b[create] Create a nested thing with a JSON attribute': async ({ mutate }) => {
    await mutate({
      $thing: 'User',
      id: 'bench-b1b-user1',
      accounts: [{ $thing: 'Account', id: 'bench-b1b-account1', profile: { hobby: ['Running'] } }],
    });
    await mutate({ $thing: 'User', $op: 'delete', $id: 'bench-b1b-user1', accounts: [{ $op: 'delete' }] });
  },
  'mut-basic:b3rn[delete, relation, nested] Basic': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'User-Accounts',
        id: 'bench-b3rn-r1',
        user: {
          $thing: 'User',
          id: 'bench-b3rn-u2',
          email: 'hey',
          'user-tags': [
            { id: 'bench-b3rn-ustag1', color: { id: 'bench-b3rn-pink' } },
            { id: 'bench-b3rn-ustag2', color: { id: 'bench-b3rn-gold' } },
            { id: 'bench-b3rn-ustag3', color: { id: 'bench-b3rn-silver' } },
          ],
        },
        accounts: [{ id: 'bench-b3rn-a2' }],
      },
      { preQuery: true },
    );
    await mutate({
      $relation: 'User-Accounts',
      $id: 'bench-b3rn-r1',
      user: {
        $op: 'update',
        'user-tags': [
          { $id: 'bench-b3rn-ustag1', color: { $op: 'delete' } },
          { $id: 'bench-b3rn-ustag2', color: { $op: 'delete' } },
        ],
      },
    });
    await mutate({
      $relation: 'User-Accounts',
      $id: 'bench-b3rn-r1',
      user: {
        $op: 'update',
        'user-tags': [
          { $id: 'bench-b3rn-ustag3', $op: 'delete', color: { $op: 'delete' } },
          { $id: 'bench-b3rn-ustag2', $op: 'delete' },
        ],
      },
    });
    await mutate([
      { $entity: 'User', $op: 'delete', $id: 'bench-b3rn-u2' },
      { $entity: 'Account', $op: 'delete', $id: 'bench-b3rn-a2' },
      { $relation: 'UserTag', $op: 'delete', $id: 'bench-b3rn-ustag1' },
    ]);
  },
  'mut-basic:b4.2[create, link] Create all then link': async ({ mutate }) => {
    await mutate(
      { $entity: 'User', id: 'bench-b42-user', name: 'Jill', email: 'jill@test.com' },
      { noMetadata: true, preQuery: true },
    );
    await mutate(
      [
        { $entity: 'Space', id: 'bench-b42-sp3', name: 'Space 3' },
        { $entity: 'Space', id: 'bench-b42-sp4', name: 'Space 4' },
      ],
      { noMetadata: true, preQuery: true },
    );
    await mutate(
      {
        $entity: 'User',
        $id: 'bench-b42-user',
        spaces: [
          { $id: 'bench-b42-sp3', $op: 'link' },
          { $id: 'bench-b42-sp4', $op: 'link' },
        ],
      },
      { noMetadata: true, preQuery: true },
    );
    await mutate([
      { $entity: 'User', $id: 'bench-b42-user', $op: 'delete' },
      { $entity: 'Space', $id: 'bench-b42-sp3', $op: 'delete' },
      { $entity: 'Space', $id: 'bench-b42-sp4', $op: 'delete' },
    ]);
  },
  'mut-basic:TODO{T}:b4.3[update, link] Link ALL (without ids)': async ({ mutate }) => {
    await mutate({ $entity: 'Space', id: 'bench-b43-Space' }, { noMetadata: true });
    await mutate({ $entity: 'Space', $id: 'bench-b43-Space', users: [{ $op: 'link' }] }, { noMetadata: true });
    await mutate({ $entity: 'Space', $id: 'bench-b43-Space', $op: 'delete' }, { noMetadata: true });
  },
  /* 'mut-basic:TODO{TS}:b4.4[create, link] Create and link ALL at once (without ids)': async ({ mutate }) => {
    await mutate(
      { $entity: 'Space', id: 'bench-b44-Space', users: [{ $op: 'link' }] },
      { noMetadata: true },
    );
    await mutate({ $entity: 'Space', $id: 'bench-b44-Space', $op: 'delete' }, { noMetadata: true });
  }, */
  'mut-basic:b6.2[create, default id] Create without id': async ({ mutate, query }) => {
    await mutate([{ $entity: 'Space', $id: 'space-3', kinds: [{ name: 'bench-b6-k' }] }]);
    const res = await query(
      { $relation: 'Kind', $filter: { name: 'bench-b6-k' }, $fields: ['id', 'name'] },
      { noMetadata: true },
    );
    const kindId = (res as any)?.[0]?.id;
    if (kindId) {
      await mutate({ $relation: 'Kind', $id: kindId, $op: 'delete' });
    }
  },
  'mut-basic:b8[create, multiple, date] Next-auth example ': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'Session',
        user: 'user1',
        sessionToken: 'bench-session-token',
        expires: new Date('2023-06-10T14:58:09.066Z'),
      },
      { noMetadata: true },
    );
    await mutate({ $entity: 'Session', $op: 'delete', $filter: { sessionToken: 'bench-session-token' } });
  },
  'mut-basic:mv1[create, multiVal] ': async ({ mutate }) => {
    await mutate(
      [
        { $thing: 'Color', id: 'bench-numberColor', freeForAll: 12 },
        { $thing: 'Color', id: 'bench-stringColor', freeForAll: 'hello' },
        { $thing: 'Color', id: 'bench-dateColor', freeForAll: new Date('2023-06-10T14:58:09.066Z') },
      ],
      { noMetadata: true },
    );
    await mutate({
      $thing: 'Color',
      $op: 'delete',
      $id: ['bench-numberColor', 'bench-stringColor', 'bench-dateColor'],
    });
  },
  'mut-basic:mv2[create, edit] ': async ({ mutate }) => {
    await mutate(
      [
        { $thing: 'Color', $id: 'yellow', $op: 'update', freeForAll: 13 },
        { $thing: 'Color', $id: 'red', $op: 'update', freeForAll: 'bye' },
        { $thing: 'Color', $id: 'blue', $op: 'update', freeForAll: new Date('2023-06-10T14:58:09.066Z') },
      ],
      { noMetadata: true },
    );
  },
  'mut-basic:mv3[create, multiVal, specialChars] ': async ({ mutate }) => {
    await mutate({ $thing: 'Color', id: 'bench-mv3', freeForAll: "it's" }, { noMetadata: true });
    await mutate({ $thing: 'Color', $op: 'delete', $id: 'bench-mv3' });
  },
  'mut-basic:n2[create, nested] nested, self referenced': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'Kind',
        id: 'bench-n2-kind-1',
        name: 'myTestKind1',
        space: 'space-3',
        dataFields: [
          {
            $op: 'create',
            id: 'bench-n2-field',
            name: 'myTestField',
            space: 'space-3',
            kinds: [{ $op: 'create', id: 'bench-n2-kind-2', name: 'myTestKind2', space: 'space-3' }],
          },
        ],
      },
      { noMetadata: true },
    );
    await mutate([
      { $relation: 'DataField', $op: 'delete', $id: 'bench-n2-field' },
      { $relation: 'Kind', $op: 'delete', $id: 'bench-n2-kind-1' },
      { $relation: 'Kind', $op: 'delete', $id: 'bench-n2-kind-2' },
    ]);
  },
  'mut-basic:n3[delete, nested] nested delete': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'Kind',
        id: 'bench-n3-kind-1',
        name: 'myTestKind1',
        space: 'space-3',
        dataFields: [
          {
            $op: 'create',
            id: 'bench-n3-field',
            name: 'myTestField',
            space: 'space-3',
            kinds: [{ $op: 'create', id: 'bench-n3-kind-2', name: 'myTestKind2', space: 'space-3' }],
          },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'Kind',
        $op: 'delete',
        $id: 'bench-n3-kind-1',
        dataFields: [{ $op: 'delete', kinds: [{ $op: 'delete' }] }],
      },
      { noMetadata: true },
    );
  },
  'mut-basic:TEMP:buffer': async ({ query }) => {
    await query({ $entity: 'Space' });
  },
  'mut-basic:u2[update, multiple, nested(many), noId] Update children (no id)': async ({ mutate }) => {
    await mutate(
      { $entity: 'User', $id: 'user1', spaces: [{ $op: 'update', name: 'space2ORspace1' }] },
      { noMetadata: true },
    );
    await mutate([
      { $id: 'space-2', $entity: 'Space', name: 'Dev' },
      { $id: 'space-3', $entity: 'Space', name: 'Not-owned' },
      { $id: 'space-1', $entity: 'Space', name: 'Production' },
    ]);
  },
  'mut-basic:u3[update, multiple, nested(many), noId] Update but all children (no id)': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'User',
        $id: ['user2', 'user5'],
        spaces: [{ $op: 'update', name: 'space2ORspace1Bis' }],
      },
      { noMetadata: true, preQuery: true },
    );
    await mutate([
      { $id: 'space-1', $entity: 'Space', name: 'Production' },
      { $id: 'space-2', $entity: 'Space', name: 'Dev' },
    ]);
  },
  'mut-basic:u4[update, multiple, nested(one), noId] Update all children (no id)': async ({ mutate }) => {
    await mutate(
      { $entity: 'Account', $id: 'account3-1', user: { $op: 'update', email: 'theNewEmailOfAnn@test.com' } },
      { noMetadata: true },
    );
    await mutate([{ $id: 'user3', $entity: 'User', email: 'ann@test.com' }]);
  },
  'mut-basic:ext2[rolelf, link, extended] Link linkfield target role to subtype of player': async ({ mutate }) => {
    await mutate({ $entity: 'Account', id: 'bench-a-ext2', user: { $op: 'link', $id: 'god1' } }, { noMetadata: true });
    await mutate([{ $id: 'bench-a-ext2', $entity: 'Account', $op: 'delete' }]);
  },
  'mut-basic:ext3[relationlf, link, extended] Link linkfield target relation to subtype of player': async ({
    mutate,
  }) => {
    await mutate(
      {
        $entity: 'Space',
        $id: 'space-3',
        fields: [{ id: 'bench-ext3-field', $thing: 'DataField', $op: 'create', name: 'myDataField' }],
      },
      { noMetadata: true },
    );
    await mutate([{ $id: 'bench-ext3-field', $relation: 'DataField', $op: 'delete' }]);
  },
  'mut-basic:pf1[prefix, lf] Prefixed linkfield tunnel': async ({ mutate }) => {
    await mutate(
      { $entity: 'Session', user: 'God:god1', expires: new Date('2023-06-10T14:58:09.066Z') },
      { noMetadata: true },
    );
    await mutate({ $entity: 'Session', $op: 'delete', $filter: { user: 'God:god1' } });
  },
  'mut-basic:pf2[prefix, lf, wrong] Prefixed linkfield tunnel with wrong thing': async ({ mutate }) => {
    await mutate(
      { $entity: 'Session', user: 'God:user1', id: 'bench-pf2-session', expires: new Date('2023-06-10T14:58:09.066Z') },
      { noMetadata: true },
    );
    await mutate({ $entity: 'Session', $op: 'delete', $id: 'bench-pf2-session' });
  },
  'mut-basic:pf3[prefix, lf, tempId] Prefixed linkfield tunnel with tempId': async ({ mutate }) => {
    await mutate(
      [
        { $entity: 'God', name: 'Ann', isEvil: false, power: 'walkthrough', $tempId: '_:tempUser' },
        {
          $entity: 'Session',
          user: 'God:_:tempUser',
          id: 'bench-pf3-session',
          expires: new Date('2025-06-10T14:58:09.066Z'),
        },
      ],
      { noMetadata: true },
    );
    await mutate({ $entity: 'Session', $op: 'delete', $id: 'bench-pf3-session' });
  },
  /* 'mut-basic:TODO{TS}:pf4[prefix, lf, tempId, wrong] Prefixed linkfield tunnel with tempId from wrong kind': async ({
    mutate,
  }) => {
    try {
      await mutate(
        [
          { $entity: 'User', name: 'Ann', $tempId: '_:tempUser' },
          {
            $entity: 'Session',
            user: 'God:_:tempUser',
            id: 'bench-pf4-session',
            expires: new Date('2025-06-10T14:58:09.066Z'),
          },
        ],
        { noMetadata: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-basic:TODO{TS}:pf5[prefix, lf, tempId] Prefixed linkfield tunnel with tempId': async ({ mutate }) => {
    try {
      await mutate(
        [
          { $entity: 'User', name: 'Bob', $tempId: '_:tempUser' },
          {
            $entity: 'Session',
            user: { $thing: 'God', $tempId: '_:tempUser' },
            id: 'bench-pf5-session',
            expires: new Date('2025-06-10T14:58:09.066Z'),
          },
        ],
        { noMetadata: true },
      );
    } catch {
      // Expected error
    }
  }, */
  'mut-basic:enum2[create, update, reset] Should not let reset on non nullable property': async ({ mutate }) => {
    await mutate({ $op: 'create', $entity: 'Hook', id: 'bench-enum2', requiredOption: 'b' }, { noMetadata: true });
    try {
      await mutate({ $op: 'update', $entity: 'Hook', $id: 'bench-enum2', requiredOption: null }, { noMetadata: true });
    } catch {
      // Expected error
    }
    await mutate({ $op: 'delete', $entity: 'Hook', $id: 'bench-enum2' });
  },
  'mut-edges:l2[link, nested, relation] Create and update 3-level nested. Also test getting ids by type': async ({
    mutate,
  }) => {
    await mutate(
      [
        { $entity: 'Color', $op: 'create', id: 'bench-l2-yellow' },
        { $entity: 'Color', $op: 'create', id: 'bench-l2-blue' },
      ],
      { noMetadata: true },
    );
    const mutation = (await mutate(
      {
        $entity: 'User',
        $id: 'user4',
        'user-tags': [
          {
            name: 'another tag',
            group: { color: { $id: 'bench-l2-yellow' } },
          },
          {
            name: 'yet another tag',
            group: { color: { $id: 'bench-l2-blue' } },
          },
        ],
      },
      { noMetadata: false },
    )) as Array<{ $op?: string; $thing?: string; $id?: string }> | undefined;
    const createdTagsIds = mutation
      ?.filter((obj) => obj.$op === 'create' && obj.$thing === 'UserTag')
      .map((obj) => obj.$id);
    const createdTagGroupsIds = mutation
      ?.filter((obj) => obj.$op === 'create' && obj.$thing === 'UserTagGroup')
      .map((obj) => obj.$id);
    if (createdTagsIds?.length) {
      await mutate({ $relation: 'UserTag', $id: createdTagsIds, $op: 'delete' }, { noMetadata: true });
    }
    if (createdTagGroupsIds?.length) {
      await mutate({ $relation: 'UserTagGroup', $id: createdTagGroupsIds, $op: 'delete' }, { noMetadata: true });
    }
    await mutate({ $entity: 'Color', $id: ['bench-l2-yellow', 'bench-l2-blue'], $op: 'delete' }, { noMetadata: true });
  },
  'mut-edges:l3ent[unlink, multiple, entity] unlink multiple linkFields (not roleFields)': async ({
    mutate,
    query,
  }) => {
    await mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: null,
        accounts: null,
      },
      { noMetadata: true },
    );
    await query(
      {
        $entity: 'User',
        $id: 'user2',
        $fields: ['id', 'spaces', 'accounts'],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $entity: 'User',
        $id: 'user2',
        spaces: [{ $op: 'unlink' }, { $op: 'link', $id: 'space-2' }],
        accounts: [{ $op: 'unlink' }, { $op: 'link', $id: 'account2-1' }],
      },
      { noMetadata: true },
    );
  },
  'mut-edges:l3rel[unlink, simple, relation] unlink link in relation but one role per time': async ({
    mutate,
    query,
  }) => {
    await mutate([{ $relation: 'Space-User', $id: 'u3-s2', users: null }], { noMetadata: true });
    await mutate([{ $relation: 'Space-User', $id: 'u3-s2', spaces: null }], { noMetadata: true });
    await query(
      { $relation: 'Space-User', $id: 'u3-s2', $fields: ['spaces', 'users', 'power', 'id'] },
      { noMetadata: true },
    );
    await mutate({
      $relation: 'Space-User',
      $id: 'u3-s2',
      spaces: [{ $op: 'link', $id: 'space-2' }],
      users: [{ $op: 'link', $id: 'user3' }],
    });
  },
  'mut-edges:l4[link, add, relation, nested] add link in complex relation. Also unlink test to be splitted somewhere':
    async ({ mutate, query }) => {
      await mutate({ $entity: 'User', $id: 'user3', 'user-tags': [{ $id: 'tag-3' }] }, { noMetadata: true });
      await query({ $entity: 'User', $id: 'user3', $fields: ['id', 'user-tags'] }, { noMetadata: true });
      await mutate({ $entity: 'User', $id: 'user3', 'user-tags': null }, { noMetadata: true });
      await mutate(
        { $entity: 'User', $id: 'user3', 'user-tags': [{ $op: 'link', $id: 'tag-2' }] },
        { noMetadata: true },
      );
    },
  'mut-edges:l5[unlink, nested] unlink by id': async ({ mutate, query }) => {
    await mutate(
      { $relation: 'UserTagGroup', $id: 'utg-1', tags: [{ $op: 'unlink', $id: 'tag-2' }] },
      { noMetadata: true },
    );
    await query(
      { $relation: 'UserTag', $id: 'tag-2', $fields: ['id', 'users', 'group', 'color'] },
      { noMetadata: true },
    );
    await query({ $relation: 'UserTagGroup', $id: 'utg-1', $fields: ['id', 'tags', 'color'] }, { noMetadata: true });
    await mutate(
      { $relation: 'UserTagGroup', $id: 'utg-1', tags: [{ $op: 'link', $id: 'tag-2' }] },
      { noMetadata: true },
    );
  },
  'mut-edges:l7[unlink, all, nested] unlink all from one particular role': async ({ mutate, query }) => {
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-2', tags: null }, { noMetadata: true });
    await query({ $relation: 'UserTagGroup', $id: 'utg-2' });
    await mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }],
    });
  },
  'mut-edges:l7b[unlink, all, nested] unlink all from two roles': async ({ mutate, query }) => {
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-2', tags: null, color: null }, { noMetadata: true });
    await query({ $relation: 'UserTagGroup', $id: 'utg-2' });
    await mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }],
      color: { $op: 'link', $id: 'blue' },
    });
  },
  'mut-edges:l7c[unlink, all, nested] unlink all from two roles but one is empty': async ({ mutate, query }) => {
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-2', tags: null }, { noMetadata: true });
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-2', tags: null, color: null }, { noMetadata: true });
    await query({ $relation: 'UserTagGroup', $id: 'utg-2' });
    await mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      tags: [{ $op: 'link', $id: 'tag-3' }],
      color: { $op: 'link', $id: 'blue' },
    });
  },
  'mut-edges:l9[create,relation] Create relation multiple edges. Relation without roles should disappear': async ({
    mutate,
    query,
  }) => {
    await mutate({
      $relation: 'UserTag',
      $op: 'create',
      id: 'bench-tmp-user-tag3',
      users: ['user1', 'user5', 'user3'],
    });
    await mutate(
      {
        $relation: 'UserTag',
        $id: 'bench-tmp-user-tag3',
        users: [{ $op: 'unlink', $id: ['user1', 'user3'] }],
      },
      { noMetadata: true },
    );
    await query({ $relation: 'UserTag', $id: 'bench-tmp-user-tag3', $fields: ['id', 'users'] }, { noMetadata: true });
    await mutate(
      {
        $relation: 'UserTag',
        $id: 'bench-tmp-user-tag3',
        users: [{ $op: 'unlink', $id: 'user5' }],
      },
      { noMetadata: true },
    );
    try {
      await mutate({ $relation: 'UserTag', $id: 'bench-tmp-user-tag3', $op: 'delete' });
    } catch (_e) {
      // may already be deleted
    }
  },
  'mut-edges:l10[create, link, relation] Create relation and link it to multiple existing things': async ({
    mutate,
    query,
  }) => {
    await mutate({
      $relation: 'UserTag',
      $op: 'create',
      id: 'bench-tmpTag',
      users: ['user1', 'user5', 'user3'],
      group: 'utg-1',
    });
    await query({ $relation: 'UserTag', $id: 'bench-tmpTag' }, { noMetadata: true });
    await mutate({ $relation: 'UserTag', $id: 'bench-tmpTag', $op: 'delete' });
  },
  'mut-edges:TODO{T}:l11-strict[link, replace, relation] Get existing relation and link it to multiple existing things':
    async ({ mutate, query }) => {
      await mutate({
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'bench-l11-group',
        space: { id: 'bench-tempSpace' },
        color: { id: 'bench-tempYellow' },
        tags: ['tag-1', 'tag-2'],
      });
      await mutate({
        $relation: 'UserTagGroup',
        $id: 'bench-l11-group',
        tags: ['tag-1', 'tag-4'],
        color: { $op: 'create', id: 'bench-tempBlue' },
      });
      await query({ $relation: 'UserTagGroup', $id: 'bench-l11-group' }, { noMetadata: true });
      await mutate({
        $relation: 'UserTagGroup',
        $id: 'bench-l11-group',
        color: { $op: 'delete' },
        $op: 'delete',
      });
      await mutate({
        $thing: 'Color',
        $thingType: 'entity',
        $id: 'bench-tempYellow',
        $op: 'delete',
      });
      await mutate({ $entity: 'Space', $id: 'bench-tempSpace', $op: 'delete' });
      await mutate([
        {
          $relation: 'UserTag',
          $id: ['tag-2', 'tag-1'],
          $op: 'update',
          group: { $op: 'link', $id: 'utg-1' },
        },
      ]);
    },
  'mut-edges:l13[unlink, nested, relation, extends] Unlink in nested array[l3ent,b4]': async ({ mutate, query }) => {
    await mutate({
      $entity: 'User',
      $id: 'user2',
      spaces: [
        {
          $id: 'space-2',
          dataFields: [
            {
              id: 'bench-firstDataField',
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
    await mutate({
      $entity: 'User',
      $id: 'user2',
      spaces: [
        {
          $id: 'space-2',
          dataFields: [{ $id: 'bench-firstDataField', kinds: null }],
        },
      ],
    });
    await query({ $relation: 'DataField', $id: 'bench-firstDataField' }, { noMetadata: true });
    await mutate({ $relation: 'DataField', $id: 'bench-firstDataField', $op: 'delete' });
  },
  'mut-edges:l14[unlink, nested, relation] Unlink all in role': async ({ mutate, query }) => {
    await mutate([{ $relation: 'UserTag', $id: 'tag-2', group: { $op: 'update', color: null } }], { noMetadata: true });
    await query(
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        $fields: ['color', { $path: 'group', $fields: ['id', 'color'] }],
      },
      { noMetadata: true },
    );
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-1', color: { $op: 'link', $id: 'yellow' } });
  },
  'mut-edges:l15[replace, nested, ONE, role] replace role in nested': async ({ mutate, query }) => {
    await mutate({
      $relation: 'UserTag',
      $id: 'tag-2',
      group: { $op: 'update', color: 'blue' },
    });
    await query(
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        $fields: [{ $path: 'group', $fields: ['id', 'color'] }],
      },
      { noMetadata: true },
    );
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-1', color: 'yellow' });
  },
  'mut-edges:l15b[unlink, link, nested, relation] Unlink in a nested field': async ({ mutate, query }) => {
    await mutate([
      { $relation: 'UserTagGroup', $id: 'utg-1', color: 'yellow' },
      { $relation: 'UserTagGroup', $id: 'utg-2', color: 'blue' },
    ]);
    await mutate(
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        group: { $op: 'update', color: null },
      },
      { noMetadata: true },
    );
    await query(
      {
        $relation: 'UserTag',
        $id: 'tag-2',
        $fields: ['id', { $path: 'group', $fields: ['id', 'color'] }],
      },
      { noMetadata: true },
    );
    await mutate([{ $relation: 'UserTag', $id: 'tag-2', group: { $op: 'update', color: 'red' } }], {
      noMetadata: true,
    });
    await query({ $relation: 'UserTag', $fields: ['id', { $path: 'group' }] }, { noMetadata: true });
    await mutate([
      { $relation: 'UserTagGroup', $id: 'utg-1', color: 'yellow' },
      { $relation: 'UserTagGroup', $id: 'utg-2', color: 'blue' },
    ]);
  },
  /* 'mut-edges:TODO{TS}:l16[replace, nested, create, replace] replacing nested under a create': async ({
    mutate,
    query,
  }) => {
    await mutate({
      $entity: 'Thing',
      id: 'bench-temp1',
      root: { $op: 'link', $id: 'tr10', extra: 'thing2' },
    });
    await query(
      {
        $entity: 'Thing',
        $id: 'bench-temp1',
        $fields: ['id', { $path: 'root', $fields: ['extra'] }],
      },
      { noMetadata: true },
    );
    await mutate({ $entity: 'Thing', $id: 'bench-temp1', $op: 'delete' });
  }, */
  'mut-edges:TODO{T}:l17[link] Link ONE role to MANY link field in create operation': async ({ mutate, query }) => {
    await mutate({ $entity: 'Space', $op: 'create', id: 'bench-l17-space-x' });
    await mutate([{ $relation: 'UserTagGroup', $op: 'create', id: 'bench-l17-utg-a', space: 'bench-l17-space-x' }]);
    await mutate([{ $relation: 'UserTagGroup', $op: 'create', id: 'bench-l17-utg-b', space: 'bench-l17-space-x' }]);
    await query({ $entity: 'Space', $id: 'bench-l17-space-x', $fields: ['id', 'userTagGroups'] }, { noMetadata: true });
    await mutate({ $relation: 'UserTagGroup', $id: ['bench-l17-utg-a', 'bench-l17-utg-b'], $op: 'delete' });
    await mutate({ $entity: 'Space', $id: 'bench-l17-space-x', $op: 'delete' });
  },
  'mut-edges:TODO{T}:l18[link] Link ONE role to MANY link field with update operation': async ({ mutate, query }) => {
    await mutate({ $entity: 'Space', $op: 'create', id: 'bench-l17-space-init' });
    await mutate({ $entity: 'Space', $op: 'create', id: 'bench-l17-space-x' });
    await mutate([{ $relation: 'UserTagGroup', $op: 'create', id: 'bench-l17-utg-a', space: 'bench-l17-space-init' }]);
    await mutate([{ $relation: 'UserTagGroup', $op: 'create', id: 'bench-l17-utg-b', space: 'bench-l17-space-init' }]);
    await mutate([{ $relation: 'UserTagGroup', $op: 'update', $id: 'bench-l17-utg-a', space: 'bench-l17-space-x' }]);
    await mutate([{ $relation: 'UserTagGroup', $op: 'update', $id: 'bench-l17-utg-b', space: 'bench-l17-space-x' }]);
    await query({ $entity: 'Space', $id: 'bench-l17-space-x', $fields: ['id', 'userTagGroups'] }, { noMetadata: true });
    await mutate({ $relation: 'UserTagGroup', $id: ['bench-l17-utg-a', 'bench-l17-utg-b'], $op: 'delete' });
    await mutate({ $entity: 'Space', $id: ['bench-l17-space-init', 'bench-l17-space-x'], $op: 'delete' });
  },
  'mut-edges:TODO{T}:l19[link] Link ONE link field to MANY role in create operation': async ({ mutate, query }) => {
    await mutate({ $entity: 'Hook', $op: 'create', id: 'bench-l17-main-hook', requiredOption: 'a' });
    await mutate({
      $relation: 'HookParent',
      $op: 'create',
      id: 'bench-l17-hook-parent-x',
      mainHook: 'bench-l17-main-hook',
    });
    await mutate([
      {
        $entity: 'Hook',
        $op: 'create',
        id: 'bench-l17-hook-a',
        requiredOption: 'a',
        hookParent: 'bench-l17-hook-parent-x',
      },
    ]);
    await mutate([
      {
        $entity: 'Hook',
        $op: 'create',
        id: 'bench-l17-hook-b',
        requiredOption: 'a',
        hookParent: 'bench-l17-hook-parent-x',
      },
    ]);
    await query(
      { $relation: 'HookParent', $id: 'bench-l17-hook-parent-x', $fields: ['id', 'hooks'] },
      { noMetadata: true },
    );
    await mutate({
      $entity: 'Hook',
      $id: ['bench-l17-main-hook', 'bench-l17-hook-a', 'bench-l17-hook-b'],
      $op: 'delete',
    });
    await mutate({ $relation: 'HookParent', $id: 'bench-l17-hook-parent-x', $op: 'delete' });
  },
  'mut-edges:TODO{T}:l20[link] Link ONE link field to MANY role in update operation': async ({ mutate, query }) => {
    await mutate({ $entity: 'Hook', $op: 'create', id: 'bench-l17-main-hook', requiredOption: 'a' });
    await mutate({
      $relation: 'HookParent',
      $op: 'create',
      id: 'bench-l17-hook-parent-x',
      mainHook: 'bench-l17-main-hook',
    });
    await mutate([{ $entity: 'Hook', $op: 'create', id: 'bench-l17-hook-a', requiredOption: 'a' }]);
    await mutate([{ $entity: 'Hook', $op: 'create', id: 'bench-l17-hook-b', requiredOption: 'a' }]);
    await mutate([{ $entity: 'Hook', $op: 'update', $id: 'bench-l17-hook-a', hookParent: 'bench-l17-hook-parent-x' }]);
    await mutate([{ $entity: 'Hook', $op: 'update', $id: 'bench-l17-hook-b', hookParent: 'bench-l17-hook-parent-x' }]);
    await query(
      { $relation: 'HookParent', $id: 'bench-l17-hook-parent-x', $fields: ['id', 'hooks'] },
      { noMetadata: true },
    );
    await mutate({
      $entity: 'Hook',
      $id: ['bench-l17-main-hook', 'bench-l17-hook-a', 'bench-l17-hook-b'],
      $op: 'delete',
    });
    await mutate({ $relation: 'HookParent', $id: 'bench-l17-hook-parent-x', $op: 'delete' });
  },
  /* 'mut-edges:TODO{TS}:rep2b[replace, unlink, link, many] Replace using unlink + link , all link': async ({
    mutate,
    query,
  }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-tmpUTG',
      tags: ['tag-1', 'tag-2'],
      color: 'blue',
    });
    await mutate({
      $id: 'bench-tmpUTG',
      $relation: 'UserTagGroup',
      tags: [{ $op: 'unlink' }, { $op: 'link' }],
    });
    await query({ $relation: 'UserTagGroup', $id: 'bench-tmpUTG', $fields: ['tags'] });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-tmpUTG', $op: 'delete' });
  }, */
  /* 'mut-edges:TODO{TS}:rep2c[replace, unlink, link, many] Replace using unlink + link , all link': async ({
    mutate,
    query,
  }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-tmpUTG',
      tags: ['tag-1', 'tag-2'],
      color: 'blue',
    });
    await mutate({
      $id: 'bench-tmpUTG',
      $relation: 'UserTagGroup',
      tags: [{ $op: 'link' }],
    });
    await query({ $relation: 'UserTagGroup', $id: 'bench-tmpUTG', $fields: ['tags'] });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-tmpUTG', $op: 'delete' });
  }, */
  'mut-edges:rep4[replace, multiId] Replace multiple ids': async ({ mutate, query }) => {
    await mutate([
      { $thing: 'UserTag', id: 'bench-rep4-tag1', users: [{ $thing: 'User', id: 'bench-rep4-u1' }] },
      { $thing: 'UserTag', id: 'bench-rep4-tag2', users: [{ $thing: 'User', id: 'bench-rep4-u2' }] },
      { $thing: 'User', id: 'bench-rep4-u3' },
    ]);
    await mutate({
      $thing: 'UserTag',
      $id: ['bench-rep4-tag1', 'bench-rep4-tag2'],
      users: ['bench-rep4-u3'],
    });
    await query(
      {
        $relation: 'UserTag',
        $id: ['bench-rep4-tag1', 'bench-rep4-tag2'],
        $fields: ['id', 'users'],
      },
      { noMetadata: true },
    );
    await mutate([
      { $relation: 'UserTag', $id: ['bench-rep4-tag1', 'bench-rep4-tag2'], $op: 'delete' },
      { $thing: 'User', $id: ['bench-rep4-u1', 'bench-rep4-u2', 'bench-rep4-u3'], $op: 'delete' },
    ]);
  },
  'mut-edges:rep5[replace, cardOne] Replace indirectly a card one field': async ({ mutate, query }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-utg-rep5',
      color: 'blue',
    });
    await query({ $relation: 'UserTagGroup', $id: 'utg-2', $fields: ['id', 'color'] }, { noMetadata: true });
    await query({ $thing: 'Color', $thingType: 'entity', $id: 'blue', $fields: ['group', 'id'] }, { noMetadata: true });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-utg-rep5', $op: 'delete' });
    await mutate({ $relation: 'UserTagGroup', $id: 'utg-2', color: 'blue' });
  },
  'mut-edges:TODO{T}:one1[link, cardinality one] link a cardinality one relation': async ({ mutate, query }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-utg-one1',
      tags: [{ id: 'bench-tag-one1', $op: 'create', users: ['user1'] }],
    });
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-utg-one2',
      tags: [{ $id: 'bench-tag-one1', $op: 'link' }],
    });
    await query({ $id: 'bench-tag-one1', $relation: 'UserTag', $fields: ['id', 'group'] }, { noMetadata: true });
    await mutate([
      { $relation: 'UserTagGroup', $id: ['bench-utg-one1', 'bench-utg-one2'], $op: 'delete' },
      { $relation: 'UserTag', $id: 'bench-tag-one1', $op: 'delete' },
    ]);
  },
  /* 'mut-edges:TODO{TS}:h1[unlink, hybrid] hybrid intermediary relation and direct relation': async ({
    mutate,
    query,
  }) => {
    await mutate([
      {
        $entity: 'User',
        id: 'bench-h1-user',
        accounts: [{ id: 'bench-h1-account1' }],
      },
      { $entity: 'Account', id: 'bench-h1-account2' },
      { $entity: 'Account', id: 'bench-h1-account3' },
    ]);
    await mutate({
      $relation: 'User-Accounts',
      id: 'bench-h1-user-account1and3',
      user: 'bench-h1-user',
      accounts: ['bench-h1-account2', 'bench-h1-account3'],
    });
    await mutate({
      $entity: 'User',
      $id: 'bench-h1-user',
      accounts: [{ $op: 'unlink', $id: 'bench-h1-account3' }],
    });
    await query({
      $thing: 'User',
      $thingType: 'entity',
      $id: 'bench-h1-user',
      $fields: ['accounts'],
    });
    await mutate([
      { $entity: 'User', $op: 'delete', $id: 'bench-h1-user' },
      { $entity: 'Account', $op: 'delete', $id: 'bench-h1-account1' },
      { $entity: 'Account', $op: 'delete', $id: 'bench-h1-account2' },
      { $entity: 'Account', $op: 'delete', $id: 'bench-h1-account3' },
    ]);
  }, */
  /* 'mut-edges:TODO{TS}:h2[link, hybrid] hybrid intermediary relation and direct relation': async ({
    mutate,
    query,
  }) => {
    await mutate([
      { $entity: 'Account', id: 'account-ml2' },
      { $entity: 'Account', id: 'account-ml2' },
      { $entity: 'Account', id: 'account-ml2' },
    ]);
    await mutate({
      $relation: 'User-Accounts',
      id: 'bench-user-ml1-account-ml1',
      user: 'user-ml1',
      accounts: ['account-ml1', 'account-ml3'],
    });
    await mutate({
      $entity: 'User',
      $id: 'user-ml1',
      accounts: [{ $op: 'unlink', $id: 'account-ml3' }],
    });
    await query({ $entity: 'User', $id: 'user-ml1', $fields: ['accounts'] });
    await mutate({ $relation: 'User-Accounts', $id: 'bench-user-ml1-account-ml1', $op: 'delete' });
  }, */
  'mut-edges:lm-i2[link and unlink many] linking and unlinking many things at once with intermediary, batched, on-create':
    async ({ mutate, query }) => {
      await mutate({
        $entity: 'User',
        id: 'bench-ul-many-2',
        spaces: [{ $op: 'link', $id: ['space-1', 'space-2', 'space-3'] }],
      });
      await query({ $entity: 'User', $id: 'bench-ul-many-2', $fields: ['spaces', 'id'] });
      await mutate({
        $entity: 'User',
        $id: 'bench-ul-many-2',
        spaces: [{ $op: 'unlink', $id: ['space-1', 'space-2'] }],
      });
      await query({ $entity: 'User', $id: 'bench-ul-many-2', $fields: ['spaces'] });
      await mutate({ $entity: 'User', $id: 'bench-ul-many-2', $op: 'delete' });
    },
  'mut-edges:lm-i3[link and unlink many, intermediary] linking and unlinking many things at once with intermediary, not batched, pre-created':
    async ({ mutate, query }) => {
      await mutate({ $entity: 'User', id: 'bench-ul-many-3' });
      await mutate({
        $entity: 'User',
        $id: 'bench-ul-many-3',
        spaces: [
          { $op: 'link', $id: 'space-1' },
          { $op: 'link', $id: 'space-2' },
          { $op: 'link', $id: 'space-3' },
        ],
      });
      await query({ $entity: 'User', $id: 'bench-ul-many-3', $fields: ['spaces', 'id'] });
      await mutate({
        $entity: 'User',
        $id: 'bench-ul-many-3',
        spaces: [
          { $op: 'unlink', $id: 'space-1' },
          { $op: 'unlink', $id: 'space-2' },
        ],
      });
      await query({ $entity: 'User', $id: 'bench-ul-many-3', $fields: ['spaces'] });
      await mutate({ $entity: 'User', $id: 'bench-ul-many-3', $op: 'delete' });
    },
  'mut-edges:lm-i4[link and unlink many, intermediary] linking and unlinking many things at once batched with intermediary, batched, pre-created':
    async ({ mutate, query }) => {
      await mutate({ $entity: 'User', id: 'bench-ul-many-4' });
      await mutate({
        $entity: 'User',
        $id: 'bench-ul-many-4',
        spaces: [{ $op: 'link', $id: ['space-1', 'space-2', 'space-3'] }],
      });
      await query({ $entity: 'User', $id: 'bench-ul-many-4', $fields: ['spaces', 'id'] });
      await mutate({
        $entity: 'User',
        $id: 'bench-ul-many-4',
        spaces: [{ $op: 'unlink', $id: ['space-1', 'space-2'] }],
      });
      await query({ $entity: 'User', $id: 'bench-ul-many-4', $fields: ['spaces', 'id'] });
      await mutate({ $entity: 'User', $id: 'bench-ul-many-4', $op: 'delete' });
    },
  'mut-edges:lm-ni1[link and unlink many] linking and unlinking many things at once without intermediary, not batched, on-create':
    async ({ mutate, query }) => {
      await mutate([
        { $relation: 'Kind', id: 'bench-k1', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k2', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k3', space: 'space-1' },
      ]);
      await mutate({
        $relation: 'Field',
        id: 'bench-link-many-1',
        kinds: [
          { $op: 'link', $id: 'bench-k1' },
          { $op: 'link', $id: 'bench-k2' },
          { $op: 'link', $id: 'bench-k3' },
        ],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-1', $fields: ['kinds', 'id'] });
      await mutate({
        $relation: 'Field',
        $id: 'bench-link-many-1',
        kinds: [
          { $op: 'unlink', $id: 'bench-k1' },
          { $op: 'unlink', $id: 'bench-k2' },
        ],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-1', $fields: ['kinds', 'id'] });
      await mutate({ $relation: 'Field', $id: 'bench-link-many-1', $op: 'delete' });
      await mutate([
        { $relation: 'Kind', $id: 'bench-k1', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k2', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k3', $op: 'delete' },
      ]);
    },
  'mut-edges:lm-ni2[link and unlink many] linking and unlinking many things at once without intermediary, batched, on-create':
    async ({ mutate, query }) => {
      await mutate([
        { $relation: 'Kind', id: 'bench-k1', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k2', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k3', space: 'space-1' },
      ]);
      await mutate({
        $relation: 'Field',
        id: 'bench-link-many-2',
        kinds: [{ $op: 'link', $id: ['bench-k1', 'bench-k2', 'bench-k3'] }],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-2', $fields: ['kinds', 'id'] });
      await mutate({
        $relation: 'Field',
        $id: 'bench-link-many-2',
        kinds: [{ $op: 'unlink', $id: ['bench-k1', 'bench-k2'] }],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-2', $fields: ['kinds', 'id'] });
      await mutate({ $relation: 'Field', $id: 'bench-link-many-2', $op: 'delete' });
      await mutate([
        { $relation: 'Kind', $id: 'bench-k1', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k2', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k3', $op: 'delete' },
      ]);
    },
  'mut-edges:lm-ni3[link and unlink many] linking and unlinking many things at once without intermediary, not batched, pre-created':
    async ({ mutate, query }) => {
      await mutate([
        { $relation: 'Kind', id: 'bench-k1', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k2', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k3', space: 'space-1' },
      ]);
      await mutate({ $relation: 'Field', id: 'bench-link-many-3', space: 'space-1' });
      await mutate({
        $relation: 'Field',
        $id: 'bench-link-many-3',
        kinds: [
          { $op: 'link', $id: 'bench-k1' },
          { $op: 'link', $id: 'bench-k2' },
          { $op: 'link', $id: 'bench-k3' },
        ],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-3', $fields: ['kinds', 'id'] });
      await mutate({
        $relation: 'Field',
        $id: 'bench-link-many-3',
        kinds: [
          { $op: 'unlink', $id: 'bench-k1' },
          { $op: 'unlink', $id: 'bench-k2' },
        ],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-3', $fields: ['kinds', 'id'] });
      await mutate({ $relation: 'Field', $id: 'bench-link-many-3', $op: 'delete' });
      await mutate([
        { $relation: 'Kind', $id: 'bench-k1', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k2', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k3', $op: 'delete' },
      ]);
    },
  'mut-edges:lm-ni4[link and unlink many] linking and unlinking many things at once without intermediary, batched, pre-created':
    async ({ mutate, query }) => {
      await mutate([
        { $relation: 'Kind', id: 'bench-k1', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k2', space: 'space-1' },
        { $relation: 'Kind', id: 'bench-k3', space: 'space-1' },
      ]);
      await mutate({ $relation: 'Field', id: 'bench-link-many-4', space: 'space-1' });
      await mutate({
        $relation: 'Field',
        $id: 'bench-link-many-4',
        kinds: [{ $op: 'link', $id: ['bench-k1', 'bench-k2', 'bench-k3'] }],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-4', $fields: ['kinds', 'id'] });
      await mutate({
        $relation: 'Field',
        $id: 'bench-link-many-4',
        kinds: [{ $op: 'unlink', $id: ['bench-k1', 'bench-k2'] }],
      });
      await query({ $relation: 'Field', $id: 'bench-link-many-4', $fields: ['kinds', 'id'] });
      await mutate({ $relation: 'Field', $id: 'bench-link-many-4', $op: 'delete' });
      await mutate([
        { $relation: 'Kind', $id: 'bench-k1', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k2', $op: 'delete' },
        { $relation: 'Kind', $id: 'bench-k3', $op: 'delete' },
      ]);
    },
  'mut-edges:d-pq2[delete with pre query, intermediary, nested] delete mutation from root and delete children with intermediary':
    async ({ mutate, query }) => {
      await mutate([
        {
          $entity: 'User',
          id: 'bench-delete-test',
          spaces: [
            {
              id: 'bench-d-space-2',
              dataFields: [
                {
                  id: 'bench-d-dataField-1',
                  values: [{ id: 'bench-d-dataValue-1' }],
                  expression: { id: 'bench-d-expression-1' },
                },
                { id: 'bench-d-dataField-2' },
              ],
            },
          ],
        },
      ]);
      await mutate({
        $entity: 'User',
        $id: 'bench-delete-test',
        spaces: [
          {
            $id: 'bench-d-space-2',
            dataFields: [
              {
                $op: 'delete',
                $id: 'bench-d-dataField-2',
                values: [{ $op: 'delete' }],
                expression: { $op: 'delete' },
              },
            ],
          },
        ],
      });
      await query({
        $entity: 'User',
        $id: 'bench-delete-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              { $path: 'dataFields', $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'] },
            ],
          },
        ],
      });
      await mutate({
        $entity: 'User',
        $id: 'bench-delete-test',
        $op: 'delete',
        spaces: [
          {
            $id: 'bench-d-space-2',
            $op: 'delete',
            dataFields: [{ $op: 'delete', values: [{ $op: 'delete' }], expression: { $op: 'delete' } }],
          },
        ],
      });
    },
  /* 'mut-edges:TODO{TS}:d-pq3[delete with pre query, intermediary, nested, nothing to delete] delete mutation from root and delete children but there are no children with intermediary': async ({
    mutate,
    query,
  }) => {
    await mutate([
      {
        $entity: 'User',
        id: 'bench-delete-test3',
        spaces: [
          {
            id: 'bench-d-space-1',
            dataFields: [{ id: 'bench-d-dataField-1' }],
          },
        ],
      },
    ]);
    await mutate({
      $entity: 'User',
      $id: 'bench-delete-test3',
      spaces: [
        {
          $id: 'bench-d-space-1',
          dataFields: [
            {
              $id: 'bench-d-dataField-1',
              expression: { $op: 'delete' },
              values: [{ $op: 'delete' }],
            },
          ],
        },
      ],
    });
    await query({
      $entity: 'User',
      $id: 'bench-delete-test3',
      $fields: [
        'id',
        {
          $path: 'spaces',
          $fields: [
            'id',
            { $path: 'dataFields', $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'] },
          ],
        },
      ],
    });
    await mutate({
      $entity: 'User',
      $id: 'bench-delete-test3',
      $op: 'delete',
      spaces: [
        {
          $id: 'bench-d-space-1',
          $op: 'delete',
          dataFields: [{ $op: 'delete', values: [{ $op: 'delete' }] }],
        },
      ],
    });
  }, */
  'mut-edges:ul-pq1[unlink with pre query, intermediary, nested] unlink mutation from root and delete children with intermediary':
    async ({ mutate, query }) => {
      await mutate([
        {
          $entity: 'User',
          id: 'bench-unlink-test',
          spaces: [
            {
              id: 'bench-ul-space-1',
              dataFields: [
                {
                  id: 'bench-ul-dataField-1',
                  values: [{ id: 'bench-ul-dataValue-1' }],
                  expression: { $op: 'create', id: 'bench-ul-expression-1' },
                },
                { id: 'bench-ul-dataField-2', values: [{ id: 'bench-ul-dataValue-2' }] },
                { id: 'bench-ul-dataField-3', expression: { $op: 'create', id: 'bench-ul-expression-2' } },
                { id: 'bench-ul-dataField-4' },
              ],
            },
          ],
        },
      ]);
      await mutate({
        $entity: 'User',
        $id: 'bench-unlink-test',
        spaces: [
          {
            $id: 'bench-ul-space-1',
            dataFields: [
              {
                $op: 'unlink',
                values: [{ $op: 'unlink' }],
                expression: { $op: 'unlink' },
              },
            ],
          },
        ],
      });
      await query({
        $entity: 'User',
        $id: 'bench-unlink-test',
        $fields: [
          'id',
          {
            $path: 'spaces',
            $fields: [
              'id',
              { $path: 'dataFields', $fields: ['id', { $path: 'values', $fields: ['id'] }, 'expression'] },
            ],
          },
        ],
      });
      await mutate([
        {
          $entity: 'User',
          $id: 'bench-unlink-test',
          $op: 'delete',
          spaces: [{ $id: 'bench-ul-space-1', $op: 'delete' }],
        },
      ]);
    },
  'mut-edges:up-pq1[update with pre query, intermediary, nested] update mutation from root and delete children with intermediary':
    async ({ mutate, query }) => {
      await mutate([
        {
          $entity: 'User',
          id: 'bench-update-test',
          spaces: [
            {
              id: 'bench-up-space-1',
              dataFields: [
                {
                  id: 'bench-up-dataField-1',
                  values: [{ id: 'bench-up-dataValue-1' }],
                  expression: { $op: 'create', id: 'bench-up-expression-1' },
                },
                { id: 'bench-up-dataField-2', values: [{ id: 'bench-up-dataValue-2' }] },
                { id: 'bench-up-dataField-3', expression: { $op: 'create', id: 'bench-up-expression-2' } },
                { id: 'bench-up-dataField-4' },
              ],
            },
          ],
        },
      ]);
      await mutate({
        $entity: 'User',
        $id: 'bench-update-test',
        spaces: [
          {
            $id: 'bench-up-space-1',
            dataFields: [
              {
                $op: 'update',
                type: 'test-type',
                values: [{ $op: 'update', type: 'test-type' }],
                expression: { $op: 'update', value: 'test-value' },
              },
            ],
          },
        ],
      });
      await query({
        $entity: 'User',
        $id: 'bench-update-test',
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
      await mutate([
        {
          $entity: 'User',
          $id: 'bench-update-test',
          $op: 'delete',
          spaces: [
            {
              $id: 'bench-up-space-1',
              $op: 'delete',
              dataFields: [{ $op: 'delete', values: [{ $op: 'delete' }], expression: { $op: 'delete' } }],
            },
          ],
        },
      ]);
    },
  'mut-edges:TODO:m1[Multi] Multi nested, deletion and creation same brach': async ({ mutate, query }) => {
    await mutate(
      {
        $relation: 'UserTagGroup',
        id: 'bench-m1-utg1',
        tags: [
          {
            id: 'bench-m1-tag1',
            users: [
              { $thing: 'User', id: 'bench-m1-user1' },
              { $thing: 'User', id: 'bench-m1-user2' },
            ],
          },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'bench-m1-utg1',
        tags: [
          {
            $id: 'bench-m1-tag1',
            users: [{ $op: 'delete' }, { $thing: 'User', id: 'bench-m1-user3' }],
          },
        ],
      },
      { noMetadata: true },
    );
    await query(
      {
        $relation: 'UserTagGroup',
        $id: 'bench-m1-utg1',
        $fields: ['id', { $path: 'tags', $fields: ['id', 'users'] }],
      },
      { noMetadata: true },
    );
    await mutate([
      { $relation: 'UserTag', $id: 'bench-m1-tag1', $op: 'delete' },
      { $thing: 'User', $id: 'bench-m1-user3', $op: 'delete' },
      { $relation: 'UserTagGroup', $id: 'bench-m1-utg1', $op: 'delete' },
    ]);
  },
  'mut-edges:m2[Multi, deep] Multi nested, deletion and creation same brach. Deep': async ({ mutate, query }) => {
    await mutate(
      {
        $relation: 'UserTagGroup',
        id: 'bench-m2-utg1',
        tags: [
          {
            id: 'bench-m2-tag1',
            users: [
              { $thing: 'User', id: 'bench-m2-user1', accounts: [{ id: 'bench-m2-acc1', provider: 'github' }] },
              {
                $thing: 'User',
                id: 'bench-m2-user2',
                accounts: [
                  { id: 'bench-m2-acc2', provider: 'facebook' },
                  { id: 'bench-m2-acc3', provider: 'google' },
                ],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'bench-m2-utg1',
        tags: [
          {
            $id: 'bench-m2-tag1',
            users: [
              { $op: 'delete', accounts: [{ $op: 'delete' }] },
              { $thing: 'User', id: 'bench-m2-user3', accounts: [{ id: 'bench-m2-acc4', provider: 'twitter' }] },
            ],
          },
        ],
      },
      { noMetadata: true },
    );
    await query(
      {
        $relation: 'UserTagGroup',
        $id: 'bench-m2-utg1',
        $fields: ['id', { $path: 'tags', $fields: ['id', { $path: 'users', $fields: ['id', 'accounts'] }] }],
      },
      { noMetadata: true },
    );
    await mutate([
      { $relation: 'UserTag', $id: 'bench-m2-tag1', $op: 'delete' },
      { $entity: 'Account', $id: 'bench-m2-acc4', $op: 'delete' },
      { $thing: 'User', $id: 'bench-m2-user3', $op: 'delete' },
      { $relation: 'UserTagGroup', $id: 'bench-m2-utg1', $op: 'delete' },
    ]);
  },
  /* 'mut-edges:TODO{TS}:m3[Multi, deep] Multi nested, deletion and creation same brach. Deeper!': async ({
    mutate,
    query,
  }) => {
    await mutate(
      {
        $relation: 'UserTagGroup',
        id: 'bench-m3-utg1',
        tags: [
          {
            id: 'bench-m3-tag1',
            users: [
              {
                id: 'bench-m3-user1',
                spaces: [
                  {
                    id: 'bench-m3-sp1',
                    fields: [
                      {
                        id: 'bench-m3-f1',
                        kinds: [
                          { id: 'bench-m3-k1', space: { id: 'bench-m3-sp3' } },
                          { id: 'bench-m3-k2', space: { id: 'bench-m3-sp4' } },
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
    await mutate(
      {
        $relation: 'UserTagGroup',
        $id: 'bench-m3-utg1',
        tags: [
          {
            $id: 'bench-m3-tag1',
            users: [
              {
                $op: 'delete',
                spaces: [{ $op: 'delete', fields: [{ $op: 'delete', kinds: [{ $op: 'delete' }] }] }],
              },
              {
                id: 'bench-m3-user2',
                spaces: [
                  {
                    id: 'bench-m3-sp2',
                    fields: [
                      {
                        id: 'bench-m3-f2',
                        kinds: [{ id: 'bench-m3-k3', space: { $id: 'bench-m3-sp3', $op: 'link' } }],
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
    await query(
      {
        $relation: 'UserTagGroup',
        $id: 'bench-m3-utg1',
        $fields: [
          'id',
          {
            $path: 'tags',
            $fields: [
              'id',
              {
                $path: 'users',
                $fields: [
                  'id',
                  { $path: 'spaces', $fields: ['id', { $path: 'fields', $fields: ['id', 'kinds'] }] },
                ],
              },
            ],
          },
        ],
      },
      { noMetadata: true },
    );
    await mutate([
      { $relation: 'Kind', $id: 'bench-m3-k3', $op: 'delete' },
      { $relation: 'Field', $id: 'bench-m3-f2', $op: 'delete' },
      { $entity: 'Space', $id: ['bench-m3-sp2', 'bench-m3-sp3', 'bench-m3-sp4'], $op: 'delete' },
      { $thing: 'User', $id: 'bench-m3-user2', $op: 'delete' },
      { $relation: 'UserTag', $id: 'bench-m3-tag1', $op: 'delete' },
      { $relation: 'UserTagGroup', $id: 'bench-m3-utg1', $op: 'delete' },
    ]);
  }, */

  // --- Missing Batched Mutations ---
  'mut-batched:c0-rf[link, create, roleField] Simple tempIds': async ({ mutate }) => {
    await mutate([
      {
        $relation: 'UserTag',
        id: 'bench-c0-tag',
        group: [{ $op: 'link', $tempId: '_:bench-group-c0' }],
        users: [{ $thing: 'User', name: 'bench-c0-rf-user' }],
      },
      {
        $tempId: '_:bench-group-c0',
        $op: 'create',
        $relation: 'UserTagGroup',
      },
    ]);
    await mutate([
      {
        $relation: 'UserTag',
        $id: 'bench-c0-tag',
        $op: 'delete',
        users: [{ $op: 'delete' }],
        group: [{ $op: 'delete' }],
      },
    ]);
  },
  'mut-batched:c1r[multi, create, link] nested tempIds in relation': async ({ mutate }) => {
    const res = await mutate([
      { $relation: 'UserTagGroup', $op: 'create', $tempId: '_:bench-utg1' },
      {
        $relation: 'UserTag',
        name: 'hey',
        users: [{ $thing: 'User', name: 'bench-toDelete' }],
        group: { $tempId: '_:bench-utg1', $op: 'link' },
      },
    ]);
    const utg1Id = (res as Array<{ $tempId?: string; id?: string }>)?.find((r) => r.$tempId === '_:bench-utg1')?.id;
    if (utg1Id) {
      await mutate([
        { $relation: 'UserTagGroup', $id: utg1Id, $op: 'delete' },
        { $entity: 'User', $filter: { name: 'bench-toDelete' }, $op: 'delete' },
      ]);
    }
  },
  'mut-batched:c2r[multi, create, link] nested tempIds in relation': async ({ mutate }) => {
    const res = await mutate([
      {
        $relation: 'UserTagGroup',
        $tempId: '_:bench-utg1',
        $op: 'create',
        color: { id: 'bench-c2r-darkGreen' },
        tags: [{ id: 'bench-c2r-tggege', users: [{ $op: 'create', $thing: 'User', $tempId: '_:bench-us' }] }],
      },
      {
        $relation: 'UserTag',
        id: 'bench-c2r-deletableTag',
        name: 'hey',
        users: [{ $tempId: '_:bench-us', $op: 'link', $thing: 'User' }],
        group: { $tempId: '_:bench-utg1', $op: 'link', $thing: 'UserTagGroup' },
      },
    ]);
    const usId = (res as Array<{ $tempId?: string; id?: string }>)?.find((r) => r.$tempId === '_:bench-us')?.id;
    const utg1Id = (res as Array<{ $tempId?: string; id?: string }>)?.find((r) => r.$tempId === '_:bench-utg1')?.id;
    await mutate([
      { $entity: 'User', $id: usId, $op: 'delete' },
      { $relation: 'UserTagGroup', $id: utg1Id, $op: 'delete' },
      { $entity: 'Color', $id: 'bench-c2r-darkGreen', $op: 'delete' },
      { $relation: 'UserTag', $id: 'bench-c2r-tggege', $op: 'delete' },
      { $relation: 'UserTag', $id: 'bench-c2r-deletableTag', $op: 'delete' },
    ]);
  },
  'mut-batched:c3[multi, create, link] Nested tempIds triple': async ({ mutate }) => {
    const res = await mutate([
      {
        $entity: 'Account',
        provider: 'Facebook',
        user: { $tempId: '_:bench-bea3', $thing: 'User', $op: 'link' },
      },
      {
        $entity: 'Account',
        provider: 'Metamask',
        user: { $tempId: '_:bench-bea3', $thing: 'User', $op: 'link' },
      },
      {
        $entity: 'Account',
        provider: 'Google',
        user: {
          $thing: 'User',
          $op: 'create',
          $tempId: '_:bench-bea3',
          name: 'bench-Bea3',
          email: 'bench-bea3@gmail.com',
        },
      },
    ]);
    const beaId = (res as Array<{ $tempId?: string; id?: string }>)?.find((r) => r.$tempId === '_:bench-bea3')?.id;
    if (beaId) {
      await mutate([{ $entity: 'User', $id: beaId, $op: 'delete', accounts: [{ $op: 'delete' }] }]);
    }
  },
  'mut-batched:c4[multi, create, link] Complex tempIds': async ({ mutate }) => {
    await mutate([
      {
        $thing: 'User',
        name: 'bench-PeterC4',
        email: 'bench-Peter@test.ru',
        accounts: [
          { provider: 'google', $op: 'create' },
          { $op: 'create', $tempId: '_:bench-acc1', provider: 'facebook' },
        ],
      },
      { $tempId: '_:bench-us1', $op: 'create', $entity: 'User', name: 'bench-Bob' },
      {
        $entity: 'User',
        name: 'bench-Bea',
        accounts: [{ provider: 'facebook' }, { $tempId: '_:bench-gh1', $op: 'link', $thing: 'Account' }],
      },
      { $entity: 'Account', provider: 'Microsoft', user: { $thing: 'User', name: 'bench-Carla' } },
      { $tempId: '_:bench-gh1', $op: 'create', $entity: 'Account', provider: 'github' },
      { $entity: 'Account', $tempId: '_:bench-mm', $op: 'create', provider: 'metamask' },
      {
        $relation: 'User-Accounts',
        accounts: [{ $tempId: '_:bench-mm', $op: 'link' }],
        user: { $tempId: '_:bench-us1', $op: 'link', $thing: 'User' },
      },
    ]);
    await mutate([
      { $entity: 'User', $filter: { name: 'bench-PeterC4' }, $op: 'delete', accounts: [{ $op: 'delete' }] },
      { $entity: 'User', $filter: { name: 'bench-Bob' }, $op: 'delete', accounts: [{ $op: 'delete' }] },
      { $entity: 'User', $filter: { name: 'bench-Bea' }, $op: 'delete', accounts: [{ $op: 'delete' }] },
      { $entity: 'User', $filter: { name: 'bench-Carla' }, $op: 'delete', accounts: [{ $op: 'delete' }] },
    ]);
  },
  'mut-batched:c5[multi, create, link] tempIds in extended relation': async ({ mutate }) => {
    await mutate([{ $entity: 'Space', $tempId: '_:bench-Personal', $op: 'create', name: 'bench-Personal' }]);
    await mutate([
      {
        $entity: 'Space',
        $filter: { name: 'bench-Personal' },
        kinds: [{ $op: 'create', $tempId: '_:bench-person', name: 'bench-c5-person' }],
      },
    ]);
    await mutate([
      { $entity: 'Space', $filter: { name: 'bench-Personal' }, kinds: [{ $op: 'delete' }] },
      { $entity: 'Space', $filter: { name: 'bench-Personal' }, $op: 'delete' },
    ]);
  },
  'mut-batched:c6[multi, link] tempIds along with normalIds in string format': async ({ mutate }) => {
    await mutate([{ $entity: 'Space', id: 'bench-c6-space1', $op: 'create', name: 'bench-Personal' }]);
    await mutate([
      { $entity: 'Space', $op: 'create', id: 'bench-c6-space2', $tempId: '_:bench-space2' },
      { $thing: 'User', id: 'bench-c6-user1', $op: 'create', spaces: ['_:bench-space2', 'bench-c6-space1'] },
    ]);
    await mutate([
      { $entity: 'User', $id: 'bench-c6-user1', $op: 'delete' },
      { $entity: 'Space', $id: 'bench-c6-space1', $op: 'delete' },
      { $entity: 'Space', $id: 'bench-c6-space2', $op: 'delete' },
    ]);
  },

  // --- Missing Error Mutations ---
  /* 'mut-errors:TODO{S}:e2[relation] Error for match and $id not found': async ({ mutate }) => {
    try {
      await mutate({
        $relation: 'UserTagGroup',
        $id: 'non-existing-user-tag-group',
        tags: [{ $op: 'link', $id: 'tag-1' }],
      });
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{TS}:e5[relation] breaking the cardinality rule in a batch mutation': async ({ mutate }) => {
    try {
      await mutate([
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
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{S}:m1d[delete, missing] Delete a non existing $id': async ({ mutate }) => {
    try {
      await mutate(
        { $relation: 'UserTag', $id: 'tag-1', users: [{ $op: 'delete', $id: 'jnsndadsn' }] },
        { preQuery: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{TS}:m1l[link, missing] Link a non existing $id': async ({ mutate }) => {
    try {
      await mutate({
        $relation: 'UserTag',
        $id: 'tag-1',
        users: [{ $op: 'link', $id: 'jnsndadsn' }],
      });
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{S}:m1up[update, missing] Update a non existing $id': async ({ mutate }) => {
    try {
      await mutate(
        { $relation: 'UserTag', $id: 'tag-1', users: [{ $op: 'update', $id: 'jnsndadsn', name: 'new' }] },
        { preQuery: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{S}:m1un[unlink, missing] Unlink a non existing $id': async ({ mutate }) => {
    try {
      await mutate(
        { $relation: 'UserTag', $id: 'tag-1', users: [{ $op: 'unlink', $id: 'jnsndadsn' }] },
        { preQuery: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{S}:m2d[delete, missing] Delete a non related $id': async ({ mutate }) => {
    try {
      await mutate(
        { $relation: 'UserTag', $id: 'tag-1', users: [{ $op: 'delete', $id: 'user3' }] },
        { preQuery: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{S}:m2up[update, missing] Update a non related $id': async ({ mutate }) => {
    try {
      await mutate(
        { $relation: 'UserTag', $id: 'tag-1', users: [{ $op: 'update', $id: 'user3', name: 'new' }] },
        { preQuery: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{S}:m2un[unlink, missing] Unlink a non related $id': async ({ mutate }) => {
    try {
      await mutate(
        { $relation: 'UserTag', $id: 'tag-1', users: [{ $op: 'unlink', $id: 'user3' }] },
        { preQuery: true },
      );
    } catch {
      // Expected error
    }
  }, */
  /* 'mut-errors:TODO{TS}:e-one1[update, cardinalityOne] Update multiple UserTagGroups with one tag': async ({
    mutate,
  }) => {
    try {
      await mutate([
        { $relation: 'UserTagGroup', $op: 'create', id: 'bench-e-one1-utg1', tags: ['tag-1'] },
        { $relation: 'UserTagGroup', $op: 'create', id: 'bench-e-one1-utg2', tags: ['tag-2'] },
      ]);
      await mutate({
        $relation: 'UserTagGroup',
        $id: ['bench-e-one1-utg1', 'bench-e-one1-utg2'],
        $op: 'update',
        tags: ['tag-4'],
      });
    } catch {
      // Expected error
    }
    try {
      await mutate([
        { $relation: 'UserTagGroup', $id: 'bench-e-one1-utg1', $op: 'delete' },
        { $relation: 'UserTagGroup', $id: 'bench-e-one1-utg2', $op: 'delete' },
      ]);
    } catch {
      // cleanup best-effort
    }
  }, */
  /* 'mut-errors:TODO{TS}:e-one2[update, cardinalityOne] create multiple UserTagGroups with one tag in same transaction':
    async ({ mutate }) => {
      try {
        await mutate([
          { $relation: 'UserTagGroup', $op: 'create', id: 'bench-e-one2-utg1', tags: ['tag-1'] },
          { $relation: 'UserTagGroup', $op: 'create', id: 'bench-e-one2-utg2', tags: ['tag-1'] },
        ]);
      } catch {
        // Expected error
      }
      try {
        await mutate([
          { $relation: 'UserTagGroup', $id: 'bench-e-one2-utg1', $op: 'delete' },
          { $relation: 'UserTagGroup', $id: 'bench-e-one2-utg2', $op: 'delete' },
        ]);
      } catch {
        // cleanup best-effort
      }
    }, */
  /* 'mut-errors:TODO{TS}:e-id1[replace, many, wrongId] Replace many by non existing field': async ({ mutate }) => {
    try {
      await mutate({ $relation: 'UserTagGroup', $op: 'create', id: 'bench-tmpUTG1', tags: ['tag-1', 'tag-2'] });
      await mutate({
        $relation: 'UserTagGroup',
        $op: 'create',
        id: 'bench-tmpUTG2',
        tags: ['tag-1', 'tag-3'],
        color: 'blue',
      });
      await mutate({
        $id: ['bench-tmpUTG1', 'bench-tmpUTG2'],
        $relation: 'UserTagGroup',
        $op: 'update',
        tags: ['tag-4'],
        color: 'red',
      });
    } catch {
      // Expected error
    }
    try {
      await mutate([
        { $relation: 'UserTagGroup', $id: 'bench-tmpUTG1', $op: 'delete' },
        { $relation: 'UserTagGroup', $id: 'bench-tmpUTG2', $op: 'delete' },
      ]);
    } catch {
      // cleanup best-effort
    }
  }, */
  /* 'mut-errors:TODO{TS}:e-lm[link and unlink many] linking to things that do not exist': async ({ mutate }) => {
    try {
      await mutate({
        $relation: 'Field',
        id: 'bench-ul-many',
        kinds: [
          { $relation: 'Kind', $id: 'k1' },
          { $relation: 'Kind', $id: 'k2' },
          { $relation: 'Kind', $id: 'k3' },
        ],
      });
    } catch {
      // Expected error
    }
  }, */
  // =============================================
  // MUTATIONS: Filtered — missing entries
  // =============================================

  'mut-filtered:df2[filter with pre query] complete a mutation by filter': async ({ mutate }) => {
    await mutate([
      {
        $entity: 'User',
        id: 'bench-f2-user',
        spaces: [
          {
            id: 'bench-f2-space-1',
            dataFields: [
              { id: 'bench-f2-df-1', type: 'toChange-1' },
              { id: 'bench-f2-df-2', type: 'toChange-1' },
              { id: 'bench-f2-df-3', type: 'toChange-2' },
              { id: 'bench-f2-df-4', type: 'toChange-2' },
            ],
          },
        ],
      },
    ]);
    await mutate({
      $entity: 'User',
      $id: 'bench-f2-user',
      spaces: [
        {
          $id: 'bench-f2-space-1',
          dataFields: [
            { $op: 'update', type: 'afterChange-1', $filter: { type: 'toChange-1' } },
            { $op: 'update', type: 'afterChange-2', $filter: { type: 'toChange-2' } },
          ],
        },
      ],
    });
    await mutate([
      {
        $entity: 'User',
        $id: 'bench-f2-user',
        $op: 'delete',
        spaces: [{ $id: 'bench-f2-space-1', $op: 'delete', dataFields: [{ $op: 'delete' }] }],
      },
    ]);
  },
  'TODO{T}:mut-filtered:rf1[filter, rolefield] filter by rolefield': async ({ mutate }) => {
    await mutate([
      { $relation: 'UserTag', $id: 'tag-1', users: ['user1'] },
      { $relation: 'UserTag', $id: 'tag-2', users: ['user1', 'user3'] },
      { $relation: 'UserTag', $id: 'tag-3', users: ['user2'] },
      { $relation: 'UserTag', $id: 'tag-4', users: ['user2'] },
    ]);
    await mutate([
      {
        $relation: 'UserTag',
        $filter: { users: ['user2', 'user3'] },
        name: 'bench-changedName-frf1',
      },
    ]);
    await mutate([
      {
        $relation: 'UserTag',
        $op: 'update',
        name: null,
      },
    ]);
  },
  'TODO{T}:mut-filtered:lf1[filter, linkfield, relation] filter by rolefield:rel': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-1',
      $op: 'update',
      tags: ['tag-1', 'tag-2'],
    });
    await mutate([
      {
        $relation: 'UserTag',
        $filter: { group: 'utg-1' },
        name: 'bench-changedName-flf1',
      },
    ]);
    await mutate([
      {
        $relation: 'UserTag',
        $op: 'update',
        name: null,
      },
    ]);
  },
  'TODO{T}:mut-filtered:lf2[filter, linkfield, role] filter by rolefield:role': async ({ mutate }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $id: 'utg-2',
      $op: 'update',
      tags: ['tag-3'],
      color: 'blue',
    });
    await mutate([
      {
        $relation: 'UserTag',
        $filter: { color: 'blue' },
        name: 'bench-changedName-flf2',
      },
    ]);
    await mutate([
      {
        $relation: 'UserTag',
        $op: 'update',
        name: null,
      },
    ]);
  },

  // =============================================
  // MUTATIONS: PreHooks — missing entries
  // =============================================

  'mut-preHooks:vfl3[validation, functions, local, attribute] FUnction with custom error': async ({ mutate }) => {
    try {
      await mutate({
        $entity: 'Hook',
        fnValidatedField: 'secretTesthe@test.es',
        requiredOption: 'a',
      });
    } catch {
      // Expected error: custom validation message
    }
  },
  'mut-preHooks:vfr1[validation, functions, remote, parent] Validate considering the parent': async ({ mutate }) => {
    try {
      await mutate({
        $entity: 'Hook',
        id: 'bench-hook-c0',
        requiredOption: 'a',
        asMainHookOf: {
          id: 'bench-doesHaveheyYes',
          hooks: [
            { id: 'bench-hook-c1', requiredOption: 'a' },
            { id: 'bench-hook-c2', requiredOption: 'a' },
          ],
          mainHook: {
            id: 'bench-hook-c3',
            requiredOption: 'a',
            asMainHookOf: {
              id: 'bench-p-7',
              hooks: [
                { id: 'bench-hook-c4', requiredOption: 'a' },
                { id: 'bench-hook-c5', requiredOption: 'a' },
              ],
            },
          },
        },
      });
    } catch {
      // Expected error: parent does not have 'hey' in its id
    }
  },
  'mut-preHooks:vflr2[validation, functions, remote, things] Check nested array': async ({ mutate }) => {
    try {
      await mutate({
        $relation: 'Kind',
        id: 'bench-kind1',
        fields: [{ name: 'forbiddenName' }],
      });
    } catch {
      // Expected error: can't have a field named 'forbiddenName'
    }
  },
  /* 'TODO{TS}:mut-preHooks:vflr3[validation, functions, nested, things] Check nested array, card ONE': async ({
    mutate,
  }) => {
    try {
      await mutate({
        $relation: 'HookATag',
        id: 'bench-vfla6-1-hey',
        hookTypeA: { requiredOption: 'a' },
      });
    } catch {
      // Expected error: validation failure
    }
  }, */
  'mut-preHooks:tn3[transform, inherited] Append children to node': async ({ mutate }) => {
    try {
      await mutate(
        {
          $thing: 'Kind',
          id: 'bench-secret-kind-tn3',
          space: 'space-1',
        },
        { noMetadata: true },
      );
    } finally {
      await mutate({
        $thing: 'Kind',
        $thingType: 'relation',
        $op: 'delete',
        $ids: ['bench-secret-kind-tn3', 'bench-secret-kind-tn3-YES!'],
      });
    }
  },
  'mut-preHooks:tt2[transform, temp props] Transform using %vars': async ({ mutate }) => {
    try {
      await mutate(
        {
          $thing: 'User',
          id: 'bench-tt2-u1',
          '%modifier': { name: 'White' },
          name: 'Barry',
        },
        { noMetadata: true },
      );
    } finally {
      await mutate({
        $thing: 'User',
        $thingType: 'entity',
        $id: 'bench-tt2-u1',
        $op: 'delete',
      });
    }
  },
  /* 'TODO{S}:mut-preHooks:tf1[transform, fields] Use $fields for dbNode': async ({ mutate }) => {
    try {
      await mutate([
        {
          $entity: 'User',
          id: 'bench-mf1-user',
          name: 'John',
          email: 'john@email.com',
          spaces: [
            {
              id: 'bench-mf1-space',
              dataFields: [
                {
                  id: 'bench-mf1-dataField-1',
                  values: [{ id: 'bench-mf1-dataValue' }],
                  expression: { $op: 'create', id: 'bench-mf1-expression-1' },
                },
                { id: 'bench-mf1-dataField-2', values: [{ id: 'bench-mf1-dataValue-2' }] },
                { id: 'bench-mf1-dataField-3', expression: { $op: 'create', id: 'bench-mf1-expression-2' } },
                { id: 'bench-mf1-dataField-4' },
              ],
            },
          ],
        },
      ]);
      await mutate({
        $thing: 'User',
        $id: 'bench-mf1-user',
        name: 'Jack',
        $fields: ['email', { $path: 'spaces', $fields: [{ $path: 'dataFields', $fields: ['values', 'expression'] }] }],
      });
    } finally {
      await mutate({
        $thing: 'User',
        $thingType: 'entity',
        $op: 'delete',
        $id: 'bench-mf1-user',
      });
    }
  }, */
  /* 'TODO{S}:mut-preHooks:tf2[transform, fields] Use $fields for dbNode nested': async ({ mutate }) => {
    try {
      await mutate([
        {
          $entity: 'User',
          id: 'bench-mf2-user',
          name: 'John',
          email: 'john@email.com',
          spaces: [
            {
              id: 'bench-mf2-space',
              dataFields: [
                {
                  id: 'bench-mf2-dataField-1',
                  values: [{ id: 'bench-mf2-dataValue-1' }],
                  expression: { $op: 'create', id: 'bench-mf2-expression-1' },
                },
                { id: 'bench-mf2-dataField-2', values: [{ id: 'bench-mf2-dataValue-2' }] },
                { id: 'bench-mf2-dataField-3', expression: { $op: 'create', id: 'bench-mf2-expression-2' } },
                { id: 'bench-mf2-dataField-4' },
              ],
            },
          ],
        },
      ]);
      await mutate({
        $thing: 'User',
        $id: 'bench-mf2-user',
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
      await mutate({
        $thing: 'User',
        $thingType: 'entity',
        $op: 'delete',
        $id: 'bench-mf2-user',
      });
    }
  }, */
  /* 'TODO{S}:mut-preHooks:tf3[transform, fields] Use $fields for transformation': async ({ mutate }) => {
    try {
      await mutate([
        {
          $thing: 'Color',
          $fields: ['id', 'value'],
          id: 'bench-color-test',
          value: 'gold',
        },
      ]);
      await mutate([
        {
          $thing: 'Color',
          $fields: ['id', 'value'],
          $id: 'bench-color-test',
          value: 'gold',
        },
      ]);
    } finally {
      await mutate({
        $thing: 'Color',
        $thingType: 'entity',
        $id: 'bench-color-test',
        $op: 'delete',
      });
    }
  }, */
  /* 'TODO{TS}:mut-preHooks:tf4[transform, fields] Use $fields for nested transformations with same types': async ({
    mutate,
    query,
  }) => {
    try {
      await mutate([
        {
          $relation: 'CascadeRelation',
          id: 'bench-cr-1',
          things: [
            {
              id: 'bench-t-1',
              cascadeRelations: [
                { id: 'bench-cr-2', things: [{ id: 'bench-t-3' }, { id: 'bench-t-4' }] },
                { id: 'bench-cr-3', things: [{ id: 'bench-t-5' }, { id: 'bench-t-6' }] },
              ],
            },
            {
              id: 'bench-t-2',
              cascadeRelations: [
                { id: 'bench-cr-4', things: [{ id: 'bench-t-7' }, { id: 'bench-t-8' }] },
                { id: 'bench-cr-5', things: [{ id: 'bench-t-9' }, { id: 'bench-t-10' }] },
              ],
            },
          ],
        },
      ]);
      await query({
        $thing: 'CascadeRelation',
        $thingType: 'relation',
        $id: 'bench-cr-1',
        $fields: ['things'],
      });
      await mutate({
        $thing: 'CascadeRelation',
        $id: 'bench-cr-1',
        $op: 'delete',
        $fields: ['things'],
      });
    } finally {
      // cascade delete handled above
    }
  }, */
  /* 'TODO{S}:mut-preHooks:tf5[transform, fields] Use $fields nested looping through transformations': async ({
    mutate,
    query,
  }) => {
    try {
      await mutate([
        {
          $entity: 'User',
          id: 'bench-mf5-user',
          name: 'John',
          email: 'john@email.com',
          spaces: [
            {
              id: 'bench-mf5-space',
              dataFields: [
                { id: 'bench-mf5-dataField-1' },
                { id: 'bench-mf5-dataField-2' },
                { id: 'bench-mf5-dataField-3' },
                { id: 'bench-mf5-dataField-4' },
              ],
            },
          ],
        },
      ]);
      await mutate([
        {
          $entity: 'User',
          $id: 'bench-mf5-user',
          $op: 'delete',
          $fields: ['spaces'],
        },
      ]);
      await query([
        { $entity: 'User', $id: 'bench-mf5-user' },
        { $entity: 'Space', $id: 'bench-mf5-space' },
        { $relation: 'DataField', $id: ['bench-mf5-dataField-1', 'bench-mf5-dataField-4', 'bench-mf5-dataField-3', 'bench-mf5-dataField-4'] },
      ]);
    } finally {
      // cleanup handled by cascade delete above
    }
  }, */
  'mut-preHooks:tf6': async ({ mutate }) => {
    await mutate([
      {
        $entity: 'User',
        id: 'bench-mf6-user',
        name: 'John',
        email: 'john@email.com',
        spaces: [
          {
            id: 'bench-mf6-space',
            name: 'My space',
            dataFields: [
              { id: 'bench-mf6-dataField-1', type: 'TEXT', computeType: 'COMPUTED' },
              { id: 'bench-mf6-dataField-2', type: 'EMAIL', computeType: 'EDITABLE' },
            ],
          },
        ],
      },
    ]);
    await mutate([
      {
        $op: 'update',
        $entity: 'User',
        $id: ['bench-mf6-user'],
        $fields: ['spaces', 'email', { $path: 'spaces', $fields: ['name'] }],
        email: 'jhon@gmail.com',
        spaces: [
          {
            $op: 'update',
            $fields: ['dataFields', 'name'],
            name: 'Our space',
            dataFields: [
              {
                $op: 'update',
                $id: ['bench-mf6-dataField-1', 'bench-mf6-dataField-2'],
                $fields: ['type'],
                type: 'NUMBER',
              },
            ],
          },
        ],
      },
    ]);
    await mutate({
      $thing: 'User',
      $thingType: 'entity',
      $op: 'delete',
      $id: 'bench-mf6-user',
    });
  },

  // =============================================
  // MUTATIONS: Replaces — missing entries
  // =============================================

  'mut-replaces:r3[replace] replace many roles in many relation': async ({ mutate }) => {
    await mutate([
      { $relation: 'ThingRelation', $id: 'tr4', root: 'thing4', things: ['thing4'] },
      { $relation: 'ThingRelation', $id: 'tr5', root: 'thing4', things: ['thing4'] },
    ]);
    // revert
    await mutate([
      { $relation: 'ThingRelation', $id: 'tr4', root: 'thing1', things: ['thing5'] },
      { $relation: 'ThingRelation', $id: 'tr5', root: 'thing1', things: ['thing5'] },
    ]);
  },
  'mut-replaces:r4[replace] replace depth test': async ({ mutate }) => {
    await mutate({
      $entity: 'User',
      $id: 'user3',
      'user-tags': [
        {
          $id: 'tag-2',
          users: ['user3', 'user5'],
        },
      ],
    });
    // revert to original
    await mutate({
      $entity: 'User',
      $id: 'user3',
      'user-tags': [
        {
          $id: 'tag-2',
          users: ['user3', 'user1'],
        },
      ],
    });
  },
  'mut-replaces:r5b[replace, unlink, link, many] Replace using unlink + link single role, by IDs. MultiIds': async ({
    mutate,
  }) => {
    await mutate({
      $relation: 'UserTagGroup',
      $op: 'create',
      id: 'bench-rep5b-utg',
      tags: ['tag-1', 'tag-2', 'tag-3'],
    });
    await mutate({
      $id: 'bench-rep5b-utg',
      $relation: 'UserTagGroup',
      tags: [
        { $op: 'link', $id: 'tag-4' },
        { $op: 'unlink', $id: ['tag-1', 'tag-2'] },
      ],
    });
    await mutate({ $relation: 'UserTagGroup', $id: 'bench-rep5b-utg', $op: 'delete' });
  },
  /* 'TODO{TS}:mut-replaces:ri1-d[ignore ids pre-query delete] delete something that does not exist': async ({
    mutate,
  }) => {
    await mutate(
      {
        $relation: 'ThingRelation',
        $id: 'tr6',
        root: { $id: 'thing2', $op: 'delete' },
        things: [{ $id: 'thing1', $op: 'delete' }],
      },
      { ignoreNonexistingThings: true },
    );
  }, */
  /* 'TODO{TS}:mut-replaces:ri1-ul[ignore ids pre-query unlink] unlink something that does not exist': async ({
    mutate,
  }) => {
    await mutate(
      {
        $relation: 'ThingRelation',
        $id: 'tr7',
        root: { $id: 'thing3', $op: 'unlink' },
        things: [{ $id: 'thing90', $op: 'unlink' }],
      },
      { ignoreNonexistingThings: true },
    );
  }, */
  /* 'TODO{TS}:mut-replaces:ri1-up[ignore ids pre-query update] update something that does not exist': async ({
    mutate,
  }) => {
    await mutate(
      {
        $relation: 'ThingRelation',
        $id: 'tr8',
        root: { $id: 'thing4', $op: 'update', stuff: 'Z' },
        things: [{ $id: 'thing90', $op: 'update', stuff: 'blah' }],
      },
      { ignoreNonexistingThings: true },
    );
  }, */

  // =============================================
  // MUTATIONS: RefFields — missing entries
  // =============================================

  'TODO{T}:mut-refFields:fl1r[ref, ent, one, replace]': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl1r-flexRef',
        reference: { $thing: 'User', $op: 'create', id: 'bench-fl1r-user1', email: 'bench-fl1ruser1@test.it' },
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $entity: 'FlexRef',
        $id: 'bench-fl1r-flexRef',
        reference: { $thing: 'User', $op: 'create', id: 'bench-fl1r-user2', email: 'bench-fl1ruser2@test.it' },
      },
      { noMetadata: true },
    );
    await mutate([
      { $id: 'bench-fl1r-flexRef', $entity: 'FlexRef', $op: 'delete' },
      { $id: ['bench-fl1r-user1', 'bench-fl1r-user2'], $entity: 'User', $op: 'delete' },
    ]);
  },
  /* 'TODO{TS}:mut-refFields:fl2add[ref, many, add] Add to existing': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl2add-ref1',
        references: [{ $thing: 'User', id: 'bench-fl2add-u1', name: 'User 1' }],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $entity: 'FlexRef',
        $id: 'bench-fl2add-ref1',
        references: [{ $thing: 'User', id: 'bench-fl2add-u2', name: 'User 2', $op: 'link' }],
      },
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl2add-ref1' },
    ]);
  }, */
  /* 'TODO{TS}:mut-refFields:fl2rem[ref, many, remove] Remove existing': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl2rem-ref1',
        references: [
          { $thing: 'User', id: 'bench-fl2rem-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-fl2rem-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $entity: 'FlexRef',
        $id: 'bench-fl2rem-ref1',
        references: [{ $op: 'unlink', $id: 'bench-fl2rem-u1' }],
      },
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl2rem-ref1' },
    ]);
  }, */
  /* 'TODO{TS}:mut-refFields:fl2rem2[ref, many, remove, all] Remove all': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl2rem2-ref1',
        references: [
          { $thing: 'User', id: 'bench-fl2rem2-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-fl2rem2-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $entity: 'FlexRef',
        $id: 'bench-fl2rem2-ref1',
        references: null,
      },
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl2rem2-ref1' },
    ]);
  }, */
  'TODO{T}:mut-refFields:fl2rep[ref, many, replace] Replace existing': async ({ mutate }) => {
    await mutate(
      {
        $entity: 'FlexRef',
        id: 'bench-fl2rep-ref1',
        references: [
          { $thing: 'User', id: 'bench-fl2rep-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-fl2rep-u2', name: 'User 2' },
        ],
      },
      { noMetadata: true },
    );
    await mutate(
      [
        {
          $entity: 'FlexRef',
          $id: 'bench-fl2rep-ref1',
          references: [
            { $op: 'create', $thing: 'User', id: 'bench-fl2rep-u3' },
            { $op: 'create', $thing: 'User', id: 'bench-fl2rep-u4' },
          ],
        },
      ],
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl2rep-ref1' },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['bench-fl2rep-u1', 'bench-fl2rep-u2', 'bench-fl2rep-u3', 'bench-fl2rep-u4'],
      },
    ]);
  },
  'TODO{T}:mut-refFields:fl2repShort[ref, many, replace, prefix] Replace existing using prefix': async ({ mutate }) => {
    await mutate(
      [
        {
          $entity: 'FlexRef',
          id: 'bench-fl2repShort-ref1',
          references: [
            { $thing: 'User', id: 'bench-fl2repShort-u1', name: 'User 1' },
            { $thing: 'User', id: 'bench-fl2repShort-u2', name: 'User 2' },
          ],
        },
        { $op: 'create', $thing: 'User', id: 'bench-fl2repShort-u3' },
        { $op: 'create', $thing: 'User', id: 'bench-fl2repShort-u4' },
      ],
      { noMetadata: true },
    );
    await mutate(
      [
        {
          $entity: 'FlexRef',
          $id: 'bench-fl2repShort-ref1',
          references: ['User:bench-fl2repShort-u3', 'User:bench-fl2repShort-u4'],
        },
      ],
      { noMetadata: true },
    );
    await mutate([
      { $entity: 'FlexRef', $op: 'delete', $id: 'bench-fl2repShort-ref1' },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['bench-fl2repShort-u1', 'bench-fl2repShort-u2', 'bench-fl2repShort-u3', 'bench-fl2repShort-u4'],
      },
    ]);
  },
  'TODO{T}:mut-refFields:fl4[ref, flex, many] Test MANY cardinality with FLEX type': async ({ mutate }) => {
    await mutate(
      {
        $thing: 'FlexRef',
        id: 'bench-fl4-ref1',
        flexReferences: [
          'hey',
          { $thing: 'User', id: 'bench-fl4-u1', name: 'User 1' },
          8,
          { $thing: 'User', id: 'bench-fl4-u2', name: 'User 2' },
          new Date('2024-01-01'),
        ],
      },
      { noMetadata: true },
    );
    await mutate([{ $thing: 'FlexRef', $op: 'delete', $id: 'bench-fl4-ref1' }]);
  },
  'TODO{T}:mut-refFields:flr1[ref, one, rel] Create relation with flexible values and read it': async ({
    mutate,
    query,
  }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr1-flexRefRel',
        reference: { $thing: 'User', $op: 'create', id: 'bench-flr1-user', email: 'bench-flr1user@test.it' },
        space: { id: 'bench-flr1-space', name: 'bench-flr1-space' },
      },
      { noMetadata: true },
    );
    await query(
      {
        $relation: 'FlexRefRel',
        $id: 'bench-flr1-flexRefRel',
        $fields: ['id', 'reference'],
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $id: 'bench-flr1-flexRefRel',
        $relation: 'FlexRefRel',
        space: { $op: 'delete' },
        $op: 'delete',
      },
    ]);
  },
  'TODO{T}:mut-refFields:flr1r[ref, one, replace] Replace existing relation reference': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr1r-flexRefRel',
        reference: { $thing: 'User', $op: 'create', id: 'bench-flr1r-user1', email: 'bench-flr1ruser1@test.it' },
        space: { id: 'bench-flr1r-space', name: 'bench-flr1r-space' },
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'bench-flr1r-flexRefRel',
        reference: { $thing: 'User', $op: 'create', id: 'bench-flr1r-user2', email: 'bench-flr1ruser2@test.it' },
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $id: 'bench-flr1r-flexRefRel',
        $relation: 'FlexRefRel',
        space: { $op: 'delete' },
        $op: 'delete',
      },
      { $id: ['bench-flr1r-user1', 'bench-flr1r-user2'], $entity: 'User', $op: 'delete' },
    ]);
  },
  'TODO{T}:mut-refFields:flr2[ref, many] Test MANY cardinality with REF type in relations': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr2-ref1',
        references: [
          { $thing: 'User', id: 'bench-flr2-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-flr2-u2', name: 'User 2' },
        ],
        space: { id: 'bench-flr2-space', name: 'bench-flr2-space' },
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'bench-flr2-ref1',
        space: { $op: 'delete' },
      },
    ]);
  },
  /* 'TODO{TS}:mut-refFields:flr2add[ref, many, add] Add to existing relation references': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr2add-ref1',
        references: [{ $thing: 'User', id: 'bench-flr2add-u1', name: 'User 1' }],
        space: { id: 'bench-flr2add-space', name: 'bench-flr2add-space' },
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'bench-flr2add-ref1',
        references: [{ $thing: 'User', id: 'bench-flr2add-u2', name: 'User 2', $op: 'link' }],
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'bench-flr2add-ref1',
        space: { $op: 'delete' },
      },
    ]);
  }, */
  /* 'TODO{TS}:mut-refFields:flr2rem[ref, many, remove] Remove existing relation reference': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr2rem-ref1',
        references: [
          { $thing: 'User', id: 'bench-flr2rem-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-flr2rem-u2', name: 'User 2' },
        ],
        space: { id: 'bench-flr2rem-space', name: 'bench-flr2rem-space' },
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'bench-flr2rem-ref1',
        references: [{ $op: 'unlink', $id: 'bench-flr2rem-u1' }],
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'bench-flr2rem-ref1',
        space: { $op: 'delete' },
      },
    ]);
  }, */
  'TODO{T}:mut-refFields:flr2rep[ref, many, replace] Replace existing relation references': async ({ mutate }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr2rep-ref1',
        references: [
          { $thing: 'User', id: 'bench-flr2rep-u1', name: 'User 1' },
          { $thing: 'User', id: 'bench-flr2rep-u2', name: 'User 2' },
        ],
        space: { id: 'bench-flr2rep-space', name: 'bench-flr2rep-space' },
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'bench-flr2rep-ref1',
        references: [
          { $thing: 'User', id: 'bench-flr2rep-u3', name: 'User 3' },
          { $thing: 'User', id: 'bench-flr2rep-u4', name: 'User 4' },
        ],
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'bench-flr2rep-ref1',
        space: { $op: 'delete' },
      },
      {
        $entity: 'User',
        $op: 'delete',
        $id: ['bench-flr2rep-u3', 'bench-flr2rep-u4', 'bench-flr2rep-u1', 'bench-flr2rep-u2'],
      },
    ]);
  },
  'TODO{T}:mut-refFields:flr2repShort[ref, many, replace, prefix] Replace existing relation references with prefixes':
    async ({ mutate }) => {
      await mutate(
        [
          {
            $relation: 'FlexRefRel',
            id: 'bench-flr2repShort-ref1',
            references: [
              { $thing: 'User', id: 'bench-flr2repShort-u1', name: 'User 1' },
              { $thing: 'User', id: 'bench-flr2repShort-u2', name: 'User 2' },
            ],
            space: { id: 'bench-flr2rep-space', name: 'bench-flr2rep-space' },
          },
          { $thing: 'User', id: 'bench-flr2repShort-u3', name: 'User 3' },
          { $thing: 'User', id: 'bench-flr2repShort-u4', name: 'User 4' },
        ],
        { noMetadata: true },
      );
      await mutate(
        {
          $relation: 'FlexRefRel',
          $id: 'bench-flr2repShort-ref1',
          references: ['User:bench-flr2repShort-u3', 'User:bench-flr2repShort-u4'],
        },
        { noMetadata: true },
      );
      await mutate([
        {
          $relation: 'FlexRefRel',
          $op: 'delete',
          $id: 'bench-flr2repShort-ref1',
          space: { $op: 'delete' },
        },
        {
          $entity: 'User',
          $op: 'delete',
          $id: ['bench-flr2repShort-u3', 'bench-flr2repShort-u4', 'bench-flr2repShort-u1', 'bench-flr2repShort-u2'],
        },
      ]);
    },
  'TODO{T}:mut-refFields:flr3[ref, flex, one] Test ONE cardinality with FLEX type in relations': async ({ mutate }) => {
    await mutate(
      [
        {
          $relation: 'FlexRefRel',
          id: 'bench-flr3-ref1',
          flexReference: 7,
          space: { id: 'bench-flr3-space1', name: 'bench-flr3-space1' },
        },
        {
          $relation: 'FlexRefRel',
          id: 'bench-flr3-ref2',
          flexReference: 'jey',
          space: { id: 'bench-flr3-space2', name: 'bench-flr3-space2' },
        },
        {
          $relation: 'FlexRefRel',
          id: 'bench-flr3-ref3',
          flexReference: { $thing: 'User', id: 'bench-flr3-u1', name: 'User 1' },
          space: { id: 'bench-flr3-space3', name: 'bench-flr3-space3' },
        },
      ],
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: ['bench-flr3-ref1', 'bench-flr3-ref2', 'bench-flr3-ref3'],
        space: { $op: 'delete' },
      },
    ]);
  },
  'TODO{T}:mut-refFields:flr4[ref, flex, many] Test MANY cardinality with FLEX type in relations': async ({
    mutate,
  }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr4-ref1',
        flexReferences: [
          'hey',
          { $thing: 'User', id: 'bench-flr4-u1', name: 'User 1' },
          8,
          { $thing: 'User', id: 'bench-flr4-u2', name: 'User 2' },
          new Date('2024-01-01'),
        ],
        space: { id: 'bench-flr4-space', name: 'bench-flr4-space' },
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'bench-flr4-ref1',
        space: { $op: 'delete' },
      },
    ]);
  },
  'TODO{T}:mut-refFields:flr5[ref, flex, many,replace] Test replace in flex ref field in relations': async ({
    mutate,
  }) => {
    await mutate(
      {
        $relation: 'FlexRefRel',
        id: 'bench-flr5-ref1',
        flexReferences: [
          'hey',
          { $thing: 'User', id: 'bench-flr5-u1', name: 'User 1' },
          8,
          { $thing: 'User', id: 'bench-flr5-u2', name: 'User 2' },
          new Date('2024-01-01'),
        ],
        space: { id: 'bench-flr5-space', name: 'bench-flr5-space' },
      },
      { noMetadata: true },
    );
    await mutate(
      {
        $relation: 'FlexRefRel',
        $id: 'bench-flr5-ref1',
        flexReferences: [new Date('1990-10-10'), 9, 'hello', { $thing: 'User', $op: 'link', $id: 'bench-flr5-u2' }],
      },
      { noMetadata: true },
    );
    await mutate([
      {
        $relation: 'FlexRefRel',
        $op: 'delete',
        $id: 'bench-flr5-ref1',
        space: { $op: 'delete' },
      },
      { $entity: 'User', $op: 'delete', $id: ['bench-flr5-u1', 'bench-flr5-u2'] },
    ]);
  },
  'mut-refFields:fl6:[ref, data, tempVar] Should accept strings with weird formats as string and tempVars': async ({
    mutate,
  }) => {
    await mutate(
      [
        {
          $thing: 'FlexRefRel',
          id: 'bench-flr6-refField-weirdFormat',
          flexReferences: ['(TARGET.{', 'User:_:bench-flr6-u1', '} / TARGET.{', 'User:_:bench-flr6-u2', '}) * 100'],
          space: { id: 'bench-flr6-space', name: 'bench-flr6-space' },
        },
        { $thing: 'User', $tempId: '_:bench-flr6-u1', id: 'bench-flr6-u1', name: 'User 1' },
        { $thing: 'User', $tempId: '_:bench-flr6-u2', id: 'bench-flr6-u2', name: 'User 2' },
      ],
      { noMetadata: true },
    );
    await mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'bench-flr6-refField-weirdFormat',
      space: { $op: 'delete' },
    });
  },
  'mut-refFields:fl7:[ref, data, tempVar] $thing:id format not triggered with other strings using ":" ': async ({
    mutate,
  }) => {
    await mutate(
      [
        {
          $thing: 'FlexRefRel',
          id: 'bench-flr7-refField-weirdFormat',
          flexReferences: ['hello ? yes : no', 'User:abc:xyz', 'things it can do: jumping', 'User: hey', 'User:hey '],
          space: { id: 'bench-flr7-space', name: 'bench-flr7-space' },
        },
      ],
      { noMetadata: true },
    );
    await mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'bench-flr7-refField-weirdFormat',
      space: { $op: 'delete' },
    });
  },
  'mut-refFields:fl8:[flex, object] Should accept objects in flexReferences': async ({ mutate }) => {
    await mutate(
      [
        {
          $thing: 'FlexRefRel',
          id: 'bench-fl8-flex-with-object',
          flexReferences: [{ msg: 'Hello, world!' }],
          space: { id: 'bench-fl8-space', name: 'bench-fl8-space' },
        },
      ],
      { noMetadata: true },
    );
    await mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'bench-fl8-flex-with-object',
      space: { $op: 'delete' },
    });
  },
  'mut-refFields:fl9:[flex, object] Should accept an array of objects in flexReferences': async ({ mutate }) => {
    await mutate(
      [
        {
          $thing: 'FlexRefRel',
          id: 'bench-fl9-flex-with-object',
          flexReferences: [[{ msg: 'Hello, world!' }]],
          space: { id: 'bench-fl9-space', name: 'bench-fl9-space' },
        },
      ],
      { noMetadata: true },
    );
    await mutate({
      $thing: 'FlexRefRel',
      $op: 'delete',
      $id: 'bench-fl9-flex-with-object',
      space: { $op: 'delete' },
    });
  },
};

const main = async () => {
  const { client, cleanup } = await init();

  const query: QueryFn = async (query, config) => {
    return client.query(query, config);
  };

  const mutate: MutateFn = async (mutation, config) => {
    return client.mutate(mutation, config);
  };

  const ctx: Ctx = { query, mutate };

  const result: (Record<string, string | number | undefined> | null)[] = [];

  for (const [name, task] of Object.entries(tasks)) {
    const bench = new Bench({
      concurrency: null,
      retainSamples: false,
      time: 1,
      iterations: 10,
    });
    bench.add(name, async () => {
      await task(ctx);
    });
    await bench.run();
    const r = bench.table();
    if (r) {
      result.push(...r);
    }
    bench.reset();
  }

  await cleanup();

  console.table(result);
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
