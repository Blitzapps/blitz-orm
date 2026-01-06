import { Bench } from 'tinybench';
import type { QueryConfig, RawBQLQuery } from '../../../src';
import { init } from '../../helpers/init';

const LEGACY_SURREALDB_ADAPTER = process.env.LEGACY_SURREALDB_ADAPTER?.toLocaleLowerCase() === 'true';

type QueryFn = (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => Promise<unknown>;

const tasks: Record<string, (query: QueryFn) => Promise<void>> = {
  'v1[validation] - $entity missing': async (query) => {
    try {
      // @ts-expect-error - $entity is missing
      await query({});
    } catch {
      // No op
    }
  },
  'v2[validation] - $entity not in schema': async (query) => {
    try {
      await query({ $entity: 'fakeEntity' });
    } catch {
      // No op
    }
  },
  'v3[validation] - $id not existing': async (query) => {
    await query({ $entity: 'User', $id: 'nonExisting' });
  },
  'e1[entity] - basic and direct link to relation': async (query) => {
    await query({ $entity: 'User' });
  },
  'e1.b[entity] - basic and direct link to relation sub entity': async (query) => {
    await query({ $entity: 'God' });
  },
  'e2[entity] - filter by single $id': async (query) => {
    await query({ $entity: 'User', $id: 'user1' });
  },
  'e3[entity, nested] - direct link to relation, query nested': async (query) => {
    await query({ $entity: 'User', $fields: ['id', { $path: 'user-tags' }] });
  },
  'opt1[options, noMetadata': async (query) => {
    await query(
      { $entity: 'User', $id: 'user1' },
      {
        noMetadata: true,
      },
    );
  },
  // 'TODO{TS}:opt2[options, debugger': async (query) => {
  //   await query({ $entity: 'User', $id: 'user1' }, {
  //     debugger: true,
  //   });
  // },
  'opt3a[options, returnNull] - empty fields option in entity': async (query) => {
    await query(
      {
        $entity: 'User',
        $id: 'user4',
        $fields: ['spaces', 'email', 'user-tags'],
      },
      { returnNulls: true },
    );
  },
  'opt3b[options, returnNull] - empty fields option in entity, dont return explicit': async (query) => {
    await query(
      {
        $entity: 'User',
        $id: 'user4',
        $fields: ['spaces', 'email'],
      },
      { returnNulls: true },
    );
  },
  'r1[relation] - basic': async (query) => {
    const q = { $relation: 'User-Accounts' };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r2[relation] - filtered fields': async (query) => {
    const q = { $relation: 'User-Accounts', $fields: ['user'] };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r3[relation, nested] - nested entity': async (query) => {
    const q = {
      $relation: 'User-Accounts',
      $fields: ['id', { $path: 'user', $fields: ['name'] }],
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r4[relation, nested, direct] - nested relation direct on relation': async (query) => {
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
  'r5[relation nested] - that has both role, and linkfield pointing to same role': async (query) => {
    const q = {
      $entity: 'Color',
      $fields: ['id', 'user-tags', 'group'],
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r6[relation nested] - relation connected to relation and a tunneled relation': async (query) => {
    const q = {
      $relation: 'UserTag',
    };
    await query(q);
    await query(q, {
      noMetadata: true,
    });
  },
  'r7[relation, nested, direct] - nested on nested': async (query) => {
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
  'r8[relation, nested, deep] - deep nested': async (query) => {
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
  'r9[relation, nested, ids]': async (query) => {
    await query({
      $relation: 'UserTagGroup',
      $id: 'utg-1',
      $fields: ['tags', 'color'],
    });
  },
  'ef1[entity] - $id single': async (query) => {
    await query({ $entity: 'User', $id: 'non-existing-uuid-for-bench' });
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['id'],
    });
  },
  'ef2[entity] - $id multiple': async (query) => {
    await query({
      $entity: 'User',
      $id: ['user1', 'user2'],
      $fields: ['id'],
    });
  },
  'ef3[entity] - $fields single': async (query) => {
    await query({ $entity: 'User', $fields: ['id'] });
  },
  'ef4[entity] - $fields multiple': async (query) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', 'email'],
    });
  },
  'ef5[entity,filter] - $filter single': async (query) => {
    await query({
      $entity: 'User',
      $filter: { name: 'Antoine' },
      $fields: ['name'],
    });
  },
  'ef6[entity,filter,id] - $filter by id in filter': async (query) => {
    await query({
      $entity: 'User',
      $filter: { id: 'user1' },
      $fields: ['name'],
    });
  },
  'ef7[entity,unique] - $filter by unique field': async (query) => {
    await query({
      $entity: 'User',
      $filter: { email: 'antoine@test.com' },
      $fields: ['name', 'email'],
    });
  },
  'n1[nested] Only ids': async (query) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', 'accounts'],
    });
  },
  'n2[nested] First level all fields': async (query) => {
    const q = {
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts' }],
    };
    await query(q);
    await query(q, { noMetadata: true });
  },
  'n3[nested, $fields] First level filtered fields': async (query) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts', $fields: ['provider'] }],
    });
  },
  'n4a[nested, $id] Local filter on nested, by id': async (query) => {
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
  'n4b[nested, $id] Local filter on nested depth two, by id': async (query) => {
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
  'nf1[nested, $filters] Local filter on nested, single id': async (query) => {
    await query({
      $entity: 'User',
      $id: 'user1',
      $fields: ['name', { $path: 'accounts', $filter: { provider: { $eq: 'github' } } }],
    });
  },
  'nf2[nested, $filters] Local filter on nested, by field, multiple sources, some are empty': async (query) => {
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
  'nf3[nested, $filters] Local filter on nested, by link field, multiple sources': async (query) => {
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
  'nf4[nested, $filters] Local filter on nested, by link field, multiple sources': async (query) => {
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
  'lf1[$filter] Filter by a link field with cardinality ONE': async (query) => {
    await query(
      {
        $relation: 'User-Accounts',
        $filter: { user: 'user1' },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'lf2[$filter, $not] Filter out by a link field with cardinality ONE': async (query) => {
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
  'lf3[$filter] Filter by a link field with cardinality MANY': async (query) => {
    await query(
      {
        $entity: 'User',
        $filter: { spaces: ['space-1'] },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'TODO{T}:lf4[$filter, $or] Filter by a link field with cardinality MANY': async (query) => {
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
  'slo1[$sort, $limit, $offset] root': async (query) => {
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
  'slo2[$sort, $limit, $offset] sub level': async (query) => {
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
  // 'TODO{S}:slo3[$sort, $limit, $offset] with an empty attribute': async (query) => {
  //   await query(
  //     {
  //       $entity: 'User',
  //       $fields: ['id', 'email'],
  //       $sort: ['email'],
  //     },
  //     { noMetadata: true },
  //   );
  // },
  'i1[inherited, attributes] Entity with inherited attributes': async (query) => {
    await query({ $entity: 'God', $id: 'god1' }, { noMetadata: true });
  },
  // 'TODO{TS}:i2[inherited, attributes] Entity with inherited attributes should fetch them even when querying from parent class': async (query) => {
  //   await query({ $entity: 'User', $id: 'god1' }, { noMetadata: true });
  // },
  's1[self] Relation playing a a role defined by itself': async (query) => {
    await query({ $relation: 'Self' }, { noMetadata: true });
  },
  'ex1[extends] Query where an object plays 3 different roles because it extends 2 types': async (query) => {
    await query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });
  },
  'ex2[extends] Query of the parent': async (query) => {
    await query({ $entity: 'Space', $id: 'space-2', $fields: ['objects'] }, { noMetadata: true });
  },
  // 'TODO{TS}:re1[repeated] Query with repeated path, different nested ids': async (query) => {
  //   await query(
  //     {
  //       $entity: 'Space',
  //       $id: 'space-2',
  //       $fields: [
  //         { $path: 'users', $id: 'user2', $fields: ['id', 'name'] },
  //         { $path: 'users', $id: 'user3', $fields: ['id', { $path: 'accounts', $fields: ['id', 'provider'] }] },
  //       ],
  //     },
  //     { noMetadata: true },
  //   );
  // },
  // 'TODO{TS}:re2[repeated] Query with repeated path, different nested patterns': async (query) => {
  //   await query(
  //     {
  //       $entity: 'Space',
  //       $id: 'space-2',
  //       $fields: ['users', { $path: 'users', $id: 'user3', $fields: ['id', 'name'] }],
  //     },
  //     { noMetadata: true },
  //   );
  // },
  'xf1[excludedFields] Testing excluded fields': async (query) => {
    await query(
      {
        $entity: 'God',
        $id: 'god1',
        $excludedFields: ['email', 'isEvil'],
      },
      { noMetadata: true },
    );
  },
  'xf2[excludedFields, deep] - deep nested': async (query) => {
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
  'xf3[excludedFields, deep] - Exclude virtual field': async (query) => {
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
  'vi1[virtual, attribute] Virtual DB field': async (query) => {
    await query({ $entity: 'Account', $fields: ['id', 'isSecureProvider'] }, { noMetadata: true });
  },
  'vi2[virtual, edge] Virtual DB edge field': async (query) => {
    await query({ $entity: 'Hook' }, { noMetadata: true });
  },
  'co1[computed] Virtual computed field': async (query) => {
    await query({ $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'isBlue'] }, { noMetadata: true });
  },
  'co2[computed] Computed virtual field depending on edge id': async (query) => {
    await query(
      { $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'user-tags', 'totalUserTags'] },
      { noMetadata: true },
    );
  },
  // 'TODO{TS}:co3[computed], Computed virtual field depending on edge id, missing dependencies': async (query) => {
  //   await query(
  //     { $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'totalUserTags'] },
  //     { noMetadata: true },
  //   );
  // },
  'mv1[multiVal, query, ONE], get multiVal': async (query) => {
    await query({ $entity: 'Color', $fields: ['id', 'freeForAll'] }, { noMetadata: true });
  },
  'TODO{T}:mv2[multiVal, query, ONE], filter by multiVal': async (query) => {
    await query(
      { $entity: 'Color', $filter: { freeForAll: 'hey' }, $fields: ['id', 'freeForAll'] },
      { noMetadata: true },
    );
  },
  'a1[$as] - as for attributes and roles and links': async (query) => {
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
  'bq1[batched query] - as for attributes and roles and links': async (query) => {
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
  'j1[json] Query a thing with a JSON attribute': async (query) => {
    await query({
      $entity: 'Account',
      $id: 'account1-1',
      $fields: ['profile'],
    });
  },
  'j2[json] Query a thing with an empty JSON attribute': async (query) => {
    await query({
      $entity: 'Account',
      $id: 'account1-2',
      $fields: ['profile'],
    });
  },
  // 'TODO{TS}:bq2[batched query with $as] - as for attributes and roles and links': async (query) => {
  //   await query(
  //     {
  //       // @ts-expect-error change RawBQLQuery type
  //       $queryType: 'batched',
  //       users: {
  //         $entity: 'User',
  //         $fields: ['id'],
  //         $id: 'user1',
  //       },
  //       spaces: {
  //         $entity: 'Space',
  //         $fields: ['id'],
  //         $id: 'space-1',
  //       },
  //     },
  //     { noMetadata: true },
  //   );
  // },
  'dn1[deep nested] ridiculously deep nested query': async (query) => {
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
  'TODO{T}:dn2[deep numbers] Big numbers': async (query) => {
    await query(
      {
        $entity: 'Company',
        $filter: { employees: { name: ['Employee 78f', 'Employee 187f', 'Employee 1272f', 'Employee 9997f'] } },
        $fields: ['id'],
      },
      { noMetadata: true },
    );
  },
  'TODO{T}:dn3[deep numbers] Big numbers nested': async (query) => {
    await query(
      {
        $entity: 'Company',
        $filter: { employees: { name: ['Employee 78f'] } },
        $fields: ['id', { $path: 'employees' }],
      },
      { noMetadata: true },
    );
  },
  'fk1[filter, keywords, exists], filter by undefined/null property': async (query) => {
    await query({ $entity: 'User', $filter: { email: { $exists: false } } }, { noMetadata: true });
  },
  'fk2[filter, keywords, exists], filter by undefined/null property': async (query) => {
    await query({ $entity: 'User', $filter: { email: { $exists: true } } }, { noMetadata: true });
  },
  'TODO{T}:ref1[ref, ONE] Get reference, id only': async (query) => {
    await query({ $entity: 'FlexRef', $id: 'fr1', $fields: ['id', 'reference'] }, { noMetadata: true });
  },
  // 'TODO{T}:ref1n[ref, ONE, nested] Get also nested data': async (query) => {
  //   await query(
  //     {
  //       $entity: 'FlexRef',
  //       $id: 'fr1',
  //       $fields: ['id', { $path: 'reference' }],
  //     },
  //     { noMetadata: true },
  //   );
  // },
  // 'TODO{T}:ref1nf[ref, ONE, nested, someFields] Get also nested data but only some fields': async (query) => {
  //   await query(
  //     {
  //       $entity: 'FlexRef',
  //       $id: 'fr1',
  //       $fields: ['id', { $path: 'reference', $fields: ['id', 'accounts', 'email'] }],
  //     },
  //     { noMetadata: true },
  //   );
  // },
  'TODO{T}:ref2[ref, MANY] Get references, id only': async (query) => {
    await query({ $entity: 'FlexRef', $id: 'fr2' }, { noMetadata: true });
  },
  'TODO{T}:ref3[ref, flex, ONE] Get flexReference': async (query) => {
    await query({ $entity: 'FlexRef', $id: ['fr3', 'fr4'] }, { noMetadata: true });
  },
  'TODO{T}:ref4[ref, flex, MANY] Get flexReferences': async (query) => {
    await query({ $entity: 'FlexRef', $id: 'fr5' }, { noMetadata: true });
  },
  // 'TODO{T}:ref4nf[ref, flex, MANY, nested] Get flexReferences with nested data': async (query) => {
  //   await query(
  //     { $entity: 'FlexRef', $id: 'fr5', $fields: ['id', { $path: 'flexReferences' }] },
  //     { noMetadata: true },
  //   );
  // },
  // 'TODO{T}:ref4n[ref, flex, MANY, nested, $fields] Get flexReferences with nested data but only some fields': async (query) => {
  //   await query(
  //     {
  //       $entity: 'FlexRef',
  //       $id: 'fr5',
  //       $fields: ['id', { $path: 'flexReferences', $fields: ['id', 'name', 'user-tags'] }],
  //     },
  //     { noMetadata: true },
  //   );
  // },
};

const main = async () => {
  const { client, cleanup } = await init();

  const query: QueryFn = async (query, config) => {
    client.query(query, { ...config, legacySurrealDBAdapter: LEGACY_SURREALDB_ADAPTER });
  };

  const result: (Record<string, string | number | undefined> | null)[] = [];

  for (const [name, task] of Object.entries(tasks)) {
    const bench = new Bench({
      concurrency: null,
      retainSamples: false,
      time: 1,
      iterations: 10,
    });
    bench.add(name, async () => {
      await task(query);
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
