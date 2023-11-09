import { produce, current } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse, getNodeByPath } from 'object-traversal';
import { isObject, listify, shake } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { getCurrentFields, getCurrentSchema, oFind } from '../../helpers';
import type {
	BQLMutationBlock,
	EnrichedBormRelation,
	EnrichedDataField,
	EnrichedLinkField,
	EnrichedRoleField,
	FilledBQLMutationBlock,
} from '../../types';
import type { PipelineOperation } from '../pipeline';
import { compute } from '../../engine/compute';

// parseBQLQueryObjectives:
// 1) Validate the query (getRawBQLQuery)
// 2) Prepare it in a universally way for any DB (output an enrichedBQLQuery)

const sanitizeTempId = (id: string): string => {
	// Ensure the string starts with "_:"
	if (!id.startsWith('_:')) {
		throw new Error("ID must start with '_:'.");
	}

	// Remove the prefix "_:" for further validation
	const sanitizedId = id.substring(2);

	// Ensure there are no symbols (only alphanumeric characters, hyphens, and underscores)
	if (!/^[a-zA-Z0-9-_]+$/.test(sanitizedId)) {
		throw new Error('$tempId must contain only alphanumeric characters, hyphens, and underscores.');
	}

	// Ensure the ID is no longer than 36 characters (including the "_:" prefix)
	if (id.length > 36) {
		throw new Error('$tempId must not be longer than 36 characters.');
	}

	return sanitizedId;
};

export const fillBQLMutation: PipelineOperation = async (req) => {
	const { rawBqlRequest, schema } = req;

	// STEP 1, remove undefined stuff and sanitize tempIds
	const shakeBqlRequest = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val, key, parent }: TraversalCallbackContext) => {
				if (isObject(val)) {
					// eslint-disable-next-line no-param-reassign
					val = shake(val, (att) => att === undefined);
				}
				if (key === '$tempId') {
					// @ts-expect-error - TODO description
					// eslint-disable-next-line no-param-reassign
					parent[key] = sanitizeTempId(val);
				}
			}),
		);
	};

	const shakedBqlRequest = shakeBqlRequest(rawBqlRequest);

	// console.log('shakedBqlRequest', JSON.stringify(shakedBqlRequest, null, 3));

	const stringToObjects = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val, meta, key }: TraversalCallbackContext) => {
				if (isObject(val)) {
					// <---------------mutating all objects---------------->
					// @ts-expect-error - TODO description
					if (val.$arrayOp) {
						throw new Error('Array op not supported yet');
					}
					/// ignore filters. In the future maybe transform the shortcuts of filters here (like $eq being a default)
					if (key === '$filter' || meta.nodePath?.includes('.$filter.')) {
						return;
					}

					const value = val as BQLMutationBlock; /// removing undefined values, nulls are no shaked as they are used to delete fields

					if (value.$op === 'create' && value.$id) {
						throw new Error("Can't write to computed field $id. Try writing to the id field directly.");
					}
					// console.log('<---------------------value', isDraft(value) ? current(value) : value);

					const currentSchema = getCurrentSchema(schema, value);

					const nodePathArray = meta.nodePath?.split('.');

					const notRoot = nodePathArray?.filter((x) => Number.isNaN(parseInt(x, 10))).join('.');

					if (!currentSchema) {
						throw new Error(`Schema not found for ${value.$entity || value.$relation}`);
					}

					value.$bzId = value.$tempId ?? `T_${uuidv4()}`;

					value[Symbol.for('schema') as any] = currentSchema;
					value[Symbol.for('dbId') as any] = currentSchema.defaultDBConnector.id;

					const { usedLinkFields, usedRoleFields } = getCurrentFields(currentSchema, value);

					type RoleFieldMap = {
						fieldType: 'roleField';
						path: string;
						schema: EnrichedRoleField;
					};

					type LinkFieldMap = {
						fieldType: 'linkField';
						path: string;
						schema: EnrichedLinkField;
					};

					const usedLinkFieldsMap = usedLinkFields.map(
						(linkFieldPath): LinkFieldMap => ({
							fieldType: 'linkField',
							path: linkFieldPath,
							// @ts-expect-error - TODO description
							schema: currentSchema.linkFields.find((y) => y.path === linkFieldPath),
						}),
					);

					const usedRoleFieldsMap =
						currentSchema.thingType === 'relation'
							? usedRoleFields.map(
									(roleFieldPath): RoleFieldMap => ({
										fieldType: 'roleField',
										path: roleFieldPath,
										schema: oFind(currentSchema.roles, (k) => k === roleFieldPath) as EnrichedRoleField,
									}),
							  )
							: [];

					/// validations
					/// If the current value uses at least one linkfield with target === 'role' and at least another field with target === 'relation', throw an unsupported (yet) error
					if (
						usedLinkFieldsMap.some((x) => x.schema?.target === 'role') &&
						usedLinkFieldsMap.some((x) => x.schema?.target === 'relation')
					) {
						throw new Error(
							"Unsupported: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.",
						);
					}

					/// multiple possible things in a role
					const multiplayedRoles = usedRoleFieldsMap.filter(
						(roleField) => [...new Set(roleField.schema.playedBy?.map((x) => x.thing))].length !== 1,
					);

					if (multiplayedRoles.length > 1) {
						throw new Error(
							`Field: ${
								multiplayedRoles[0].path
							} - If a role can be played by multiple things, you must specify the thing in the mutation: ${JSON.stringify(
								multiplayedRoles[0].schema.playedBy,
							)}. Schema: ${JSON.stringify(multiplayedRoles[0].schema)}`,
						);
					}

					const currentPath = meta.nodePath;

					/// <---------------mutating children objects ---------------->
					[...usedLinkFieldsMap, ...usedRoleFieldsMap]?.forEach((currentField) => {
						const currentValue = value[currentField.path];

						/// ignore undefined
						if (currentValue === undefined) {
							return;
						}
						// console.log(':::', { currentField });

						const currentFieldSchema = currentField.schema;

						if (!currentFieldSchema) {
							throw new Error(`Field ${currentField.path} not found in schema`);
						}

						const currentEdgeSchema =
							// @ts-expect-error - TODO description
							currentField.fieldType === 'roleField' ? currentFieldSchema?.playedBy[0] : currentFieldSchema;

						const getCurrentRelation = () => {
							if (
								currentFieldSchema &&
								'relation' in currentFieldSchema &&
								currentEdgeSchema?.relation === value.$relation
							) {
								return '$self';
							}
							if (currentEdgeSchema?.relation) {
								return currentEdgeSchema?.relation;
							}
							return '$self';
						};

						const relation = getCurrentRelation();
						const relationSchema =
							relation === '$self' ? (currentSchema as EnrichedBormRelation) : schema.relations[relation];

						// console.log('relationSchema', relationSchema);

						const currentFieldRole = oFind(relationSchema.roles, (k, _v) => k === currentField.path);

						// console.log('currentFieldRole', currentFieldRole);

						if (currentFieldRole?.playedBy?.length === 0) {
							throw new Error(`unused role: ${currentPath}.${currentField.path}`);
						}

						/// <-- VALIDATIONS -->
						if (!currentFieldSchema) {
							throw new Error(`Field ${currentField.path} not found in schema`);
						}

						const oppositeFields =
							currentField.fieldType === 'linkField'
								? (currentFieldSchema as EnrichedLinkField)?.oppositeLinkFieldsPlayedBy
								: (currentFieldSchema as EnrichedRoleField)?.playedBy;

						if (!oppositeFields) {
							throw new Error(`No opposite fields found for ${JSON.stringify(currentFieldSchema)}`);
						}

						if ([...new Set(oppositeFields?.map((x) => x.thing))].length > 1) {
							throw new Error(
								`Field: ${
									currentField.path
								} - If a role can be played by multiple things, you must specify the thing in the mutation: ${JSON.stringify(
									oppositeFields,
								)}. Schema: ${JSON.stringify(currentFieldSchema)}`,
							);
						}

						if (currentFieldSchema.cardinality === 'ONE') {
							if (Array.isArray(currentValue)) {
								throw new Error("Can't have an array in a cardinality === ONE link field");
							}
							// if is only one object, current is not a create, and the object has no op, throw error
						}

						// cardinality many are always arrays, unless it's an object that specifies an arrayOp like
						if (
							currentFieldSchema.cardinality === 'MANY' &&
							currentValue !== null &&
							!Array.isArray(currentValue) &&
							!currentValue.$arrayOp
						) {
							throw new Error(
								`${
									// @ts-expect-error - TODO description
									currentField.fieldType === 'linkField' ? currentFieldSchema.path : currentFieldSchema.name
								} is a cardinality === MANY thing. Use an array or a $arrayOp object`,
							);
						}
						// ignore those properly configured. Todo: migrate to $thing
						if (currentValue?.$entity || currentValue?.$relation) {
							return;
						}

						const [childrenLinkField] = oppositeFields;

						/// now we have the parent, so we can add the dependencies
						// const parentMeta = value[Symbol.for('parent') as any];
						// const parentPath = parentMeta.path;
						// const parentNode = !parentPath ? blocks : getNodeByPath(blocks, parentPath);

						/// this is the child object, so these Symbol.for... don't belong to the current node

						const currentFieldType = 'plays' in currentFieldSchema ? 'linkField' : 'roleField';
						const childrenThingObj = {
							[`$${childrenLinkField.thingType}`]: childrenLinkField.thing,
							[Symbol.for('relation') as any]: relation,
							[Symbol.for('edgeType') as any]: currentFieldType,
							[Symbol.for('parent') as any]: {
								path: currentPath,
								...(value.$id ? { $id: value.$id } : {}),
								...(value.$tempId ? { $tempId: value.$tempId } : {}),
								...(value.filter ? { filter: value.filter } : {}),
								links: oppositeFields,
							},
							[Symbol.for('role') as any]: childrenLinkField.plays, // this is the currentChildren
							// this is the parent
							[Symbol.for('oppositeRole') as any]: 'plays' in currentFieldSchema ? currentFieldSchema.plays : undefined, // todo
							[Symbol.for('relFieldSchema') as any]: currentFieldSchema,
						};

						// console.log('childrenThingObj', childrenThingObj);

						if (isObject(currentValue)) {
							/// probably here we are missing some link + update data for instance (the update data)
							// todo: for that reason it could be a good idea to send the other object as a thing outside?
							// todo: Another alternative could be to send the full object and treat this later

							value[currentField.path] = {
								...childrenThingObj,
								...currentValue,
							};

							// console.log('[obj]value', value[field as string]);
						}
						// todo: this does not allow the case accounts: ['id1','id2',{$tempId:'temp1'}] ideally tempIds should have some indicator like :_temp1 later so we can do ['id1','id2',':_tempid'] instead

						/// we already know it's 'MANY'
						if (Array.isArray(currentValue)) {
							// todo: check for arrays that are values and not vectors
							if (currentValue.every((x) => isObject(x))) {
								value[currentField.path] = currentValue.map((y) => {
									/// when a tempId is specified, in a relation, same as with $id, is a link by default
									return {
										...childrenThingObj,
										...y,
									};
								});
								// console.log('[obj-arr]value', value[field as string]);
							} else if (currentValue.every((x) => typeof x === 'string')) {
								value[currentField.path] = currentValue.map((y) => ({
									...childrenThingObj,
									$op: value.$op === 'create' ? 'link' : 'replace',
									$id: y,
								}));
							} else {
								throw new Error(`Invalid array value for ${currentField.path}`);
							}
						}

						/// we already know it's 'ONE'
						if (typeof currentValue === 'string') {
							value[currentField.path] = {
								...childrenThingObj,
								$op: value.$op === 'create' ? 'link' : 'replace', // if the parent is being created, then is not a replace, is a new link
								$id: currentValue, // todo: now all strings are ids and not tempIds, but in the future this might change
							};
						}

						/// can be both MANY or ONE
						if (currentValue === null) {
							const neutralObject = {
								...childrenThingObj,
								$op: 'unlink', // todo: embedded => delete
							};
							value[currentField.path] = currentFieldSchema.cardinality === 'MANY' ? [neutralObject] : neutralObject;
						}
					});

					// console.log('value', current(value));

					if (!notRoot && !value.$entity && !value.$relation) {
						throw new Error('Root things must specify $entity or $relation');
					}
					if (!notRoot) {
						// no need to do nothing with root objects or objects that already
					}
					// we will get the $entity/$relation of the nonRoot that don't have it
				}
			}),
		);
	};

	const withObjects = stringToObjects(shakedBqlRequest);
	// console.log('withObjects', withObjects);

	const fill = (blocks: BQLMutationBlock | BQLMutationBlock[]): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		// @ts-expect-error - TODO description
		return produce(blocks, (draft) =>
			traverse(draft, ({ parent, key, value: val, meta }: TraversalCallbackContext) => {
				if (isObject(val)) {
					if (Object.keys(val).length === 0) {
						throw new Error('Empty object!');
					}
					if (key === '$filter' || meta.nodePath?.includes('.$filter.')) {
						return;
					}
					const value = val as BQLMutationBlock;
					// console.log('value', value);
					// const currentTempId = value.$tempId || uuuiidv4();

					const nodePathArray = meta.nodePath?.split('.');

					///nodes with tempId require always an op because we can't know if it is a create or an update
					if (value.$tempId) {
						if (
							!(value.$op === undefined || value.$op === 'link' || value.$op === 'create' || value.$op === 'update')
						) {
							throw new Error(
								`Invalid op ${value.$op} for tempId. TempIds can be created, or when created in another part of the same mutation. In the future maybe we can use them to catch stuff in the DB as well and group them under the same tempId.`,
							);
						}
					}

					const notRoot = nodePathArray?.filter((x) => Number.isNaN(parseInt(x, 10))).join('.');

					const currentPath = !notRoot
						? meta.nodePath || '' /// keep the number in the root or set to root ''
						: Array.isArray(parent)
						? nodePathArray?.slice(0, -1).join('.')
						: meta.nodePath;

					const currentSchema = getCurrentSchema(schema, value);
					// todo:
					const { unidentifiedFields, dataFields, roleFields, linkFields } = getCurrentFields(currentSchema, value);

					/// get parent node
					const parentMeta = current(value)[Symbol.for('parent') as any];
					const parentPath = notRoot && parentMeta.path;
					const parentNode = !parentPath ? draft : getNodeByPath(draft, parentPath); /// draft instead of blocks as the $op is computed
					const parentOp = parentNode?.$op;

					if (notRoot && !parentOp) {
						throw new Error('Error: Parent $op not detected');
					}

					const currentFieldSchema = value[Symbol.for('relFieldSchema') as any];

					// todo: move the getOp logic to the first traverse of the fill so that the $op is available
					// We are doing something twice from the former traverse
					if (value.$op === 'replace') {
						if (parentOp === 'create') {
							value.$op = 'link';
						}
					}

					// console.log('currentValue', isDraft(value) ? current(value) : value);

					const hasUpdatedDataFields = Object.keys(value).some((x) => dataFields?.includes(x));

					const hasUpdatedChildren = Object.keys(value).some((x) => [...roleFields, ...linkFields]?.includes(x));
					const getOp = () => {
						if (value.$op) {
							return value.$op;
						} // if there is an op, then thats the one
						/// nested objects are create by default, unless is too ambiguous
						if (
							notRoot &&
							!value.$id &&
							!value.$tempId &&
							parentOp !== 'create' &&
							currentFieldSchema.cardinality === 'ONE'
						) {
							throw new Error(`Please specify if it is a create or an update. Path: ${meta.nodePath}`);
						}
						if (value.$tempId) {
							return 'create';
						}
						// todo: can move these to the first level traversal
						if ((value.$id || value.$filter) && hasUpdatedDataFields) {
							return 'update';
						} // if there is an id or a filter, is an update. If it was a delete,it has been specified
						if ((value.$id || value.$filter) && notRoot && !hasUpdatedDataFields && !hasUpdatedChildren) {
							return 'link';
						}
						if (!value.$filter && !value.$id && !value.$tempId) {
							return 'create';
						} // if it is not a delete, or an update, is a create (for this V0, missing link, unlink)
						if ((value.$id || value.$filter) && !hasUpdatedDataFields && hasUpdatedChildren) {
							return 'match';
						}
						throw new Error('Wrong op');
					};
					// if (!value.$tempId && !value.$id) value.$tempId = currentTempId;
					if (!value.$op) {
						value.$op = getOp();
					}
					if (!parent) {
						value.$parentKey = '';
					} // root

					// console.log('value', current(value));
					// errors
					/* if (!(value.$id || value.$tempId || value.$filter) && ['delete', 'link', 'update'].includes(value.$op)) {
            throw new Error('Targeted operations (update, delete, link) require an $id or a $filter');
          } */
					if (typeof parent === 'object') {
						// spot rights conflicts

						// modify current
						const ArParent = Array.isArray(parent);
						if (ArParent) {
							value[Symbol.for('index') as any] = key;
						} // nodePathArray.at(-1);
						value[Symbol.for('path') as any] = currentPath;
						value[Symbol.for('isRoot') as any] = !notRoot;
						value[Symbol.for('depth') as any] = notRoot?.split('.').length;
					}

					if (!value.$entity && !value.$relation) {
						throw new Error(`Node ${JSON.stringify(value)} without $entity/$relation`);
					}

					const { idFields, computedFields, virtualFields } = currentSchema;
					// todo: composite ids
					if (!idFields) {
						throw new Error('No idFields found');
					}
					const [idField] = idFields;
					// console.log('computedFields', computedFields);

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

						// We generate id fields when needed
						if (fieldPath === idField && value.$op === 'create' && !value[fieldPath]) {
							const defaultValue = compute({
								currentThing: value,
								fieldSchema: currentDef as EnrichedDataField, //id is always a datafield.
								mandatoryDependencies: true, //can't send to db without every dependency being there
							});

							value[fieldPath] = defaultValue; // we already checked that this value has not been defined
							// value.$id = defaultValue; // op=create don't need $id anymore, they have $bzId
							value.$id = defaultValue;
						}
					});

					/*

          // if a valid id is setup, move it to $id
          if (!value.$id) {
            if (value[idField]) {
              /// this is in creation when adding an id
              // value.$id = value[idField];
            } else {
              if (value.$op === 'create') {
                // throw new Error(`No id found for ${JSON.stringify(value)}`);
              }
              /// link, update, unlink or delete, without id, it gets a generic
              if (!value.$tempId) {
                // const localId = `all-${uuidv4()}`;
                // value.$tempId = tempId; No longer using this workaround, isLocalid is better
                // todo: probably $localId or Symbol.for("localId") would be better to reuse $id 🤔
                // value.$id = localId; /// we also need to setup it as the $id for chained stuff
                /// we need to tag it as a nonDbid
                value[Symbol.for('isLocalId') as any] = true;
              }
              /// if value.$idTemp id nothing to change, it keeps the current tempId
            }
          } */

					if (unidentifiedFields.length > 0) {
						throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
					}
				}
			}),
		);
	};

	const filledBQLMutation = fill(withObjects);

	// console.log('filledBQLMutation', JSON.stringify(filledBQLMutation, null, 3));

	if (Array.isArray(filledBQLMutation)) {
		req.filledBqlRequest = filledBQLMutation as FilledBQLMutationBlock[];
	} else {
		// eslint-disable-next-line no-param-reassign
		req.filledBqlRequest = filledBQLMutation as FilledBQLMutationBlock;
	}
};
