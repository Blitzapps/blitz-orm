import { expect, it } from 'vitest';
import { createTest } from '../../helpers/createTest';

export const testJsonRefsMutation = createTest('Mutation: JSON Refs', (ctx) => {
  it('j1[json-refs] Single reference in JSON field', async () => {
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

  it('j2[json-refs] Array of references in JSON field', async () => {
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

  it('j3[json-refs] Mixed references and plain data in an array', async () => {
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
});
