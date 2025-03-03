/* eslint-disable prefer-destructuring */

import { expect, it } from 'vitest';
import { createTest } from '../../helpers/createTest';
import { deepSort } from '../../helpers/matchers';

export const testFilteredMutation = createTest('Mutation: Filtered', (ctx) => {
  //DATAFIELDS
  it('df1[filter with pre query] complete a mutation by filter', async () => {
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

  it('df2[filter with pre query] complete a mutation by filter', async () => {
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
  it('TODO{T}:rf1[filter, rolefield] filter by rolefield', async () => {
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

  it('TODO{T}:lf1[filter, linkfield, relation] filter by rolefield:rel', async () => {
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

  it('TODO{T}:lf2[filter, linkfield, role] filter by rolefield:role', async () => {
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
});
