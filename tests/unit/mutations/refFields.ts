/* eslint-disable prefer-destructuring */

import { expect, it } from 'vitest';
import type { BQLResponseSingle } from '../../../src';
import { createTest } from '../../helpers/createTest';
import { deepSort } from '../../helpers/matchers';

export const testRefFieldsMutations = createTest('Mutation: RefFields', (ctx) => {
  // 1. Entities
  it('TODO{T}:fl1[ref, ent, one] Create entity with flexible values and read it', async () => {
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

  it('TODO{T}:fl1r[ref, ent, one, replace]', async () => {
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
  it('TODO{T}:fl2[ref, many] Test MANY cardinality with REF type', async () => {
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

  it('TODO{TS}:fl2add[ref, many, add] Add to existing', async () => {
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

  it('TODO{TS}:fl2rem[ref, many, remove] Remove existing', async () => {
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

  it('TODO{TS}:fl2rem2[ref, many, remove, all] Remove all', async () => {
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

  it('TODO{T}:fl2rep[ref, many, replace] Replace existing', async () => {
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

  it('TODO{T}:fl2repShort[ref, many, replace, prefix] Replace existing using prefix', async () => {
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
  it('TODO{T}:fl3[ref, flex, one] Test ONE cardinality with FLEX type', async () => {
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

  it('TODO{T}:fl4[ref, flex, many] Test MANY cardinality with FLEX type', async () => {
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
      flexReferences: ['hey', 'fl4-u1', 8, 'fl4-u2', new Date('2024-01-01').toISOString()],
    });
  });

  // 2.Relations
  // 2.1 REF

  it('TODO{T}:fl1[ref, one, rel] Create relation with flexible values and read it', async () => {
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

  it('TODO{T}:flr1r[ref, one, replace] Replace existing relation reference', async () => {
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

  it('TODO{T}:flr2[ref, many] Test MANY cardinality with REF type in relations', async () => {
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

  it('TODO{TS}:flr2add[ref, many, add] Add to existing relation references', async () => {
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

  it('TODO{TS}:flr2rem[ref, many, remove] Remove existing relation reference', async () => {
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

  it('TODO{T}:flr2rep[ref, many, replace] Replace existing relation references', async () => {
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

  it('TODO{T}:flr2repShort[ref, many, replace, prefix] Replace existing relation references with prefixes', async () => {
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
  });

  // 2.2 FLEX

  it('TODO{T}:flr3[ref, flex, one] Test ONE cardinality with FLEX type in relations', async () => {
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

  it('TODO{T}:flr4[ref, flex, many] Test MANY cardinality with FLEX type in relations', async () => {
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
      flexReferences: ['hey', 'flr4-u1', 8, 'flr4-u2', new Date('2024-01-01').toISOString()],
    });
  });

  it('TODO{T}:flr5[ref, flex, many,replace] Test replace in flex ref field in relations', async () => {
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
      flexReferences: ['1990-10-10T00:00:00.000Z', 9, 'hello', 'flr5-u2'],
    });
  });
});
