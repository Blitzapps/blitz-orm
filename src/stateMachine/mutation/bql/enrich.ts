/* eslint-disable no-param-reassign */
import { current, isDraft, produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';
import { getCurrentFields, getCurrentSchema, getFieldSchema } from '../../../helpers';
import type { BQLMutationBlock, BormConfig, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { replaceToObj } from './enrichSteps/replaces';
import { setRootMeta } from './enrichSteps/rootMeta';
import { splitMultipleIds } from './enrichSteps/splitIds';
import { enrichChildren } from './enrichSteps/enrichChildren';
import { computeFields } from './enrichSteps/computeFields';
import { preHookValidations } from './enrichSteps/preHookValidations';
import { preHookTransformations } from './enrichSteps/preHookTransformations';
import { doAction } from './shared/doActions';
import { unlinkAll } from './enrichSteps/unlinkAll';
import { dependenciesGuard } from './guards/dependenciesGuard';
import { enrichFilter } from '../../query/bql/enrich';

const cleanStep = (node: BQLMutationBlock, field: string) => {
	if (node[field] === undefined) {
		delete node[field];
	}

	if (field === '$tempId') {
		if (doAction('set_tempId', node)) {
			if (node.$tempId?.startsWith('_:')) {
				const tempId = node.$tempId.substring(2);
				node.$tempId = tempId;
				node.$bzId = tempId;
			} else {
				throw new Error('[Wrong format] TempIds must start with "_:"');
			}
		} else {
			throw new Error('[Internal] TempId already modified');
		}
	}

	if (field === '$filter') {
		if (node.$filter && Object.keys(node.$filter).length === 0) {
			node.$filter = undefined;
		}
	}
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dataFieldStep = (node: BQLMutationBlock, field: string) => {};

export const enrichBQLMutation = (
	blocks: BQLMutationBlock | BQLMutationBlock[] | EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
	config: BormConfig,
): EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[] => {
	const rootBlock = { $rootWrap: { $root: blocks } };
	// @ts-expect-error todo
	const has$Fields = dependenciesGuard(Array.isArray(blocks) ? blocks : [blocks]);

	const result = produce(rootBlock, (draft) =>
		traverse(draft, ({ value, parent, key, meta }: TraversalCallbackContext) => {
			if (!parent || !key) {
				return;
			}

			if (isObject(value)) {
				const paths = meta.nodePath?.split('.') || [];
				if (paths.some((p) => p.startsWith('%'))) {
					//we don't go inside %vars even if they are objects
					return;
				}

				if ('$root' in value) {
					// This is hte $root object, we will split the real root if needed in this iteration
				} else if (!('$thing' in value || '$entity' in value || '$relation' in value)) {
					const toIgnore = ['$fields', '$dbNode', '$filter'];
					const lastPath = paths[paths.length - 1];
					const secondToLastPath = paths[paths.length - 2];
					if (key === '$root') {
						throw new Error('Root things must specify $entity or $relation');
					} else if (
						!toIgnore.includes(lastPath) &&
						!toIgnore.includes(secondToLastPath) &&
						!lastPath.startsWith('%') &&
						!secondToLastPath.startsWith('%')
					) {
						throw new Error(
							`[Internal] This object has not been initiated with a $thing: ${JSON.stringify(isDraft(value) ? current(value) : value)}`,
						);
					}
				}

				const node = value as EnrichedBQLMutationBlock;
				const isFilter = paths.includes('$filter');

				if ('$filter' in node && node.$filter) {
					node.$filter = enrichFilter(node.$filter, node.$thing, schema);
				}

				Object.keys(node).forEach((field) => {
					///1. Clean step
					cleanStep(node, field);
					if (field !== '$root' && isFilter) {
						return;
					}

					if (field !== '$root' && (field.startsWith('$') || field.startsWith('%'))) {
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
						if (['linkField', 'roleField'].includes(fieldSchema.fieldType)) {
							if (node[field] === null) {
								unlinkAll(node, field, fieldSchema);
							} else {
								replaceToObj(node, field, fieldSchema);
							}
						}

						//3.2.2 root $thing
						if (fieldSchema.fieldType === 'rootField') {
							if (!('$root' in node)) {
								throw new Error(`[Internal] Field ${field} is a rootField but the object is not a root`);
							}
							const rootNode = node as unknown as { $root: BQLMutationBlock | BQLMutationBlock[] };
							setRootMeta(rootNode, schema);
						}

						// 3.2.3 BQL pre-validations => All validations should happen on subNode, if else, leaves are skipped
						const preValidate = isArray(node[field]) ? node[field] : [node[field]];

						const cleanPath = paths.slice(1).join('.');
						preValidate.forEach((subNode: BQLMutationBlock) => {
							if (!subNode) {
								return;
							}
							/// For cardinality ONE, we need to specify the $op of the children
							if (
								fieldSchema?.cardinality === 'ONE' &&
								!subNode.$op &&
								!subNode.$id &&
								!subNode.$filter &&
								!subNode.$tempId &&
								node.$op !== 'create'
							) {
								throw new Error(`Please specify if it is a create or an update. Path: ${cleanPath}.${field}`);
							}
							if (subNode.$tempId) {
								if (
									!(
										subNode.$op === undefined ||
										subNode.$op === 'link' ||
										subNode.$op === 'create' ||
										subNode.$op === 'update'
									)
								) {
									throw new Error(
										`Invalid op ${subNode.$op} for tempId. TempIds can be created, or when created in another part of the same mutation. In the future maybe we can use them to catch stuff in the DB as well and group them under the same tempId.`,
									);
								}
							}
						});
						/// 3.2.4 children enrichment
						//redefining childrenArray as it might have changed
						if (['linkField', 'roleField'].includes(fieldSchema.fieldType)) {
							enrichChildren(node, field, fieldSchema, schema);
						}

						//3.2.5 splitIds()
						splitMultipleIds(node, field, schema);

						/// 3.2.6 Field computes
						if (['rootField', 'linkField', 'roleField'].includes(fieldSchema.fieldType)) {
							computeFields(node, field, schema);
						}

						// 3.2.7
						//#region BQL validations
						const toValidate = isArray(node[field]) ? node[field] : [node[field]];

						toValidate.forEach((subNode: BQLMutationBlock) => {
							const subNodeSchema = getCurrentSchema(schema, subNode);
							const { unidentifiedFields, usedLinkFields, usedFields, fields } = getCurrentFields(
								subNodeSchema,
								subNode,
							);

							//Check that every used field is in the fields array
							usedFields.forEach((uf) => {
								if (!fields.includes(uf)) {
									throw new Error(`[Schema] Field ${uf} not found in the schema`);
								}
							});

							if (unidentifiedFields.length > 0) {
								throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
							}
							//Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.
							if (usedLinkFields.length > 1) {
								const usedLinkFieldsSchemas = subNodeSchema.linkFields?.filter((lf) =>
									usedLinkFields.includes(lf.path),
								);
								/// Check if at least two of the usedLinkFields schemas, share same relation and have different targets
								usedLinkFieldsSchemas?.some((lf1, i) => {
									return usedLinkFieldsSchemas.some((lf2, j) => {
										if (i !== j && lf1.target !== lf2.target && lf1.relation === lf2.relation) {
											throw new Error(
												"[Wrong format]: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.",
											);
										}
									});
								});
							}
						});

						if (!has$Fields) {
							//if it has $field, it has dependencies so its still not ready for transformation
							//#endregion BQL validations

							// 3.3.8
							//#region pre-hook transformations
							preHookTransformations(node, field, schema, config);
							//#endregion pre-hook transformations

							// 3.2.9
							//#region pre-hook validations
							preHookValidations(node, field, schema, config);
							//#endregion pre-hook validations
						}
					}
				});
			}
		}),
	);

	if (isArray(result.$rootWrap.$root)) {
		return result.$rootWrap.$root as EnrichedBQLMutationBlock[];
	} else {
		return result.$rootWrap.$root as EnrichedBQLMutationBlock;
	}
};
