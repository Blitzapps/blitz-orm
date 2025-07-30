/* eslint-disable no-param-reassign */
import { clone, isArray } from 'radash';
import { deepCurrent, getSymbols, isBQLBlock } from '../../../../helpers';
import type { BormConfig, EnrichedBormSchema, EnrichedBQLMutationBlock, TransFormAction } from '../../../../types';
import { DBNode, IsTransformed } from '../../../../types/symbols';
import { getTriggeredActions } from '../shared/getTriggeredActions';

export const preHookTransformations = (
  node: EnrichedBQLMutationBlock,
  field: string,
  schema: EnrichedBormSchema,
  config: BormConfig,
) => {
  const nodes = isArray(node[field]) ? node[field] : [node[field]];

  nodes.forEach((subNode: EnrichedBQLMutationBlock) => {
    if (!isBQLBlock(subNode)) {
      return;
    }

    // @ts-expect-error todo
    if (subNode.$fields || subNode[IsTransformed]) {
      ///todo: change machine context so we are sure we run preQueryDeps before coming back to here
      return;
    }

    const triggeredActions = getTriggeredActions(subNode, schema).filter(
      (action) => action.type === 'transform',
    ) as TransFormAction[];

    const parentNode = clone(deepCurrent(node)) as EnrichedBQLMutationBlock;
    let workingNode = clone(deepCurrent(subNode)) as EnrichedBQLMutationBlock;
    const userContext = (config.mutation?.context || {}) as Record<string, any>;
    const dbNode = clone(
      deepCurrent<EnrichedBQLMutationBlock | Record<string, never>>(subNode[DBNode] || subNode.$dbNode),
    ) as EnrichedBQLMutationBlock | Record<string, never>;

    triggeredActions.forEach((action) => {
      const newProps = action.fn(workingNode, parentNode, userContext, dbNode || {});
      if (Object.keys(newProps).length === 0) {
        return;
      }

      // Update working node to be used by next action
      workingNode = { ...workingNode, ...newProps, ...getSymbols(subNode), [IsTransformed]: true };

      // Update the draft state in Immer
      Object.assign(subNode, workingNode);
    });
  });
};
