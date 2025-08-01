/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import type { EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../../types';

export const addIntermediaryRelationsBQLMutation = (
  blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
  schema: EnrichedBormSchema,
) => {
  const rootBlock = { $root: { $subRoot: blocks } };
  const result = produce(rootBlock, (draft) =>
    traverse(draft, ({ value: val, parent, key }: TraversalCallbackContext) => {
      if (parent || val || key || schema) {
        return;
      }
    }),
  );

  return result.$root.$subRoot;
};
