import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { BQLMutation, BQLMutationOp } from './parse';

/**
 * Infer $op for every node in the mutation tree that doesn't already have one.
 * After this phase, $op is guaranteed to be set on every node.
 *
 * Uses schema to determine whether a nested object is a mutation block
 * (under role/link/ref fields) or a plain data value (under data fields).
 */
export const inferOp = (
  input: BQLMutation | BQLMutation[],
  schema: DRAFT_EnrichedBormSchema,
): BQLMutation | BQLMutation[] => {
  if (Array.isArray(input)) {
    return input.map((node) => inferNodeOp(node, false, schema)).filter((node): node is BQLMutation => node !== null);
  }
  const result = inferNodeOp(input, false, schema);
  if (!result) {
    throw new Error('[Wrong format] Root mutation node cannot be a filter-only block with no operations');
  }
  return result;
};

const inferNodeOp = (
  node: BQLMutation,
  isNestedUnderCreate: boolean,
  schema: DRAFT_EnrichedBormSchema,
): BQLMutation | null => {
  const hasNonDollarFields = Object.keys(node).some((k) => !k.startsWith('$'));

  if (!node.$op) {
    // A block with only $filter (no $id, no $tempId, no non-$ fields) is silently removed
    const hasId = node.$id !== undefined;
    const hasFilter = node.$filter !== undefined;
    const hasTempId = node.$tempId !== undefined;
    if (hasFilter && !hasId && !hasTempId && !hasNonDollarFields) {
      return null;
    }
    node.$op = inferOpFromContext(node, hasNonDollarFields);
  }

  validateConstraints(node, hasNonDollarFields, isNestedUnderCreate);

  // Recurse into nested children — only into fields that are role/link/ref in the schema
  const childIsUnderCreate = isNestedUnderCreate || node.$op === 'create';
  const thingSchema = node.$thing ? schema[node.$thing] : undefined;

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }

    // Use schema to determine if this field can contain nested mutation blocks.
    // If the thing is unknown (no $thing), we can't check — allow recursion into
    // objects that have $-prefixed keys (they'll be validated by later phases).
    if (thingSchema) {
      const fieldSchema = thingSchema.fields[key];
      if (fieldSchema && fieldSchema.type !== 'role' && fieldSchema.type !== 'link' && fieldSchema.type !== 'ref') {
        // Data, constant, or computed field — skip recursion
        continue;
      }
    }

    if (Array.isArray(value)) {
      const filtered: unknown[] = [];
      for (const item of value) {
        if (isObject(item)) {
          if (hasMutationKeys(item)) {
            const result = inferNodeOp(item as BQLMutation, childIsUnderCreate, schema);
            if (result !== null) {
              filtered.push(result);
            }
          } else {
            // No $-keys but under a nestable field — recurse to find deeper mutation blocks
            recurseIntoPlainBlock(item, childIsUnderCreate, schema);
            filtered.push(item);
          }
        } else {
          filtered.push(item);
        }
      }
      node[key] = filtered;
    } else if (isObject(value)) {
      if (hasMutationKeys(value)) {
        const result = inferNodeOp(value as BQLMutation, childIsUnderCreate, schema);
        if (result === null) {
          delete node[key];
        }
      } else {
        recurseIntoPlainBlock(value, childIsUnderCreate, schema);
      }
    }
  }

  return node;
};

/**
 * Recurse into a plain object (no $-keys) under a nestable field to find
 * deeper nested mutation blocks that need $op inference.
 */
const recurseIntoPlainBlock = (
  obj: Record<string, unknown>,
  isNestedUnderCreate: boolean,
  schema: DRAFT_EnrichedBormSchema,
): void => {
  for (const [, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isObject(item)) {
          if (hasMutationKeys(item)) {
            inferNodeOp(item as BQLMutation, isNestedUnderCreate, schema);
          } else {
            recurseIntoPlainBlock(item, isNestedUnderCreate, schema);
          }
        }
      }
    } else if (isObject(value)) {
      if (hasMutationKeys(value)) {
        inferNodeOp(value as BQLMutation, isNestedUnderCreate, schema);
      } else {
        recurseIntoPlainBlock(value, isNestedUnderCreate, schema);
      }
    }
  }
};

const inferOpFromContext = (node: BQLMutation, hasNonDollarFields: boolean): BQLMutationOp => {
  const hasId = node.$id !== undefined;
  const hasFilter = node.$filter !== undefined;
  const hasTempId = node.$tempId !== undefined;

  // Rule 1: Has $id or $filter, and has non-$ fields → update
  if ((hasId || hasFilter) && hasNonDollarFields) {
    return 'update';
  }

  // Rule 2: Has $id, and has NO non-$ fields → link
  if (hasId && !hasNonDollarFields) {
    return 'link';
  }

  // Rule 3: Has $tempId and has non-$ fields → create
  if (hasTempId && hasNonDollarFields) {
    return 'create';
  }

  // Rule 4: Has $tempId and has NO non-$ fields → link
  if (hasTempId && !hasNonDollarFields) {
    return 'link';
  }

  // Rule 5: None of the above → create
  return 'create';
};

const validateConstraints = (node: BQLMutation, _hasNonDollarFields: boolean, isNestedUnderCreate: boolean): void => {
  const op = node.$op!;

  // Validate tempId format
  if (node.$tempId && !node.$tempId.startsWith('_:')) {
    throw new Error('[Wrong format] TempIds must start with "_:"');
  }

  if (op === 'create') {
    if (node.$id !== undefined) {
      throw new Error("[Wrong format] Can't write to computed field $id. Try writing to the id field directly.");
    }
    if (node.$filter !== undefined) {
      throw new Error("[Wrong format] Can't use $filter with $op: 'create'.");
    }
  }

  // Validate tempId+op combinations (before data field checks)
  if (node.$tempId) {
    if (op === 'delete') {
      throw new Error(
        'Invalid op delete for tempId. TempIds can be created, or linked when created in another part of the same mutation.',
      );
    }
    if (op === 'unlink') {
      throw new Error(
        'Invalid op unlink for tempId. TempIds can be created, or linked when created in another part of the same mutation.',
      );
    }
  }

  if (isNestedUnderCreate) {
    if (op === 'update') {
      throw new Error('[Wrong format] Cannot update under a create');
    }
    if (op === 'delete') {
      throw new Error('[Wrong format] Cannot delete under a create');
    }
    if (op === 'unlink') {
      throw new Error('[Wrong format] Cannot unlink under a create');
    }
  }

  if (op === 'delete') {
    if (hasDataFields(node)) {
      throw new Error(`Cannot set data fields with $op: 'delete'.`);
    }
  }

  if (op === 'link' || op === 'unlink') {
    if (hasDataFields(node)) {
      throw new Error("[Unsupported] Can't update fields on Link / Unlink");
    }
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

/**
 * Check if an object has $-prefixed keys that indicate it's a mutation block.
 */
const hasMutationKeys = (value: Record<string, unknown>): boolean => {
  return Object.keys(value).some(
    (k) =>
      k === '$op' ||
      k === '$id' ||
      k === '$thing' ||
      k === '$entity' ||
      k === '$relation' ||
      k === '$tempId' ||
      k === '$filter',
  );
};

/**
 * Check if a node has non-$ fields that are primitive data values (not nested objects/arrays
 * which would be role/link field children).
 */
const hasDataFields = (node: BQLMutation): boolean => {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    // Arrays of objects or objects with $op are role/link field children, not data fields
    if (Array.isArray(value) && value.length > 0 && isObject(value[0])) {
      continue;
    }
    if (isObject(value) && Object.keys(value).some((k) => k.startsWith('$'))) {
      continue;
    }
    return true;
  }
  return false;
};
