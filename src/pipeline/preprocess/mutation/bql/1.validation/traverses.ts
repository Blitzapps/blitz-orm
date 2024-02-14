import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { BQLMutationBlock } from '../../../../../types';
import { sanitizeTempId } from './utils';

export const validateBQLMutation = (
	blocks: BQLMutationBlock | BQLMutationBlock[],
	//schema: EnrichedBormSchema,
): BQLMutationBlock | BQLMutationBlock[] => {
	return produce(blocks, (draft) =>
		traverse(draft, ({ value: val, key }: TraversalCallbackContext) => {
			if (key === '$tempId') {
				sanitizeTempId(val);
			}
			if (isObject(val)) {
				// @ts-expect-error - TODO description
				if (val.$arrayOp) {
					throw new Error('Array op not supported yet');
				}
			}
		}),
	);
};
