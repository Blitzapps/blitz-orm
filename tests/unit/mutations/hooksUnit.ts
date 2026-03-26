import { describe, expect, it } from 'vitest';
import { applyDefaultsAndHooks } from '../../../src/stateMachine/mutation/surql2/hooks';
import type { BQLMutation } from '../../../src/stateMachine/mutation/surql2/parse';
import type { BormConfig } from '../../../src/types';
import type { DRAFT_EnrichedBormSchema } from '../../../src/types/schema/enriched.draft';

/**
 * Minimal schema: Parent -[children (link)]-> Child (relation).
 * Child has a role field "parent" pointing back to Parent.
 */
const makeSchema = (childHooks?: DRAFT_EnrichedBormSchema['string']['hooks']): DRAFT_EnrichedBormSchema => ({
  Parent: {
    type: 'entity',
    name: 'Parent',
    idFields: ['id'],
    subTypes: [],
    indexes: [],
    fields: {
      id: { type: 'data', name: 'id', contentType: 'ID', cardinality: 'ONE', unique: true },
      children: {
        type: 'link',
        name: 'children',
        cardinality: 'MANY',
        relation: 'Child',
        plays: 'parent',
        target: 'relation',
        opposite: { thing: 'Child', path: 'parent', cardinality: 'ONE' },
      },
    },
  },
  Child: {
    type: 'relation',
    name: 'Child',
    idFields: ['id'],
    subTypes: [],
    indexes: [],
    hooks: childHooks,
    fields: {
      id: { type: 'data', name: 'id', contentType: 'ID', cardinality: 'ONE', unique: true },
      name: { type: 'data', name: 'name', contentType: 'TEXT', cardinality: 'ONE', unique: false },
      parent: {
        type: 'role',
        name: 'parent',
        cardinality: 'ONE',
        opposite: { thing: 'Parent', path: 'children', cardinality: 'MANY' },
      },
    },
  },
});

const config = {} as BormConfig;

export const testHooksUnit = () => {
  describe('Hooks unit: inferChildThingAndOp', () => {
    it('hu1[hooks, unit] Infer $thing and run hooks for delete-only children', () => {
      let transformCalled = false;

      const schema = makeSchema({
        pre: [
          {
            triggers: { onDelete: () => true },
            actions: [
              {
                type: 'transform',
                fn: () => {
                  transformCalled = true;
                  return {};
                },
              },
            ],
          },
        ],
      });

      const mutation: BQLMutation = {
        $id: 'parent-1',
        $op: 'update',
        $thing: 'Parent',
        children: [{ $id: 'child-1', $op: 'delete' }],
      };

      applyDefaultsAndHooks(mutation, schema, config);

      const child = (mutation.children as BQLMutation[])[0];
      expect(child.$thing).toBe('Child');
      expect(transformCalled).toBe(true);
    });

    it('hu2[hooks, unit] Infer $thing for children with only $id (link op)', () => {
      const schema = makeSchema();

      const mutation: BQLMutation = {
        $id: 'parent-1',
        $op: 'update',
        $thing: 'Parent',
        children: [{ $id: 'child-1' }],
      };

      applyDefaultsAndHooks(mutation, schema, config);

      const child = (mutation.children as BQLMutation[])[0];
      expect(child.$thing).toBe('Child');
      expect(child.$op).toBe('link');
    });

    it('hu3[hooks, unit] Still infer $thing for children with non-$ keys (existing behavior)', () => {
      const schema = makeSchema();

      const mutation: BQLMutation = {
        $id: 'parent-1',
        $op: 'update',
        $thing: 'Parent',
        children: [{ $id: 'child-1', name: 'updated' }],
      };

      applyDefaultsAndHooks(mutation, schema, config);

      const child = (mutation.children as BQLMutation[])[0];
      expect(child.$thing).toBe('Child');
      expect(child.$op).toBe('update');
    });

    it('hu5[hooks, unit] Transform returning undefined strips field from mutation', () => {
      const schema = makeSchema({
        pre: [
          {
            triggers: { onUpdate: () => true },
            actions: [
              {
                type: 'transform',
                fn: () => {
                  return { name: undefined };
                },
              },
            ],
          },
        ],
      });

      const mutation: BQLMutation = {
        $id: 'child-1',
        $op: 'update',
        $thing: 'Child',
        name: 'Foo',
      };

      applyDefaultsAndHooks(mutation, schema, config);

      // undefined means "don't mutate this field", so name should be removed from the node
      expect('name' in mutation).toBe(false);
    });

    it('hu6[hooks, unit] Transform returning null keeps field as null in mutation', () => {
      const schema = makeSchema({
        pre: [
          {
            triggers: { onUpdate: () => true },
            actions: [
              {
                type: 'transform',
                fn: () => {
                  return { name: null };
                },
              },
            ],
          },
        ],
      });

      const mutation: BQLMutation = {
        $id: 'child-1',
        $op: 'update',
        $thing: 'Child',
        name: 'Foo',
      };

      applyDefaultsAndHooks(mutation, schema, config);

      // null means "set to null/unlink", so name should remain with null value
      expect(mutation.name).toBe(null);
    });

    it('hu4[hooks, unit] Run validation hooks for delete-only children', () => {
      const schema = makeSchema({
        pre: [
          {
            triggers: { onDelete: () => true },
            actions: [
              {
                type: 'validate',
                severity: 'error',
                message: 'Cannot delete this child',
                fn: () => false,
              },
            ],
          },
        ],
      });

      const mutation: BQLMutation = {
        $id: 'parent-1',
        $op: 'update',
        $thing: 'Parent',
        children: [{ $id: 'child-1', $op: 'delete' }],
      };

      expect(() => applyDefaultsAndHooks(mutation, schema, config)).toThrow('Cannot delete this child');
    });
  });
};
