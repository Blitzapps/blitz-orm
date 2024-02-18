/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject, isArray } from 'radash';
import type { EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { doAction } from './utils';
import { getCurrentSchema } from '../../../helpers';

export const splitIdsBQLMutation = async (
	blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
) => {
	console.log('splitIdsBQLMutation', blocks);
	const rootBlock = { $root: { $subRoot: blocks } };
	const result = produce(rootBlock, (draft) =>
		traverse(draft, ({ value: val, parent, key }: TraversalCallbackContext) => {
			if (!parent) {
				return;
			}
			if (isObject(val) && '$thing' in val && doAction('split_ids', val)) {
				const node = val as EnrichedBQLMutationBlock;
				const transformedEntries = Object.entries(node).map(([field, value]) => {
					// Handle arrays of objects or single objects.
					const isArrayChildren = isArray(value);
					const childrenArray = isArray(value) ? value : [value];

					// Transform children if necessary.
					const transformedChildren = childrenArray.flatMap((child) => {
						if (isObject(child) && '$id' in child && isArray(child['$id'])) {
							const subNode = child as EnrichedBQLMutationBlock & { $id: string[] };
							/*const childSchema =*/ getCurrentSchema(schema, subNode);
							//console.log('childSchema', childSchema);
							/// Depending on the DB this operation is required or not
							// eslint-disable-next-line no-constant-condition
							if (/*childSchema.dbContext.mutation?.splitArray$Ids*/ true) {
								return subNode.$id.map(($id: string, i: number) => ({
									...subNode,
									$id: $id,
									$bzId: `${subNode.$bzId}_${i}`,
								}));
							}
						}
						return child;
					});

					// Return the new key-value pair.
					return [field, isArrayChildren ? transformedChildren : transformedChildren[0]];
				});

				//@ts-expect-error - TODO
				parent[key] = Object.fromEntries(transformedEntries);
			}
		}),
	);
	console.log('after split', result.$root.$subRoot);
	console.log('After split', JSON.stringify(result.$root.$subRoot, null, 2));
	return result.$root.$subRoot;
};
