import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { BQLMutation } from './parse';

/**
 * Walk the mutation tree and infer $thing (and $op if missing) for nested blocks
 * using the parent field's schema context. This allows hooks and other phases
 * to know the thing type of deeply nested blocks that have no $-prefixed keys.
 */
export const inferThingFromSchema = (input: BQLMutation | BQLMutation[], schema: DRAFT_EnrichedBormSchema): void => {
  const nodes = Array.isArray(input) ? input : [input];
  for (const node of nodes) {
    inferNodeThing(node, schema);
  }
};

const inferNodeThing = (node: BQLMutation, schema: DRAFT_EnrichedBormSchema): void => {
  const thingSchema = node.$thing ? schema[node.$thing] : undefined;
  if (!thingSchema) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || value === null || value === undefined) {
      continue;
    }

    const fieldSchema = thingSchema.fields[key];
    if (!fieldSchema) {
      continue;
    }

    // Determine the child thing type from the field schema
    let childThing: string | undefined;
    if (fieldSchema.type === 'role') {
      childThing = fieldSchema.opposite.thing;
    } else if (fieldSchema.type === 'link') {
      childThing = fieldSchema.target === 'relation' ? fieldSchema.relation : fieldSchema.opposite.thing;
    }

    if (!childThing) {
      continue;
    }

    const processChild = (child: unknown): void => {
      if (typeof child !== 'object' || child === null || Array.isArray(child) || child instanceof Date) {
        return;
      }
      const obj = child as BQLMutation;
      if (!obj.$thing) {
        // Verify this object looks like a mutation block for this thing
        // (has at least one key matching a field name or the id field)
        const childSchema = schema[childThing!];
        if (childSchema) {
          const objKeys = Object.keys(obj).filter((k) => !k.startsWith('$'));
          const looksLikeMutation =
            objKeys.length > 0 && objKeys.some((k) => k in childSchema.fields || k === childSchema.idFields[0]);
          if (looksLikeMutation) {
            obj.$thing = childThing;
            if (!obj.$op) {
              if (obj.$id) {
                obj.$op = 'link';
              } else if (node.$op === 'create') {
                // Under a create parent, nested objects are creates
                obj.$op = 'create';
              }
              // For update parents with ONE-cardinality fields, leave $op unset
              // so the ambiguity check in buildLogical fires
            }
          }
        }
      }
      // Recurse
      inferNodeThing(obj, schema);
    };

    if (Array.isArray(value)) {
      for (const item of value) {
        processChild(item);
      }
    } else {
      processChild(value);
    }
  }
};
