import { getCurrentSchema, getCurrentFields } from '../../../../helpers';
import type { BQLMutationBlock, EnrichedBormSchema, BormOperation } from '../../../../types';
import { isArray } from 'radash';

export const validateOp = (parentNode: BQLMutationBlock, node: BQLMutationBlock, schema: EnrichedBormSchema) => {
	if (node.$op) {
		// $op validations /// Order: most specific to least specific
		if (node.$op === 'create' && node.$id) {
			throw new Error("[Wrong format] Can't write to computed field $id. Try writing to the id field directly.");
		}
		if (['unlink', 'delete', 'update'].includes(node.$op) && parentNode.$op === 'create') {
			throw new Error(`[Wrong format] Cannot ${node.$op} under a create`);
		}

		const nodeSchema = getCurrentSchema(schema, node);
		const { usedDataFields } = getCurrentFields(nodeSchema, node);

		if (node.$op === 'delete' && usedDataFields.length > 0) {
			//linkFields can be updated, for instance nested deletions
			throw new Error('[Wrong format] Cannot update on deletion');
		}
		if (['unlink', 'link'].includes(node.$op) && usedDataFields.length > 0) {
			//linkFields can be updated, for instance nested unlinks
			throw new Error("[Unsupported] Can't update fields on Link / Unlink");
		}
		return node.$op as BormOperation;
	}
};

export const validateChildren = (parentNode: BQLMutationBlock, node: BQLMutationBlock, schema: EnrichedBormSchema) => {
	const subNodes = isArray(node) ? node : [node];
	subNodes.forEach((subNode) => {
		validateOp(parentNode, subNode, schema);
	});
};
