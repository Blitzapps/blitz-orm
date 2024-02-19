/* eslint-disable no-param-reassign */
import { current, isDraft, produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';
import { doAction } from './utils';
import { getFieldSchema } from '../../../helpers';
import type { BQLMutationBlock, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { v4 as uuidv4 } from 'uuid';
import { replaceToObj } from './enrichSteps/replaces';
import { setRootMeta } from './enrichSteps/rootMeta';
import { splitMultipleIds } from './enrichSteps/splitIds';
import { enrichChildren } from './enrichSteps/enrichChildren';
import { computeFields } from './enrichSteps/computeFields';

const getParentBzId = (node: BQLMutationBlock) => {
	if ('$root' in node) {
		return `R_${uuidv4()}`;
	} else {
		if (node.$tempId) {
			return node.$tempId;
		} else if (node.$bzId) {
			return node.$bzId;
		} else {
			throw new Error(`[Internal] No bzId found in ${JSON.stringify(isDraft(node) ? current(node) : node)}`);
		}
	}
};

const cleanStep = (node: BQLMutationBlock, field: string) => {
	if (node[field] === undefined) {
		delete node[field];
	}

	if (field === '$tempId') {
		if (doAction('set_tempId', node)) {
			Reflect.set(node, '$tempId', 'transfomed hehe');
		} else {
			throw new Error('[Internal] TempId already modified');
		}
	}
};

const dataFieldStep = (node: BQLMutationBlock, field: string) => {
	console.log(`${field}:node[field]`);
};

export const enrichBQLMutation = async (
	blocks: BQLMutationBlock | BQLMutationBlock[] | EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
): Promise<EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]> => {
	console.log('Before enrich', JSON.stringify(blocks, null, 2));

	const rootBlock = { $rootWrap: { $root: blocks } };
	const result = produce(rootBlock, (draft) =>
		traverse(draft, ({ value, parent, key }: TraversalCallbackContext) => {
			if (!parent || !key) {
				return;
			}
			if (isObject(value)) {
				if ('$root' in value) {
					// This is hte $root object, we will split the real root if needed in this iteration
				} else if (!('$thing' in value || '$entity' in value || '$relation' in value)) {
					if (key === '$root') {
						throw new Error('Root things must specify $entity or $relation');
					} else {
						throw new Error(
							`[Internal] This object has not been initiated with a $thing: ${JSON.stringify(isDraft(value) ? current(value) : value)}`,
						);
					}
				}

				const node = value as BQLMutationBlock;

				const parentBzId = getParentBzId(node);

				Object.keys(node).forEach((field) => {
					///1. Clean step
					cleanStep(node, field);

					if (field !== '$root' && field.startsWith('$')) {
						return;
					}

					const fieldSchema =
						field !== '$root' ? getFieldSchema(schema, node, field) : ({ fieldType: 'rootField' } as any);
					if (!fieldSchema) {
						throw new Error(`[Internal] Field ${field} not found in schema`);
					}

					///2.DATAFIELD STEP
					if ('contentType' in fieldSchema) {
						return dataFieldStep(node, field);
					}

					///3.NESTED OBJECTS: RoleFields and linkFields

					// 3.1 splitIds

					///3.2$thing => linkField or roleField
					if (['rootField', 'linkField', 'roleField'].includes(fieldSchema.fieldType)) {
						///In the next steps we have (isArray(node[field]) ? node[field] : [node[field]]) multiple times, because it might mutate, can't replace by a var

						/// 3.2.1 replaces
						replaceToObj(node, field);
						console.log('After replace', JSON.stringify(isDraft(node) ? current(node) : node, null, 2));

						//3.2.2 root $thing
						if (fieldSchema.fieldType === 'rootField') {
							setRootMeta(node, parentBzId, schema);
							console.log('After rootMeta', JSON.stringify(isDraft(node) ? current(node) : node, null, 2));
						}

						//3.2.3 splitIds()
						splitMultipleIds(node, field, schema);
						console.log('After splitIds', JSON.stringify(isDraft(node) ? current(node) : node, null, 2));

						/// 3.2.4 children enrichment
						//redefining childrenArray as it might have changed
						if (['linkField', 'roleField'].includes(fieldSchema.fieldType)) {
							enrichChildren(node, field, fieldSchema, parentBzId, schema);
						}

						/// 3.2.5 Field computes
						console.log('toBeComputed', node, field);
						if (['rootField', 'linkField', 'roleField'].includes(fieldSchema.fieldType)) {
							console.log('toBeComputed', node, field);
							computeFields(node, field, schema);
						}

						console.log(
							'After children mutation & validations',
							JSON.stringify(isDraft(node) ? current(node) : node, null, 2),
						);
						// 3.2.6
						/*//#region validations
						const subNodeSchema = getCurrentSchema(schema, subNode);
						const { unidentifiedFields } = getCurrentFields(subNodeSchema, subNode);
						if (unidentifiedFields.length > 0) {
							throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
						}
						//#endregion validations */
					}
				});
			}
		}),
	);
	console.log('After enrich', result.$rootWrap.$root);
	console.log('After enrich', JSON.stringify(result.$rootWrap.$root, null, 2));

	traverse(result, ({ value }: TraversalCallbackContext) => {
		if (isObject(value)) {
			console.log('WHAAAAT', value);
		}
	});

	if (isArray(result.$rootWrap.$root)) {
		return result.$rootWrap.$root as EnrichedBQLMutationBlock[];
	} else {
		return result.$rootWrap.$root as EnrichedBQLMutationBlock;
	}
};
