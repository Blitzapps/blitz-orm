import { isArray, isObject } from 'radash';
import { deepCurrent, getCurrentSchema, getSymbols } from '../../../../helpers';
import type { BQLMutationBlock, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../../types';
import { doAction } from '../shared/doActions';

export const splitMultipleIds = (node: BQLMutationBlock, field: string, schema: EnrichedBormSchema) => {
	if (doAction('split_ids', node)) {
		//insert here
		const transformedChildren = (isArray(node[field]) ? node[field] : [node[field]]).flatMap(
			(child: EnrichedBQLMutationBlock) => {
				if (isObject(child) && '$id' in child && isArray(child['$id'])) {
					const subNode = child as EnrichedBQLMutationBlock & { $id: string[] };
					/*const childSchema =*/ getCurrentSchema(schema, subNode);
					//console.log('childSchema', childSchema);
					/// Depending on the DB this operation is required or not
					if (!subNode.$bzId) {
						throw new Error('[Internal Error] No bzId found');
					}
					// eslint-disable-next-line no-constant-condition
					if (/*childSchema.dbContext.mutation?.splitArray$Ids*/ true) {
						//console.log('subNode', subNode);
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
		//console.log('transformedChildren', transformedChildren);
		// if we splitted something, then reassign
		if (transformedChildren.length > isArray(node[field]) ? node[field] : [node[field]].length) {
			// eslint-disable-next-line no-param-reassign
			node[field] = transformedChildren;
		}
	}
};
