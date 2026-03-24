import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { BQLMutation } from './parse';

/**
 * Apply default values for create nodes and convert string dates to Date objects.
 */
export const applyDefaults = (
  input: BQLMutation | BQLMutation[],
  schema: DRAFT_EnrichedBormSchema,
): BQLMutation | BQLMutation[] => {
  if (Array.isArray(input)) {
    for (const node of input) {
      applyDefaultsToNode(node, schema);
    }
    return input;
  }
  applyDefaultsToNode(input, schema);
  return input;
};

const applyDefaultsToNode = (node: BQLMutation, schema: DRAFT_EnrichedBormSchema): void => {
  const thing = node.$thing ? schema[node.$thing] : undefined;

  if (thing && node.$op === 'create') {
    // Apply default values for data fields
    for (const field of Object.values(thing.fields)) {
      if (field.type !== 'data') {
        continue;
      }
      if (field.isVirtual) {
        continue;
      }
      if (!field.default) {
        continue;
      }
      if (node[field.name] !== undefined) {
        continue;
      }

      if (field.default.type === 'value') {
        if (field.default.value !== null) {
          node[field.name] = field.default.value;
        }
      } else if (field.default.type === 'fn') {
        const currentNode: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node)) {
          if (!k.startsWith('$')) {
            currentNode[k] = v;
          }
        }
        const result = field.default.fn(currentNode);
        if (result !== null) {
          node[field.name] = result;
        }
      }
    }
  }

  // Convert string dates to Date objects for DATE/DATETIME content types
  if (thing) {
    for (const field of Object.values(thing.fields)) {
      if (field.type !== 'data') {
        continue;
      }
      if (field.contentType !== 'DATE' && field.contentType !== 'TIME') {
        continue;
      }
      const value = node[field.name];
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          node[field.name] = date;
        }
      }
    }
  }

  // Recurse into nested children
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNestedBlock(item)) {
          applyDefaultsToNode(item as BQLMutation, schema);
        }
      }
    } else if (isNestedBlock(value)) {
      applyDefaultsToNode(value as BQLMutation, schema);
    }
  }
};

const isNestedBlock = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  Object.keys(value).some((k) => k.startsWith('$'));
