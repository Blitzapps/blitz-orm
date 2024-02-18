import { getCurrentSchema, getCurrentFields } from '../../../../helpers';
import type { BQLMutationBlock, EnrichedBormSchema, BormOperation } from '../../../../types';

export const getOp = (
	parentNode: BQLMutationBlock,
	node: BQLMutationBlock,
	schema: EnrichedBormSchema,
): BormOperation => {
	if (node.$op) {
		//validations
		return node.$op as BormOperation;
	} else {
		const nodeSchema = getCurrentSchema(schema, node);
		const { usedFields } = getCurrentFields(nodeSchema, node);

		if (node.$id || node.$filter) {
			if (usedFields.length > 0) {
				if (parentNode.$op === 'create') {
					return 'create';
				} else {
					return 'update';
				}
			} else {
				return 'link';
			}
		} else {
			return 'create';
		}
	}
};
