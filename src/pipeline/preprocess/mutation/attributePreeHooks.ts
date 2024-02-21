import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject, listify } from 'radash';

import type { EnrichedDataField, FilledBQLMutationBlock } from '../../../types';
import type { TypeDbResponse } from '../../pipeline'
import type { PipelineOperation } from '../../../types';
import { computeField } from '../../../engine/compute';
import { getCurrentSchema, getCurrentFields, oFind } from '../../../helpers';

export const attributePreHooks: PipelineOperation<TypeDbResponse> = async (req) => {
	const { filledBqlRequest, schema } = req;

	if (!filledBqlRequest) {
		throw new Error('Filled BQL request is missing');
	}

	const defaultAttributes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val }: TraversalCallbackContext) => {
				if (isObject(val)) {
					const value = val as FilledBQLMutationBlock;

					const currentSchema = getCurrentSchema(schema, value);
					// todo:
					const { unidentifiedFields } = getCurrentFields(currentSchema, value);
					const { idFields, computedFields, virtualFields } = currentSchema;

					//todo composite ids fields
					if (!idFields) {
						throw new Error('No idFields found');
					}
					const [idField] = idFields;

					const filledFields = listify(value, (attKey, v) => (v !== undefined ? attKey : undefined)) as string[];
					/// if at least one of the filled fields is virtual, then throw error
					const virtualFilledFields = filledFields.filter((x) => virtualFields?.includes(x));
					if (virtualFilledFields.length > 0) {
						throw new Error(`Virtual fields can't be sent to DB: "${virtualFilledFields.join(',')}"`);
					}
					const missingComputedFields = computedFields.filter((x) => !filledFields.includes(x));

					// fill computed values
					missingComputedFields.forEach((fieldPath) => {
						// console.log('fieldPath', fieldPath);

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
						if (fieldPath !== idField && value.$op === 'create' && !value[fieldPath]) {
							const defaultValue = computeField({
								currentThing: value,
								fieldSchema: currentDef as EnrichedDataField, //id is always a datafield.
								mandatoryDependencies: true, //can't send to db without every dependency being there
							});

							value[fieldPath] = defaultValue; // we already checked that this value has not been defined
						}
					});

					if (unidentifiedFields.length > 0) {
						throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
					}
				}
			}),
		);
	};

	const withDefaultAttrubutes = defaultAttributes(filledBqlRequest);

	const transformAttributes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val }: TraversalCallbackContext) => {
				if (isObject(val)) {
					// eslint-disable-next-line no-param-reassign
				}
			}),
		);
	};

	const withTransformedAttributes = transformAttributes(withDefaultAttrubutes);

	if (Array.isArray(withTransformedAttributes)) {
		req.filledBqlRequest = withTransformedAttributes as FilledBQLMutationBlock[];
	} else {
		// eslint-disable-next-line no-param-reassign
		req.filledBqlRequest = withTransformedAttributes as FilledBQLMutationBlock;
	}
};
