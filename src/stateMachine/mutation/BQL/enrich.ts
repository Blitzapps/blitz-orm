/* eslint-disable no-param-reassign */
import { current, isDraft, produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';
import { doAction } from './utils';
import { getCurrentFields, getCurrentSchema, getFieldSchema } from '../../../helpers';
import { ParentFieldSchema } from '../../../types/symbols';
import type { BQLMutationBlock, BormOperation, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

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
	node[field] = 'TEST';
};

const stringToObjects = () => {};

const get$Op = (parentNode: BQLMutationBlock, node: BQLMutationBlock, schema: EnrichedBormSchema): BormOperation => {
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

export const enrichBQLMutation = async (
	blocks: BQLMutationBlock | BQLMutationBlock[] | EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
): Promise<EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]> => {
	console.log('Before enrich', JSON.stringify(blocks, null, 2));

	const rootBlock = { $root: blocks };
	const result = produce(rootBlock, (draft) =>
		traverse(draft, ({ value, parent, key }: TraversalCallbackContext) => {
			if (!parent) {
				return;
			}
			if (isObject(value)) {
				if (!('$thing' in value || '$entity' in value || '$relation' in value)) {
					if (key === '$root') {
						throw new Error('Root things must specify $entity or $relation');
					} else {
						throw new Error(
							`[Internal] This object has not been initiated with a $thing: ${JSON.stringify(isDraft(value) ? current(value) : value)}`,
						);
					}
				}

				const node = value as BQLMutationBlock;

				const withMetadata = {
					...(node.$thing ? {} : { $thing: node.$entity || node.$relation }),
					...(node.$thingType ? {} : { $thingType: node.$entity ? 'entity' : 'relation' }),
					...(node.$op ? {} : { $op: get$Op({} as BQLMutationBlock, node, schema) }),
					...(node.$bzId ? {} : { $bzId: node.$tempId ? node.$tempId : `R_${uuidv4()}` }),
				};
				//@ts-expect-error - TODO
				parent[key] = { ...withMetadata, ...node };
				//@ts-expect-error - TODO
				delete parent[key].$entity;
				//@ts-expect-error - TODO
				delete parent[key].$relation;

				Object.keys(node).forEach((field) => {
					///1. Clean step
					cleanStep(node, field);

					if (field.startsWith('$')) {
						return;
					}

					const fieldSchema = getFieldSchema(schema, node, field);
					if (!fieldSchema) {
						throw new Error(`[Internal] Field ${field} not found in schema`);
					}

					///2.DATAFIELD STEP
					if ('contentType' in fieldSchema) {
						return dataFieldStep(node, field);
					}

					///3.NESTED OBJECTS: RoleFields and linkFields
					const isArrayField = isArray(node[field]);
					const childrenArray = isArrayField ? node[field] : [node[field]];
					///3.1$thing => linkField or roleField
					if (field === '$root' || ['linkField', 'roleField'].includes(fieldSchema.fieldType)) {
						/// 3.1.1 replaces
						if (childrenArray.every((child: unknown) => typeof child === 'string')) {
							stringToObjects();
							if (childrenArray.some((child: unknown) => !isObject(child))) {
								throw new Error('[Internal] At least one child is not an object');
							}
						}
						/// 3.1.2 children mutation
						childrenArray.forEach((subNode: EnrichedBQLMutationBlock) => {
							///symbols
							subNode[ParentFieldSchema] = fieldSchema;

							/*//#region $root
							if (field === '$root') {
								console.log('HEHE', isDraft(subNode) ? current(subNode) : subNode);
								const withMetadata = {
									...(subNode.$thing ? {} : { $thing: subNode.$entity || subNode.$relation }),
									...(subNode.$thingType ? {} : { $thingType: subNode.$entity ? 'entity' : 'relation' }),
									...(subNode.$op ? {} : { $op: get$Op(node, subNode, schema) }),
								};
								if (isArrayField) {
									node[field][i] = { ...withMetadata, ...subNode };
								} else {
									node[field] = { ...withMetadata, ...subNode };
								}
							}
							//#endregion $root*/

							//#region nested nodes
							const getOppositePlayers = () => {
								if (fieldSchema.fieldType === 'linkField') {
									return fieldSchema.oppositeLinkFieldsPlayedBy;
								} else if (fieldSchema.fieldType === 'roleField') {
									return fieldSchema.playedBy;
								} else {
									throw new Error(`[Internal] Field ${field} is not a linkField or roleField`);
								}
							};
							const oppositePlayers = getOppositePlayers();

							if (oppositePlayers?.length != 1) {
								throw new Error(`[Internal-future] Field ${field} should have a single player`);
							} else {
								const [player] = oppositePlayers;
								subNode.$thing = player.thing;
								subNode.$thingType = player.thingType;
								subNode.$op = get$Op(node, subNode, schema);
								subNode.$bzId = subNode.$bzId ? subNode.$bzId : subNode.$tempId ? subNode.$tempId : `N_${uuidv4()}`;
							}
							//#endregion nested nodes
						});
					}
				});
			}
		}),
	);
	if (isArray(result.$root)) {
		console.log('After enrich', result.$root);
		console.log('After enrich', JSON.stringify(result.$root, null, 2));
		return result.$root as EnrichedBQLMutationBlock[];
	} else {
		console.log('After enrich', result.$root);
		console.log('After enrich', JSON.stringify(result.$root, null, 2));
		return result.$root as EnrichedBQLMutationBlock;
	}
};
