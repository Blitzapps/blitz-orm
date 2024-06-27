/* eslint-disable no-param-reassign */
import type { Draft } from 'immer';
import { produce, isDraft, current } from 'immer';
import type { TraversalCallbackContext, TraversalMeta } from 'object-traversal';
import { getNodeByPath, traverse } from 'object-traversal';
import { isArray, isObject, listify, mapEntries } from 'radash';
import { SharedMetadata, SuqlMetadata } from './types/symbols';

// todo: split helpers between common helpers, typeDBhelpers, dgraphelpers...
import type {
	BormSchema,
	BormRelation,
	BQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	LinkedFieldWithThing,
	RawBQLQuery,
	DataField,
	BormEntity,
	FilledBQLMutationBlock,
	DBHandles,
	DBHandleKey,
	ThingType,
	PositiveFilter,
	EnrichedDataField,
	EnrichedLinkField,
	EnrichedRoleField,
} from './types';
import type { AdapterContext } from './adapters';
import { adapterContext } from './adapters';
import { getSurrealLinkFieldQueryPath } from './adapters/surrealDB/enrichSchema/helpers';

const getDbPath = (thing: string, attribute: string, shared?: boolean) =>
	shared ? attribute : `${thing}·${attribute}`;

export const getPath = (dbPath: string) => {
	const parts = dbPath.split('·');
	return parts[parts.length - 1];
};

export const oFind = <RemovedKeys extends string, T extends Record<string | number | symbol, any>>(
	obj: T,
	fn: (k: string | number | symbol, v: any) => boolean,
): Omit<T, RemovedKeys>[Exclude<keyof T, RemovedKeys>] =>
	Object.values(Object.fromEntries(Object.entries(obj).filter(([k, v]) => fn(k, v))))[0];

export const oFilter = <K extends string | number | symbol, T extends Record<K, any>>(
	obj: T,
	fn: (k: K, v: any) => boolean,
): Partial<T> => Object.fromEntries(Object.entries(obj).filter(([k, v]) => fn(k as K, v))) as Partial<T>;

export const enrichSchema = (schema: BormSchema, dbHandles: DBHandles): EnrichedBormSchema => {
	const allLinkedFields: LinkedFieldWithThing[] = [];
	// #region 1)

	const withExtensionsSchema = produce(schema, (draft) =>
		traverse(
			draft,
			({ key, value, meta }: TraversalCallbackContext) => {
				if (meta.depth !== 2) {
					return;
				}
				if (key) {
					// * Adding dbPath of local dataFields
					value.dataFields = value.dataFields?.map((df: DataField) => ({
						...df,
						cardinality: df.cardinality || 'ONE',
						dbPath: getDbPath(key, df.path, df.shared),
					}));
				}
				if (value.extends) {
					if (!value.defaultDBConnector.as) {
						//todo: Check if we can add the "as" as default. When the path of the parent === name of the parent then it's fine. As would be used for those cases where they are not equal (same as path, which is needed only if different names)
						throw new Error(
							`[Schema] ${key} is extending a thing but missing the "as" property in its defaultDBConnector. Path:${meta.nodePath}`,
						);
					}

					/// IMPORT THE EXTENDED SCHEMA
					const extendedSchema = (draft.entities[value.extends] || draft.relations[value.extends]) as
						| EnrichedBormRelation
						| EnrichedBormEntity;

					/// find out all the thingTypes this thingType is extending
					const allExtends = [value.extends, ...(extendedSchema.allExtends || [])];
					value.allExtends = allExtends;
					value as BormEntity | BormRelation;

					allExtends.forEach((ext) => {
						if (draft.entities[ext]) {
							//@ts-expect-error : it's normal is just a draft
							draft.entities[ext].subTypes = [key, ...(draft.entities[ext].subTypes || [])];
						} else if (draft.relations[ext]) {
							//@ts-expect-error : it's normal is just a draft
							draft.relations[ext].subTypes = [key, ...(draft.relations[ext].subTypes || [])];
						} else {
							throw new Error(`[Schema] ${key} is extending a thing that does not exist in the schema: ${ext}`);
						}
					});

					value.idFields = extendedSchema.idFields
						? Array.from(new Set((value.idFields || []).concat(extendedSchema.idFields)))
						: value.idFields;

					value.dataFields = extendedSchema.dataFields
						? (value.dataFields || []).concat(
								extendedSchema.dataFields.map((df: DataField) => {
									// * Adding dbPath of extended dataFields
									let deepExtendedThing = value.extends;
									let deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
									while (!deepSchema.dataFields?.find((deepDf: DataField) => deepDf.path === df.path)) {
										deepExtendedThing = 'extends' in deepSchema ? deepSchema.extends : undefined;
										deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
									}
									return {
										...df,
										dbPath: getDbPath(deepExtendedThing, df.path, df.shared),
										[SharedMetadata]: {
											//@ts-expect-error - Is normal because we are extending it here
											inheritanceOrigin: df[SharedMetadata]?.inheritanceOrigin || value.extends,
										},
									};
								}),
							)
						: value.dataFields;

					//Only for roles in th extended schema
					if ('roles' in extendedSchema) {
						const val = value as BormRelation;
						const extendedRelationSchema = extendedSchema as BormRelation;
						if (extendedRelationSchema.roles) {
							const extendedRelationSchemaWithOrigin = mapEntries(extendedRelationSchema.roles, (roleKey, role) => {
								return [
									roleKey,
									{
										...role,
										[SharedMetadata]: {
											//@ts-expect-error - Is normal because we are extending it here
											inheritanceOrigin: role[SharedMetadata]?.inheritanceOrigin || value.extends,
										},
									},
								];
							});

							val.roles = {
								...(val.roles || {}),
								...extendedRelationSchemaWithOrigin,
							};
						}
					}

					value.linkFields = extendedSchema.linkFields
						? (value.linkFields || []).concat(
								extendedSchema.linkFields.map((lf) => ({
									...lf,
									[SharedMetadata]: {
										inheritanceOrigin: lf[SharedMetadata]?.inheritanceOrigin || value.extends,
									},
								})),
							)
						: value.linkFields;

					//todo: Do some checks, and potentially simplify the hooks structure
					if (extendedSchema?.hooks?.pre) {
						value.hooks = value.hooks || {};
						value.hooks.pre = value.hooks.pre || [];
						value.hooks.pre = [...(extendedSchema?.hooks?.pre || []), ...(value?.hooks?.pre || [])];
					}
				}
			},
			{ traversalType: 'breadth-first' },
		),
	);
	// #endregion

	// * Gather linkFields
	traverse(schema, ({ key, value, meta }: TraversalCallbackContext) => {
		if (key === 'linkFields') {
			const getThingTypes = () => {
				if (!meta.nodePath) {
					throw new Error('No path');
				}
				const [thingPath, thing] = meta.nodePath.split('.');
				const thingType = thingPath === 'entities' ? 'entity' : thingPath === 'relations' ? 'relation' : '';
				return {
					thing,
					thingType,
				};
			};
			const thingTypes = getThingTypes();
			const withThing = !Array.isArray(value)
				? [
						{
							...value,
							...thingTypes,
						},
					]
				: value.map((x) => ({ ...x, ...thingTypes }));

			allLinkedFields.push(...withThing);
		}
	});

	// * Enrich the schema
	const enrichedSchema = produce(withExtensionsSchema, (draft: Partial<EnrichedBormSchema>) =>
		traverse(draft, ({ value, key, meta }: TraversalCallbackContext) => {
			// id things
			if (meta.depth === 2 && value.idFields && !value.id) {
				// depth 2 are entities and relations
				// eslint-disable-next-line prefer-destructuring
				value.name = key;
				const thingType = () => {
					if (meta.nodePath?.split('.')[0] === 'entities') {
						return 'entity';
					}
					if (meta.nodePath?.split('.')[0] === 'relations') {
						return 'relation';
					}
					throw new Error('Unsupported node attributes');
				};
				value.thingType = thingType();
				/// We identify the database assigned to this thing
				//@ts-expect-error - TODO
				const thingDB: DBHandleKey = Object.keys(dbHandles).find((key) =>
					// @ts-expect-error - TODO
					dbHandles[key]?.get(value.defaultDBConnector.id),
				);
				value.db = thingDB as DBHandleKey; //todo
				value.dbContext = adapterContext[thingDB] as AdapterContext; //todo

				// init the arrays
				value.computedFields = [];
				value.virtualFields = [];
				value.requiredFields = [];
				value.enumFields = [];
				value.fnValidatedFields = [];

				// adding all the linkFields to roles
				if ('roles' in value) {
					const val = value as EnrichedBormRelation;

					Object.entries(val.roles).forEach(([roleKey, role]) => {
						// eslint-disable-next-line no-param-reassign
						role.fieldType = 'roleField';
						const playedBy = allLinkedFields.filter((x) => x.relation === key && x.plays === roleKey) || [];
						role.playedBy = playedBy;
						role.name = roleKey;
						const $things = [...new Set(playedBy.map((x) => x.thing))];
						role.$things = $things;

						const originalRelation = role[SharedMetadata]?.inheritanceOrigin || value.name;

						if ($things.length > 1) {
							console.warn(
								`Not supported yet: Role ${roleKey} in ${value.name} is played by multiple things: ${$things.join(', ')}`,
							);
						}
						//get all subTyped for each potential player
						const playerThingsWithSubTypes = $things.flatMap((playerThing) => {
							const playerSchema = getSchemaByThing(schema, playerThing);
							const subTypes = playerSchema?.subTypes || [];
							return [playerThing, ...subTypes];
						});

						const queryPath = `->\`${originalRelation}_${roleKey}\`->(\`${playerThingsWithSubTypes.join('`,`')}\`)`;

						role[SuqlMetadata] = {
							queryPath,
						};
					});
				}
				if ('linkFields' in value && value.linkFields) {
					const val = value as EnrichedBormRelation;

					val.linkFields?.forEach((linkField) => {
						linkField.fieldType = 'linkField';
						const linkFieldRelation = withExtensionsSchema.relations[linkField.relation];

						if (!linkField.isVirtual) {
							//its ok for virtual linkFields to don't have a relation
							if (!linkFieldRelation) {
								throw new Error(`The relation ${linkField.relation} does not exist in the schema`);
							}

							if (linkFieldRelation.roles?.[linkField.plays] === undefined) {
								throw new Error(
									`The role ${linkField.plays} is not defined in the relation ${linkField.relation} (linkField: ${linkField.path})`,
								);
							}
						}

						//#region SHARED METADATA

						if (linkField.target === 'relation') {
							if (linkField.isVirtual) {
								throw new Error(
									`[Schema] Virtual linkFields can't target a relation. Thing: "${val.name}" LinkField: "${linkField.path}. Path:${meta.nodePath}."`,
								);
							}
							linkField.$things = [linkField.relation];
							linkField.oppositeLinkFieldsPlayedBy = [
								{
									plays: linkField.path,
									thing: linkField.relation,
									thingType: 'relation',
								},
							];
						}
						if (linkField.target === 'role') {
							///target role
							const allOppositeLinkFields =
								allLinkedFields.filter((x) => x.relation === linkField.relation && x.plays !== linkField.plays) || [];

							// by default, all oppositeLinkFields
							linkField.oppositeLinkFieldsPlayedBy = allOppositeLinkFields;

							// We remove the target relation ones
							linkField.oppositeLinkFieldsPlayedBy = linkField.oppositeLinkFieldsPlayedBy.filter(
								(x) => x.target === 'role',
							);

							if (linkField.oppositeLinkFieldsPlayedBy.length === 0) {
								throw new Error(
									`[Schema] LinkFields require to have at least one opposite linkField playing an opposite role. Thing: "${val.name}" LinkField: "${linkField.path}. Path:${meta.nodePath}."`,
								);
							}

							linkField.$things = linkField.oppositeLinkFieldsPlayedBy.map((x) => x.thing);

							// #region FILTERING OPPOSITE LINKFIELDS
							// const { targetRoles, filter } = linkField;
							// Example targetRoles: ['color', 'users']
							//Can be combined with filter, for instance to automatically filter by $thing

							//If after the filters, we still have 2, then the schema is wrong
							if (linkField.oppositeLinkFieldsPlayedBy.length > 1) {
								throw new Error(
									`Not supported: LinkField ${linkField.path} in ${val.name} has multiple candidates ${linkField.oppositeLinkFieldsPlayedBy.map((lf) => lf.thing).join(',')} and this is not yet supported. Please target a single one using targetRoles with a single role`,
								);
							}
							// #endregion
						}
						//#endregion

						//#region SUREALDB METADATA

						// We take the original relation as its the one that holds the name of the relation in surrealDB
						const originalRelation =
							// @ts-expect-error - This is fine, extensions schema is a middle state
							linkFieldRelation?.roles?.[linkField.plays][SharedMetadata]?.inheritanceOrigin ?? linkField.relation;
						const queryPath = getSurrealLinkFieldQueryPath({ linkField, originalRelation, withExtensionsSchema });

						linkField[SuqlMetadata] = {
							queryPath,
						};
						//#endregion
					});
				}
			}

			// role fields
			if (typeof value === 'object' && 'playedBy' in value) {
				// if (value.playedBy.length > 1) {
				const playedBySet = [...new Set(value.playedBy.map((x: LinkedFieldWithThing) => x.thing))];
				if (playedBySet.length > 1) {
					throw new Error(
						`[Schema] roleFields can be only played by one thing. Role: ${key}, path:${meta.nodePath}, played by: ${playedBySet.join(', ')}`,
					);
				}
				if (value.playedBy.length === 0) {
					throw new Error(
						`[Schema] roleFields should be played at least by one thing. Role: ${key}, path:${meta.nodePath}`,
					);
				}
			}

			//if default or computed, add to computed fields list
			if (meta.depth === 4) {
				const [type, thingId] = meta.nodePath?.split('.') || [];
				//todo change "type" to "thingType"
				// @ts-expect-error - TODO
				const draftSchema = draft[type][thingId] as EnrichedBormEntity;

				if (!isArray(value) && typeof value === 'object') {
					//skip meta.depth 4 when its arrays or undefined or not an object
					if (value.validations) {
						if (value.validations.required) {
							draftSchema.requiredFields.push(value.path);
						}
						if (value.validations.enum) {
							draftSchema.enumFields.push(value.path);
						}
						if (value.validations.fn) {
							draftSchema.fnValidatedFields.push(value.path);
						}
					}

					if (value.default) {
						if (value.isVirtual) {
							// default and virtual means computed
							draftSchema.virtualFields.push(value.path);
						} else {
							//default but not virtual means pre-computed (default value), borm side
							draftSchema.computedFields.push(value.path);
						}
					} else {
						if (value.isVirtual) {
							//not default but isVirtual means, computed in the DB side, not borm side
							draftSchema.virtualFields.push(value.path);
						}
					}
				}
			}

			//if it requires validations, add to the fields that required validations
		}),
	) as EnrichedBormSchema;

	return enrichedSchema;
};

export const getSchemaByThing = (
	schema: BormSchema | EnrichedBormSchema,
	$thing: string,
): EnrichedBormEntity | EnrichedBormRelation => {
	if ($thing in schema.entities) {
		return schema.entities[$thing] as EnrichedBormEntity;
	}
	if ($thing in schema.relations) {
		return schema.relations[$thing] as EnrichedBormRelation;
	}
	throw new Error(`${$thing} is not defined in the schema`);
};

export const getCurrentSchema = (
	schema: BormSchema | EnrichedBormSchema,
	node: Partial<BQLMutationBlock>,
): EnrichedBormEntity | EnrichedBormRelation => {
	if (!node) {
		throw new Error('[Internal] No node for getCurrentSchema');
	}
	if (node.$thing) {
		if (node.$thingType === 'entity') {
			if (!(node.$thing in schema.entities)) {
				throw new Error(`Missing entity '${node.$thing}' in the schema`);
			}
			return schema.entities[node.$thing] as EnrichedBormEntity;
		}
		if (node.$thingType === 'relation') {
			if (!(node.$thing in schema.relations)) {
				throw new Error(`Missing relation '${node.$thing}' in the schema`);
			}
			return schema.relations[node.$thing] as EnrichedBormRelation;
		}
		// TODO: This should be validated during the initialization
		if (node.$thing in schema.entities && node.$thing in schema.relations) {
			throw new Error(`Ambiguous $thing ${node.$thing}`);
		}
		if (node.$thing in schema.entities) {
			return schema.entities[node.$thing] as EnrichedBormEntity;
		}
		if (node.$thing in schema.relations) {
			return schema.relations[node.$thing] as EnrichedBormRelation;
		}
		throw new Error(`Wrong schema or query for ${JSON.stringify(node, null, 2)}`);
	}

	//! Todo: delete when this works with the new $thing and $thingType fields
	if (node.$entity) {
		if (!(node.$entity in schema.entities)) {
			throw new Error(`Missing entity '${node.$entity}' in the schema`);
		}
		return schema.entities[node.$entity] as EnrichedBormEntity;
	}
	if (node.$relation) {
		if (!(node.$relation in schema.relations)) {
			throw new Error(`Missing relation '${node.$relation}' in the schema`);
		}
		return schema.relations[node.$relation] as EnrichedBormRelation;
	}
	throw new Error(`Wrong schema or query for ${JSON.stringify(node, null, 2)}`);
};

export const getFieldType = (
	currentSchema: EnrichedBormRelation | EnrichedBormEntity,
	key: string,
): ['dataField' | 'linkField' | 'roleField', EnrichedDataField | EnrichedLinkField | EnrichedRoleField] => {
	const dataFieldSchema = currentSchema.dataFields?.find((dataField: any) => dataField.path === key);
	if (dataFieldSchema) {
		return ['dataField', dataFieldSchema];
	}
	const linkFieldSchema = currentSchema.linkFields?.find((linkField: any) => linkField.path === key);
	if (linkFieldSchema) {
		return ['linkField', linkFieldSchema];
	}
	const roleFieldSchema = 'roles' in currentSchema ? currentSchema.roles[key] : undefined;
	if (roleFieldSchema) {
		return ['roleField', roleFieldSchema];
	}
	throw new Error(`Field ${key} not found in schema, Defined in $filter`);
};
export const getIdFieldKey = (schema: EnrichedBormSchema, node: Partial<BQLMutationBlock>) => {
	const currentSchema = getCurrentSchema(schema, node);
	if (currentSchema?.idFields?.length && currentSchema?.idFields?.length > 1) {
		throw new Error(`Multiple ids not yet enabled / composite ids: ${currentSchema?.idFields}`);
	}

	const [idField] = currentSchema.idFields; //todo composed ids
	return idField;
};

export const getThingType = (rootNode: BQLMutationBlock, schema: EnrichedBormSchema): ThingType => {
	const thing = rootNode.$thing || rootNode.$entity || rootNode.$relation;
	if (!thing) {
		throw new Error('[Internal] No thing found');
	}
	if (rootNode.$entity) {
		return 'entity';
	} else if (rootNode.$relation) {
		return 'relation';
	} else if (schema.entities[thing]) {
		return 'entity';
	} else if (schema.relations[thing]) {
		return 'relation';
	}
	throw new Error('No thing found');
};

export const getFieldSchema = (
	schema: EnrichedBormSchema,
	node: Partial<BQLMutationBlock>,
	field: string,
): EnrichedDataField | EnrichedLinkField | EnrichedRoleField => {
	const currentSchema = getCurrentSchema(schema, node);
	const foundLinkField = currentSchema.linkFields?.find((lf) => lf.path === field);
	if (foundLinkField) {
		return foundLinkField as EnrichedLinkField;
	}
	const foundDataField = currentSchema.dataFields?.find((lf) => lf.path === field);
	if (foundDataField) {
		return foundDataField as EnrichedDataField;
	}
	const foundRoleField = 'roles' in currentSchema ? currentSchema.roles?.[field] : undefined;
	if (foundRoleField) {
		return foundRoleField as EnrichedRoleField;
	}
	throw new Error(`Field ${field} not found in schema`);
};

export const getCardinality = (
	schema: EnrichedBormSchema,
	node: Partial<BQLMutationBlock>,
	field: string,
): 'ONE' | 'MANY' | 'INTERVAL' | undefined => {
	const currentFieldSchema = getFieldSchema(schema, node, field);
	return currentFieldSchema?.cardinality;
};

type ReturnTypeWithoutNode = {
	fields: string[];
	dataFields: string[];
	roleFields: string[];
	linkFields: string[];
};

type ReturnTypeWithNode = ReturnTypeWithoutNode & {
	usedFields: string[];
	usedRoleFields: string[];
	usedLinkFields: string[];
	usedDataFields: string[];
	unidentifiedFields: string[];
};

// todo: do something so this enriches the query so no need to call it multiple times
export const getCurrentFields = <T extends (BQLMutationBlock | RawBQLQuery) | undefined>(
	currentSchema: EnrichedBormEntity | EnrichedBormRelation,
	node?: T,
): T extends undefined ? ReturnTypeWithoutNode : ReturnTypeWithNode => {
	const availableDataFields = currentSchema.dataFields?.map((x) => x.path) || [];
	const availableLinkFields = currentSchema.linkFields?.map((x) => x.path) || [];
	const availableRoleFields = 'roles' in currentSchema ? listify(currentSchema.roles, (k: string) => k) : [];
	const availableFields = [
		...(availableDataFields || []),
		...(availableLinkFields || []),
		...(availableRoleFields || []),
	];

	// spot non existing fields
	const reservedRootFields = [
		'$entity',
		'$op',
		'$id',
		'$tempId',
		'$bzId',
		'$relation',
		'$parentKey', //todo: this is not a valid one, to delete!
		'$filter',
		'$fields',
		'$excludedFields',
		'$thing',
		'$thingType',
	];

	const allowedFields = [...reservedRootFields, ...availableFields];

	if (!node) {
		return {
			fields: availableFields,
			dataFields: availableDataFields,
			roleFields: availableRoleFields,
			linkFields: availableLinkFields,
		} as ReturnTypeWithNode;
	}
	const usedFields = node.$fields
		? //queries
			(node.$fields.map((x: string | { $path: string }) => {
				if (typeof x === 'string') {
					if (x.startsWith('$') || x.startsWith('%')) {
						return undefined;
					}
					if (!availableFields.includes(x)) {
						throw new Error(`Field ${x} not found in the schema`);
					}
					return x;
				}
				if ('$path' in x && typeof x.$path === 'string') {
					return x.$path;
				}
				throw new Error('[Wrong format] Wrongly structured query');
			}) as string[])
		: //mutations
			(listify<any, string, any>(node, (k: string) => {
				if (k.startsWith('$') || k.startsWith('%')) {
					return undefined;
				}
				if (!availableFields.includes(k)) {
					throw new Error(`[Schema] Field ${k} not found in the schema`);
				}
				return k;
			}).filter((x) => x !== undefined) as string[]);

	const localFilterFields = !node.$filter
		? []
		: listify(node.$filter as PositiveFilter, (k: string) =>
				k.toString().startsWith('$') ? undefined : k.toString(),
			).filter((x) => x && availableDataFields?.includes(x));
	const nestedFilterFields = !node.$filter
		? []
		: listify(node.$filter as PositiveFilter, (k: string) =>
				k.toString().startsWith('$') ? undefined : k.toString(),
			).filter((x) => x && [...(availableRoleFields || []), ...(availableLinkFields || [])]?.includes(x));

	const unidentifiedFields = [...usedFields, ...localFilterFields]
		.filter((x) => !x?.startsWith('%'))
		// @ts-expect-error - TODO description
		.filter((x) => !allowedFields.includes(x))
		.filter((x) => x) as string[]; // todo 🤔
	const localFilters = !node.$filter ? {} : oFilter(node.$filter, (k: string, _v) => localFilterFields.includes(k));
	const nestedFilters = !node.$filter ? {} : oFilter(node.$filter, (k: string, _v) => nestedFilterFields.includes(k));

	return {
		fields: availableFields,
		dataFields: availableDataFields,
		roleFields: availableRoleFields,
		linkFields: availableLinkFields,
		usedFields,
		usedLinkFields: availableLinkFields.filter((x) => usedFields.includes(x)),
		usedRoleFields: availableRoleFields.filter((x) => usedFields.includes(x)),
		usedDataFields: availableDataFields.filter((x) => usedFields.includes(x)),
		unidentifiedFields,
		...(localFilterFields.length ? { localFilters } : {}),
		...(nestedFilterFields.length ? { nestedFilters } : {}),
	} as ReturnTypeWithNode;
};

/*
export const arrayAt = <T>(arr: T[] | undefined, index: number): T | undefined => {
	if (arr === undefined || !Array.isArray(arr) || index < -arr.length || index >= arr.length) {
		return undefined;
	}
	return arr[index < 0 ? arr.length + index : index];
};*/

export const notNull = <TValue>(value: TValue | null): value is TValue => {
	return value !== null;
};

export const extractChildEntities = (entities: EnrichedBormSchema['entities'], parentEntity: string) => {
	return Object.values(entities).reduce((acc: string[], value) => {
		if (value.extends === parentEntity) {
			acc.push(value.name);
		}
		return acc;
	}, []);
};

export const capitalizeFirstLetter = (string: string) => {
	if (typeof string !== 'string') {
		throw new Error('capitalizeFirstLetter: string is not a string');
	}
	return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

export const getParentNode = (blocks: Record<any, any>, parent: any, meta: TraversalMeta) => {
	const currentPath = meta.nodePath || '';
	const pathParts = currentPath.split('.');
	const parentPath = isArray(parent)
		? pathParts.slice(0, -2).join('.') // Remove last two parts for an array parent
		: pathParts.slice(0, -1).join('.'); // Remove only the last part for a non-array parent
	return parent ? getNodeByPath(blocks, parentPath) : {}; //undefined parent for root
};

export const getSymbols = (oldBlock: Partial<FilledBQLMutationBlock>): Record<symbol, any> => {
	return Reflect.ownKeys(oldBlock)
		.filter((key): key is symbol => typeof key === 'symbol')
		.reduce(
			(symbols, symbolKey) => {
				//@ts-expect-error - TODO
				// eslint-disable-next-line no-param-reassign
				symbols[symbolKey] = oldBlock[symbolKey];
				return symbols;
			},
			{} as Record<symbol, any>,
		);
};

export const normalPropsCount = (obj: Record<string, any>) => {
	return Object.keys(obj).filter((key) => !key.startsWith('$')).length;
};

export const isBQLBlock = (block: unknown): block is FilledBQLMutationBlock => {
	return isObject(block) && ('$entity' in block || '$relation' in block || '$thing' in block);
};

type Drafted<T> = T | Draft<T>;

// Recursively define the type to handle nested structures
type DeepCurrent<T> =
	T extends Array<infer U> ? Array<DeepCurrent<U>> : T extends object ? { [K in keyof T]: DeepCurrent<T[K]> } : T;

export const deepCurrent = <T>(obj: Drafted<T>): any => {
	if (Array.isArray(obj)) {
		// Explicitly cast the return type for arrays
		return obj.map((item) => current(item)) as DeepCurrent<T>;
	} else if (obj && typeof obj === 'object') {
		// Handle non-null objects
		const plainObject = isDraft(obj) ? current(obj) : obj;
		const result: any = {};
		Object.entries(plainObject).forEach(([key, value]) => {
			// Use the key to dynamically assign the converted value
			result[key] = isDraft(value) ? current(value) : value;
		});
		// Explicitly cast the return type for objects
		return result as DeepCurrent<T>;
	} else {
		// Return the value directly for non-objects and non-arrays
		return obj as DeepCurrent<T>;
	}
};

export const assertDefined = <T>(value?: T, msg?: string): T => {
	if (value === undefined) {
		if (msg) {
			throw new Error(msg);
		}
		throw new Error('Value is undefined');
	}
	return value;
};

export const indent = (line: string, depth: number) => {
	let _indent = '';
	for (let i = 0; i < depth; i++) {
		_indent += '  ';
	}
	return `${_indent}${line}`;
};
