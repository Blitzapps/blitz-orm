/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import type { EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { isObject } from 'radash';
import { getFieldSchema } from '../../../helpers';
import { addIntermediaryRelations } from './enrichSteps/addIntermediaryRelations';

export const addIntermediaryRelationsBQLMutation = (
	blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
) => {
	const result = produce(blocks, (draft) =>
		traverse(draft, ({ value }: TraversalCallbackContext) => {
			if (isObject(value)) {
				const node = value as EnrichedBQLMutationBlock;

				Object.keys(node).forEach((field) => {
					if (!field || field.startsWith('$')) {
						return;
					}
					const fieldSchema = getFieldSchema(schema, node, field);
					if (!fieldSchema) {
						throw new Error(`[Internal] Field ${field} not found in schema`);
					}

					if (fieldSchema.fieldType === 'linkField' && fieldSchema.target === 'role') {
						addIntermediaryRelations(node, field, fieldSchema);
						return delete node[field]; //we return because we dont need to keep doing things in node[field]
					}
				});
			}
		}),
	);
	return result;
};
