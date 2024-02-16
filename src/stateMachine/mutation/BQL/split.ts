import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject, isArray } from 'radash';
import type { BQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { doAction } from './utils';

export const splitIdsBQLMutation = (blocks: BQLMutationBlock | BQLMutationBlock[], schema: EnrichedBormSchema) => {
	const rootBlock = { $root: { $subRoot: blocks } };
	const result = produce(rootBlock, (draft) =>
		traverse(draft, ({ value: val, parent, key }: TraversalCallbackContext) => {
			if (!parent) {
				return;
			}
			if (isObject(val) && doAction('split_ids', val)) {
				const transformedEntries = Object.entries(val).map(([field, value]) => {
					// Handle arrays of objects or single objects.
					const childrenArray = isArray(value) ? value : [value];

					// Transform children if necessary.
					const transformedChildren = childrenArray.flatMap((child) => {
						if (isObject(child) && '$id' in child && isArray(child['$id'])) {
							//const childSchema = getCurrentSchema(schema, subNode);
							//console.log('childSchema', childSchema);
							/// Depending on the DB this operation is required or not
							// eslint-disable-next-line no-constant-condition
							if (/*childSchema.dbContext.mutation?.splitArray$Ids*/ true) {
								return child.$id.map(($id: string) => ({ ...child, $id: $id }));
							}
						}
						return child;
					});

					// Return the new key-value pair.
					return [field, transformedChildren];
				});

				// Convert the transformed entries back into an object and assign it to the parent.
				//@ts-expect-error - TODO
				parent[key] = Object.fromEntries(transformedEntries);
			}
		}),
	);
	return result.$root.$subRoot;
};
