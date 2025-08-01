import { isArray, isObject } from 'radash';
import { deepCurrent, getCurrentSchema, getSymbols } from '../../../../helpers';
import type { BQLMutationBlock, EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../../../types';
import { doAction } from '../shared/doActions';

export const splitMultipleIds = (node: BQLMutationBlock, field: string, schema: EnrichedBormSchema) => {
  if (doAction('split_ids', node)) {
    //insert here
    const transformedChildren = (isArray(node[field]) ? node[field] : [node[field]]).flatMap(
      (child: EnrichedBQLMutationBlock) => {
        if (isObject(child) && '$id' in child && isArray(child.$id)) {
          const subNode = child as EnrichedBQLMutationBlock & { $id: string[] };
          /*const childSchema =*/ getCurrentSchema(schema, subNode);
          /// Depending on the DB this operation is required or not
          if (!subNode.$bzId) {
            throw new Error('[Internal Error] No bzId found');
          }
          // biome-ignore lint/correctness/noConstantCondition: <Todo>
          if (/*childSchema.dbContext.mutation?.splitArray$Ids*/ true) {
            return subNode.$id.map(($id: string, i: number) => ({
              ...deepCurrent(subNode), //structured clone generates a weird bug with traverse, so not using it
              $id: $id,
              $bzId: `${subNode.$bzId}_${i}`,
              ...getSymbols(subNode),
            }));
          }
        }
        return child;
      },
    );
    // if we splitted something, then reassign
    if (transformedChildren.length > 0 && isArray(node[field]) ? node[field] : [node[field]].length) {
      // eslint-disable-next-line no-param-reassign
      node[field] = transformedChildren;
    }
  }
};
