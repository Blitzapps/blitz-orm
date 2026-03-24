import type { BormConfig } from '../../../types';
import type { DRAFT_Action, DRAFT_BormTrigger, DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { BQLMutation, BQLMutationOp } from './parse';

/**
 * Apply hook transforms and validations to the mutation tree.
 * No pre-query is performed — transforms receive the parsed mutation fields including defaults.
 */
export const applyHooks = (
  input: BQLMutation | BQLMutation[],
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): BQLMutation | BQLMutation[] => {
  if (Array.isArray(input)) {
    for (const node of input) {
      applyHooksToNode(node, null, schema, config);
    }
    return input;
  }
  applyHooksToNode(input, null, schema, config);
  return input;
};

const applyHooksToNode = (
  node: BQLMutation,
  parentNode: BQLMutation | null,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): void => {
  // Recurse into nested children first (depth-first)
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
          applyHooksToNode(item as BQLMutation, node, schema, config);
        }
      }
    } else if (isNestedBlock(value)) {
      applyHooksToNode(value as BQLMutation, node, schema, config);
    }
  }

  // Apply transforms, then validations to this node
  applyTransforms(node, parentNode, schema, config);
  applyValidations(node, parentNode, schema, config);
};

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
    // No hooks for this thing
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

const isNestedBlock = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  Object.keys(value as object).some((k) => k.startsWith('$'));
