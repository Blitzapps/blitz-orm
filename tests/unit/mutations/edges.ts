import { expect, it } from 'vitest';
import type { BQLResponseSingle } from '../../../src';
import { createTest } from '../../helpers/createTest';
import { deepSort } from '../../helpers/matchers';
import type { KindType } from '../../types/testTypes';

export const testEdgesMutation = createTest('Mutation: Edges', (ctx) => {
  it('l1[link, add, nested, relation] Update entity by adding a new created relation children. Also test getting ids by tempId', async () => {
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
  });

  it('l2[link, nested, relation] Create and update 3-level nested. Also test getting ids by type', async () => {
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

  it('l3ent[unlink, multiple, entity] unlink multiple linkFields (not roleFields)', async () => {
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

  it('l3rel[unlink, simple, relation] unlink link in relation but one role per time', async () => {
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

  it('l4[link, add, relation, nested] add link in complex relation. Also unlink test to be splitted somewhere', async () => {
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
  });

  it('l5[unlink, nested] unlink by id', async () => {
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

  it('l6[link, many] explicit link to many', async () => {
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

  it('l7[unlink, all, nested] unlink all from one particular role', async () => {
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

  it('l7b[unlink, all, nested] unlink all from two roles', async () => {
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

  it('l7c[unlink, all, nested] unlink all from two roles but one is empty', async () => {
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

  it('l8[create, link, relation, unsupported] Create relation and link it to multiple existing things', async () => {
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

  it('l9[create,relation] Create relation multiple edges. Relation without roles should disappear', async () => {
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

  it('l10[create, link, relation] Create relation and link it to multiple existing things', async () => {
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

  it.skip('TODO{S}l11[link, replace, relation] Get existing relation and link it to multiple existing things', async () => {
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
  });

  it('TODO{T}:l11-strict[link, replace, relation] Get existing relation and link it to multiple existing things', async () => {
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
  });

  it('l12[link,many] Insert items in multiple', async () => {
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

  it('l13[unlink, nested, relation, extends] Unlink in nested array[l3ent,b4]', async () => {
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

  it('l14[unlink, nested, relation] Unlink all in role', async () => {
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

  it('l15[replace, nested, ONE, role] replace role in nested', async () => {
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

  it('l15b[unlink, link, nested, relation] Unlink in a nested field', async () => {
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

  it('TODO{TS}:l16[replace, nested, create, replace] replacing nested under a create', async () => {
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

  // Todo: ask loic why there's an all link
  it('TODO{TS}:rep2b[replace, unlink, link, many] Replace using unlink + link , all link', async () => {
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

  it('TODO{TS}:rep2c[replace, unlink, link, many] Replace using unlink + link , all link', async () => {
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

  it('rep3[replace, many, multi] Replace multiple fields', async () => {
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

  it('rep4[replace, multiId] Replace multiple ids', async () => {
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

  it('rep5[replace, cardOne] Replace indirectly a card one field', async () => {
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

  it('TODO{T}:one1[link, cardinality one] link a cardinality one relation', async () => {
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

  it('TODO{TS}:h1[unlink, hybrid] hybrid intermediary relation and direct relation', async () => {
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

  it('TODO{TS}:h2[link, hybrid] hybrid intermediary relation and direct relation', async () => {
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

  it('lm-i1[link and unlink many, intermediary] linking and unlinking many things at once with intermediary, not batched, on-create', async () => {
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
  });

  it('lm-i2[link and unlink many] linking and unlinking many things at once with intermediary, batched, on-create', async () => {
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
  });

  it('lm-i3[link and unlink many, intermediary] linking and unlinking many things at once with intermediary, not batched, pre-created', async () => {
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
  });

  it('lm-i4[link and unlink many, intermediary] linking and unlinking many things at once batched with intermediary, batched, pre-created', async () => {
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
  });

  it('lm-ni1[link and unlink many] linking and unlinking many things at once without intermediary, not batched, on-create', async () => {
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
  });

  it('lm-ni2[link and unlink many] linking and unlinking many things at once without intermediary, batched, on-create', async () => {
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
  });

  it('lm-ni3[link and unlink many] linking and unlinking many things at once without intermediary, not batched, pre-created', async () => {
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
  });

  it('lm-ni4[link and unlink many] linking and unlinking many things at once without intermediary, batched, pre-created', async () => {
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
  });

  it('d-pq1[delete with pre query, intermediary, nested] delete mutation from root and delete children with intermediary', async () => {
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

    const expressions = await ctx.query({
      $relation: 'Expression',
    }, { returnNulls: true });

    const values = await ctx.query({
      $relation: 'DataValue',
    }, { returnNulls: true });

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
  });

  it('d-pq2[delete with pre query, intermediary, nested] delete mutation from root and delete children with intermediary', async () => {
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
  });

  it('TODO{TS}:d-pq3[delete with pre query, intermediary, nested, nothing to delete] delete mutation from root and delete children but there are no children with intermediary', async () => {
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
  });

  it('ul-pq1[unlink with pre query, intermediary, nested] unlink mutation from root and delete children with intermediary', async () => {
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
  });

  it('up-pq1[update with pre query, intermediary, nested] update mutation from root and delete children with intermediary', async () => {
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
  });

  it('rep-del1[delete, replace, ONE] replace on cardinality ONE but deleting existing', async () => {
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

  it('TODO:m1[Multi] Multi nested, deletion and creation same brach', async () => {
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

  it('m2[Multi, deep] Multi nested, deletion and creation same brach. Deep', async () => {
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

  it('TODO{TS}:m3[Multi, deep] Multi nested, deletion and creation same brach. Deeper!', async () => {
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
});
