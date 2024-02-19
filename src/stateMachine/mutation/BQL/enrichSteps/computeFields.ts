/* eslint-disable no-param-reassign */
import { isArray, listify } from 'radash';
import type {
	BQLMutationBlock,
	EnrichedBormSchema,
	EnrichedBQLMutationBlock,
	EnrichedDataField,
} from '../../../../types';
import { getCurrentFields, getCurrentSchema, oFind } from '../../../../helpers';
import { computeField } from '../../../../engine/compute';

export const computeFields = (node: BQLMutationBlock, field: string, schema: EnrichedBormSchema) => {
	const currentNode = node[field] as EnrichedBQLMutationBlock;
	(isArray(currentNode) ? currentNode : [currentNode]).forEach((subNode: EnrichedBQLMutationBlock) => {
		const currentSchema = getCurrentSchema(schema, subNode);
		const { unidentifiedFields } = getCurrentFields(currentSchema, subNode);
		const { computedFields, virtualFields } = currentSchema;

		//@ts-expect-error - TODO
		const filledFields = listify(subNode, (attKey, v) => (v !== undefined ? attKey : undefined)) as string[];
		/// if at least one of the filled fields is virtual, then throw error
		const virtualFilledFields = filledFields.filter((x) => virtualFields?.includes(x));
		if (virtualFilledFields.length > 0) {
			throw new Error(`Virtual fields can't be sent to DB: "${virtualFilledFields.join(',')}"`);
		}
		const missingComputedFields = computedFields.filter((x) => !filledFields.includes(x));

		// fill computed values
		missingComputedFields.forEach((fieldPath) => {
			console.log('fieldPath', fieldPath);

			const currentFieldDef = currentSchema.dataFields?.find((x) => x.path === fieldPath);
			const currentLinkDef = currentSchema.linkFields?.find((x) => x.path === fieldPath);
			// todo: multiple playedBy
			const currentLinkedDef = currentLinkDef?.oppositeLinkFieldsPlayedBy[0];

			const currentRoleDef =
				'roles' in currentSchema ? oFind(currentSchema.roles, (k, _v) => k === fieldPath) : undefined;
			const currentDef = currentFieldDef || currentLinkedDef || currentRoleDef;
			if (!currentDef) {
				throw new Error(`no field Def for ${fieldPath}`);
			}

			// We generate the other default fields if they are not defined. We ignore the id field which was created before for $id
			if (subNode.$op === 'create' && !subNode[fieldPath]) {
				const defaultValue = computeField({
					currentThing: subNode,
					fieldSchema: currentDef as EnrichedDataField, //id is always a datafield.
					mandatoryDependencies: true, //can't send to db without every dependency being there
				});

				subNode[fieldPath] = defaultValue;
			}
		});

		if (unidentifiedFields.length > 0) {
			throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(subNode)}`);
		}
	});
};
