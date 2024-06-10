import { getCurrentSchema, getCurrentFields } from '../../../../helpers';
import type { BQLMutationBlock, EnrichedBormSchema, BormOperation } from '../../../../types';
import { validateOp } from './validateOp';

export const getOp = (
	parentNode: BQLMutationBlock,
	node: BQLMutationBlock,
	schema: EnrichedBormSchema,
): BormOperation => {
	const nodeSchema = getCurrentSchema(schema, node);
	const { usedFields } = getCurrentFields(nodeSchema, node);

	if (node.$op) {
		validateOp(parentNode, node, schema);
		return node.$op as BormOperation;
	} else {
		if (node.$id || node.$filter) {
			if (usedFields.length > 0) {
				validateOp(parentNode, { ...node, $op: 'update' }, schema);
				return 'update';
			} else {
				validateOp(parentNode, { ...node, $op: 'link' }, schema);
				return 'link';
			}
		} else if (node.$tempId) {
			if (usedFields.length > 0) {
				validateOp(parentNode, { ...node, $op: 'create' }, schema);
				return 'create'; //only difference is $id + stuff means update, while $tempids are usually for creation and recovering it later from the res
			} else {
				validateOp(parentNode, { ...node, $op: 'create' }, schema);
				return 'link';
			}
		} else {
			validateOp(parentNode, { ...node, $op: 'create' }, schema);
			return 'create';
		}
	}
};
