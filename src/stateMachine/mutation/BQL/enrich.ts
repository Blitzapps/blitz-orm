/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';
import type { BQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { doAction } from './utils';
import { getFieldSchema } from '../../../helpers';

const metadataStep = (node: BQLMutationBlock, field: string) => {
	if (field === '$id') {
		//
	}
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
	if (field === '$entity' || field === '$relation') {
		Reflect.set(node, '$thing', node[field]);
		Reflect.set(node, '$thingType', field.slice(1) as 'entity' | 'relation');
		Reflect.deleteProperty(node, field);
	}
};

const dataFieldStep = (node: BQLMutationBlock, field: string) => {
	node[field] = 'TEST';
};

const stringToObjects = () => {};

export const enrichBQLMutation = (blocks: BQLMutationBlock | BQLMutationBlock[], schema: EnrichedBormSchema) => {
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
						throw new Error('[Internal] This object has not been initiated with a $thing');
					}
				}
				if (!('$thing' in value)) {
					//@ts-expect-error - TODO
					parent[key].$thing = value.$entity || value.$relation;
					//@ts-expect-error - TODO
					parent[key].$thingType = value.$entity ? 'entity' : 'relation';
					//@ts-expect-error - TODO
					delete parent[key].$entity;
					//@ts-expect-error - TODO
					delete parent[key].$relation;
				}
				const node = value as BQLMutationBlock;

				Object.keys(node).forEach((field) => {
					///1.METADATA STEP
					if (field.startsWith('$')) {
						return metadataStep(node, field);
					}
					const currentFieldSchema = getFieldSchema(schema, node, field);
					if (!currentFieldSchema) {
						throw new Error(`[Internal] Field ${field} not found in schema`);
					}

					///2.DATAFIELD STEP
					if ('contentType' in currentFieldSchema) {
						return dataFieldStep(node, field);
					}

					///3.NESTED OBJECTS
					const isArrayField = isArray(node[field]);
					const childrenArray = isArrayField ? node[field] : [node[field]];
					///3.1$thing => linkfield or roleField
					if (field === '$root' || ['linkField', 'roleField'].includes(currentFieldSchema.fieldType)) {
						/// 3.1.1 replaces
						if (childrenArray.every((child: unknown) => typeof child === 'string')) {
							stringToObjects();
							if (childrenArray.some((child: unknown) => !isObject(child))) {
								throw new Error('[Internal] At least one child is not an object');
							}
						}
						// 3.1.2 enriches
						childrenArray.forEach((subNode: Record<string, any>, i: number) => {
							//Root
							if (field === '$root') {
								if (!subNode.$thing) {
									if (isArrayField) {
										//@ts-expect-error - TODO
										node[field][i] = { $thing: subNode.$entity || subNode.$relation, ...value[field][i] };
									} else {
										//@ts-expect-error - TODO
										node[field] = { $thing: subNode.$entity || subNode.$relation, ...value[field] };
									}
								}
								if (!subNode.$thingType) {
									//@ts-expect-error - TODO
									node[field] = { $thingType: subNode.$entity ? 'entity' : 'relation', ...value[field] };
								}
							}
							//Linkfield
							if ('oppositeLinkFieldsPlayedBy' in currentFieldSchema) {
								if (currentFieldSchema.oppositeLinkFieldsPlayedBy.length != 1) {
									throw new Error(`[Internal-future] Field ${field} should have a single player`);
								} else {
									const [player] = currentFieldSchema.oppositeLinkFieldsPlayedBy;
									subNode.$thing = player.thing;
									subNode.$thingType = player.thingType;
								}
							}
						});
					}
				});
			}
		}),
	);
	return result.$root;
};
