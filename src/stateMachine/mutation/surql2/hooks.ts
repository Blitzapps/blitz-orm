import type { BormConfig } from '../../../types';
import type { DRAFT_Action, DRAFT_BormTrigger, DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { BQLMutation, BQLMutationOp } from './parse';

/**
 * Apply defaults, hook transforms, and validations in a single top-down pass.
 *
 * For each node:
 *   1. Apply default values (for create nodes)
 *   2. Apply transform hooks (may add new nested children)
 *   3. Infer $thing and $op for any new children added by transforms
 *   4. Recurse into all children (including new ones)
 *   5. Apply validation hooks
 */
export const applyDefaultsAndHooks = (
  input: BQLMutation | BQLMutation[],
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): BQLMutation | BQLMutation[] => {
  if (Array.isArray(input)) {
    for (const node of input) {
      processNode(node, null, schema, config);
    }
    return input;
  }
  processNode(input, null, schema, config);
  return input;
};

const processNode = (
  node: BQLMutation,
  parentNode: BQLMutation | null,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): void => {
  // 1. Apply defaults to this node
  applyDefaultsToNode(node, schema);

  // 2. Apply transform hooks (may add new children)
  applyTransforms(node, parentNode, schema, config);

  // 3. Infer $thing and $op for any new children, then recurse
  recurseIntoChildren(node, schema, config);

  // 4. Apply validations after children are processed
  applyValidations(node, parentNode, schema, config);
};

// --- Defaults ---

const applyDefaultsToNode = (node: BQLMutation, schema: DRAFT_EnrichedBormSchema): void => {
  const thing = node.$thing ? schema[node.$thing] : undefined;

  if (thing && node.$op === 'create') {
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
        node[field.name] = field.default.value;
      } else if (field.default.type === 'fn') {
        node[field.name] = field.default.fn(node);
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
};

// --- Recursion into children ---

const recurseIntoChildren = (node: BQLMutation, schema: DRAFT_EnrichedBormSchema, config: BormConfig): void => {
  const thingSchema = node.$thing ? schema[node.$thing] : undefined;

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }

    // Use schema to skip data fields (only recurse into role/link/ref)
    if (thingSchema) {
      const fieldSchema = thingSchema.fields[key];
      if (fieldSchema && fieldSchema.type !== 'role' && fieldSchema.type !== 'link' && fieldSchema.type !== 'ref') {
        continue;
      }
    }

    const processChild = (item: unknown): void => {
      if (!isObjectValue(item)) {
        return;
      }
      const child = item as BQLMutation;
      inferChildThingAndOp(child, node, key, schema);
      // Only recurse if the child is now a recognized mutation block
      if (child.$thing) {
        processNode(child, node, schema, config);
      }
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

/**
 * Infer $thing and $op for a child block if not already set.
 * This is needed for children added by transform hooks.
 */
const inferChildThingAndOp = (
  child: BQLMutation,
  parent: BQLMutation,
  fieldKey: string,
  schema: DRAFT_EnrichedBormSchema,
): void => {
  if (child.$thing) {
    return;
  }

  const parentSchema = parent.$thing ? schema[parent.$thing] : undefined;
  if (!parentSchema) {
    return;
  }

  const fieldSchema = parentSchema.fields[fieldKey];
  if (!fieldSchema) {
    return;
  }

  let childThing: string | undefined;
  if (fieldSchema.type === 'role') {
    childThing = fieldSchema.opposite.thing;
  } else if (fieldSchema.type === 'link') {
    childThing = fieldSchema.target === 'relation' ? fieldSchema.relation : fieldSchema.opposite.thing;
  }

  if (!childThing) {
    return;
  }

  const childSchema = schema[childThing];
  if (!childSchema) {
    return;
  }

  const objKeys = Object.keys(child).filter((k) => !k.startsWith('$'));
  const looksLikeMutation =
    child.$op !== undefined ||
    child.$id !== undefined ||
    (objKeys.length > 0 && objKeys.some((k) => k in childSchema.fields || k === childSchema.idFields[0]));
  if (!looksLikeMutation) {
    return;
  }

  child.$thing = childThing;
  if (!child.$op) {
    const hasId = child.$id !== undefined;
    const hasNonDollarFields = objKeys.length > 0;
    if (hasId && hasNonDollarFields) {
      child.$op = 'update';
    } else if (hasId) {
      child.$op = 'link';
    } else {
      child.$op = 'create';
    }
  }
};

// --- Hooks ---

const opToTrigger: Record<BQLMutationOp, DRAFT_BormTrigger> = {
  create: 'onCreate',
  update: 'onUpdate',
  delete: 'onDelete',
  link: 'onLink',
  unlink: 'onUnlink',
};

const getTriggeredActions = (node: BQLMutation, schema: DRAFT_EnrichedBormSchema): DRAFT_Action[] => {
  const thing = node.$thing ? schema[node.$thing] : undefined;
  if (!thing?.hooks?.pre) {
    return [];
  }

  const trigger = node.$op ? opToTrigger[node.$op] : undefined;
  if (!trigger) {
    return [];
  }

  const actions: DRAFT_Action[] = [];
  for (const hook of thing.hooks.pre) {
    const shouldApply =
      !hook.triggers || // No triggers = applies to all
      hook.triggers[trigger]?.();
    if (shouldApply) {
      actions.push(...hook.actions);
    }
  }
  return actions;
};

const applyTransforms = (
  node: BQLMutation,
  parentNode: BQLMutation | null,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): void => {
  const actions = getTriggeredActions(node, schema).filter((a) => a.type === 'transform');
  if (actions.length === 0) {
    return;
  }

  const currentNode: Record<string, unknown> = { ...node };
  const context = ((config.mutation as Record<string, unknown> | undefined)?.context as Record<string, unknown>) ?? {};

  for (const action of actions) {
    if (action.type !== 'transform') {
      continue;
    }
    // TODO: Pre-query is not implemented for the SurrealDB mutation adapter.
    // Pass empty object as dbNode until pre-query support is added.
    const newProps = action.fn(currentNode, parentNode ?? {}, context, {});
    if (newProps && Object.keys(newProps).length > 0) {
      Object.assign(currentNode, newProps);
      Object.assign(node, newProps);
    }
  }
};

const applyValidations = (
  node: BQLMutation,
  parentNode: BQLMutation | null,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): void => {
  const actions = getTriggeredActions(node, schema).filter((a) => a.type === 'validate' && a.severity === 'error');
  if (actions.length === 0) {
    return;
  }

  const currentNode: Record<string, unknown> = { ...node };
  const context = ((config.mutation as Record<string, unknown> | undefined)?.context as Record<string, unknown>) ?? {};

  for (const action of actions) {
    if (action.type !== 'validate') {
      continue;
    }
    try {
      // TODO: Pre-query is not implemented for the SurrealDB mutation adapter.
      // Pass empty object as dbNode until pre-query support is added.
      const result = action.fn(currentNode, parentNode ?? {}, context, {});
      if (result === false) {
        throw new Error(`[Validations:thing:${node.$thing}] ${action.message}.`);
      }
      if (result !== true) {
        throw new Error(`[Validations:thing:${node.$thing}] Validation function's output is not a boolean value.`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[Validations:')) {
        throw err;
      }
      // Wrap custom errors from the validate fn
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[Validations:thing:${node.$thing}] ${msg}`);
    }
  }
};

const isObjectValue = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
