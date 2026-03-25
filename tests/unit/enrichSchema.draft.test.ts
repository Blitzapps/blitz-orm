import { describe, expect, it } from 'vitest';
import { enrichSchemaDraft } from '../../src/enrichSchema.draft';
import type { BormSchema } from '../../src/types';

describe('enrichSchemaDraft', () => {
  describe('multi-level inheritance', () => {
    const hookC = {
      actions: [
        {
          type: 'transform' as const,
          fn: () => ({ fromC: true }),
        },
      ],
    };

    const hookB = {
      actions: [
        {
          type: 'transform' as const,
          fn: () => ({ fromB: true }),
        },
      ],
    };

    const hookA = {
      actions: [
        {
          type: 'transform' as const,
          fn: () => ({ fromA: true }),
        },
      ],
    };

    // C (grandparent) -> B (parent) -> A (child)
    // Also: D plays a role in Rel so link fields resolve correctly.
    const schema: BormSchema = {
      entities: {
        C: {
          idFields: ['id'],
          defaultDBConnector: { id: 'default' },
          dataFields: [
            { path: 'id', contentType: 'ID', cardinality: 'ONE' },
            { path: 'fieldFromC', contentType: 'TEXT', cardinality: 'ONE' },
          ],
          linkFields: [
            {
              path: 'relTarget',
              relation: 'Rel',
              cardinality: 'ONE',
              plays: 'source',
              target: 'role',
              targetRole: 'target',
            },
          ],
          refFields: {
            refFromC: { contentType: 'REF', cardinality: 'ONE' },
          },
          hooks: { pre: [hookC] },
        },
        B: {
          extends: 'C',
          defaultDBConnector: { id: 'default' },
          dataFields: [{ path: 'fieldFromB', contentType: 'TEXT', cardinality: 'ONE' }],
          hooks: { pre: [hookB] },
        },
        A: {
          extends: 'B',
          defaultDBConnector: { id: 'default' },
          dataFields: [{ path: 'fieldFromA', contentType: 'TEXT', cardinality: 'ONE' }],
          hooks: { pre: [hookA] },
        },
        D: {
          idFields: ['id'],
          defaultDBConnector: { id: 'default' },
          dataFields: [{ path: 'id', contentType: 'ID', cardinality: 'ONE' }],
          linkFields: [
            {
              path: 'relSource',
              relation: 'Rel',
              cardinality: 'ONE',
              plays: 'target',
              target: 'role',
              targetRole: 'source',
            },
          ],
        },
      },
      relations: {
        Rel: {
          idFields: ['id'],
          defaultDBConnector: { id: 'default', path: 'rel' },
          dataFields: [{ path: 'id', contentType: 'ID', cardinality: 'ONE' }],
          roles: {
            source: { cardinality: 'ONE' },
            target: { cardinality: 'ONE' },
          },
        },
      },
    };

    const enriched = enrichSchemaDraft(schema);
    const enrichedA = enriched.A;
    const enrichedB = enriched.B;

    it('A inherits idFields from C (grandparent)', () => {
      expect(enrichedA.idFields).toEqual(['id']);
    });

    it('A inherits data fields from C and B', () => {
      const fieldNames = Object.keys(enrichedA.fields).filter((k) => enrichedA.fields[k].type === 'data');
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('fieldFromC');
      expect(fieldNames).toContain('fieldFromB');
      expect(fieldNames).toContain('fieldFromA');
    });

    it('A inherits link fields from C', () => {
      const linkFields = Object.values(enrichedA.fields).filter((f) => f.type === 'link');
      expect(linkFields).toHaveLength(1);
      expect(linkFields[0].name).toBe('relTarget');
    });

    it('A inherits ref fields from C', () => {
      const refFields = Object.values(enrichedA.fields).filter((f) => f.type === 'ref');
      expect(refFields).toHaveLength(1);
      expect(refFields[0].name).toBe('refFromC');
    });

    it('A inherits hooks from C and B, merged in order', () => {
      expect(enrichedA.hooks?.pre).toHaveLength(3);
      // Order: grandparent -> parent -> child
      expect(enrichedA.hooks?.pre?.[0]).toBe(hookC);
      expect(enrichedA.hooks?.pre?.[1]).toBe(hookB);
      expect(enrichedA.hooks?.pre?.[2]).toBe(hookA);
    });

    it('B inherits data fields from C', () => {
      const fieldNames = Object.keys(enrichedB.fields).filter((k) => enrichedB.fields[k].type === 'data');
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('fieldFromC');
      expect(fieldNames).toContain('fieldFromB');
    });

    it('B inherits hooks from C, merged in order', () => {
      expect(enrichedB.hooks?.pre).toHaveLength(2);
      expect(enrichedB.hooks?.pre?.[0]).toBe(hookC);
      expect(enrichedB.hooks?.pre?.[1]).toBe(hookB);
    });

    it('C is listed as ancestor via extends chain', () => {
      expect(enrichedA.extends).toBe('B');
      expect(enrichedB.extends).toBe('C');
    });

    it('C has A and B as subTypes, B has A as subType', () => {
      const enrichedC = enriched.C;
      expect(enrichedC.subTypes).toContain('A');
      expect(enrichedC.subTypes).toContain('B');
      expect(enrichedB.subTypes).toContain('A');
    });
  });
});
