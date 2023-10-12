/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { listify } from 'radash';

// todo: split helpers between common helpers, typeDBhelpers, dgraphelpers...
import type {
	BormSchema,
	BormRelation,
	BQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	LinkedFieldWithThing,
	ParsedBQLQuery,
	RawBQLQuery,
	DataField,
	BormEntity,
} from './types';

export const getDbPath = (thing: string, attribute: string, shared?: boolean) =>
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

export const enrichSchema = (schema: BormSchema): EnrichedBormSchema => {
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
						dbPath: getDbPath(key, df.path, df.shared),
					}));
				}
				if (value.extends) {
					const extendedSchema = draft.entities[value.extends] || draft.relations[value.extends];
					/// find out all the thingTypes this thingType is extending
					// @ts-expect-error allExtends does not belong to the nonEnriched schema so this ts error is expecte
					value.allExtends = [value.extends, ...(extendedSchema.allExtends || [])];
					value as BormEntity | BormRelation;

					value.idFields = extendedSchema.idFields
						? (value.idFields || []).concat(extendedSchema.idFields)
						: value.idFields;
					value.dataFields = extendedSchema.dataFields
						? (value.dataFields || []).concat(
								extendedSchema.dataFields.map((df: DataField) => {
									// * Adding dbPath of extended dataFields
									let deepExtendedThing = value.extends;
									let deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
									while (!deepSchema.dataFields?.find((deepDf: DataField) => deepDf.path === df.path)) {
										deepExtendedThing = deepSchema.extends;
										deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
									}
									return {
										...df,
										dbPath: getDbPath(deepExtendedThing, df.path, df.shared),
									};
								}),
						  )
						: value.dataFields;
					value.linkFields = extendedSchema.linkFields
						? (value.linkFields || []).concat(extendedSchema.linkFields)
						: value.linkFields;

					if ('roles' in extendedSchema) {
						const val = value as BormRelation;
						const extendedRelationSchema = extendedSchema as BormRelation;
						val.roles = val.roles || {};
						val.roles = {
							...val.roles,
							...extendedRelationSchema.roles,
						};
						if (Object.keys(val.roles).length === 0) {
							val.roles = {};
						}
					}
				}
			},
			{ traversalType: 'breadth-first' },
		),
	);
	// #endregion

	// * Gather linkfields
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

	const enrichedSchema = produce(withExtensionsSchema, (draft) =>
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
				// init the array of computed values
				value.computedFields = [];
				// adding all the linkfields to roles
				if ('roles' in value) {
					const val = value as EnrichedBormRelation;

					Object.entries(val.roles).forEach(([roleKey, role]) => {
						// eslint-disable-next-line no-param-reassign
						role.playedBy = allLinkedFields.filter((x) => x.relation === key && x.plays === roleKey) || [];
						role.name = roleKey;
					});
				}
				if ('linkFields' in value && value.linkFields) {
					const val = value as EnrichedBormRelation;

					val.linkFields?.forEach((linkField) => {
						if (linkField.target === 'relation') {
							linkField.oppositeLinkFieldsPlayedBy = [
								{
									plays: linkField.path,
									thing: linkField.relation,
									thingType: 'relation',
								},
							];
							return;
						}

						const allOppositeLinkFields =
							allLinkedFields.filter((x) => x.relation === linkField.relation && x.plays !== linkField.plays) || [];

						// by default, all oppositeLinkFields
						linkField.oppositeLinkFieldsPlayedBy = allOppositeLinkFields;

						// #region FILTERING OPPOSITE LINKFIELDS
						const { filter } = linkField;
						// todo: not sure about this
						linkField.oppositeLinkFieldsPlayedBy = linkField.oppositeLinkFieldsPlayedBy.filter(
							(x) => x.target === 'role',
						);
						if (filter && Array.isArray(filter)) {
							linkField.oppositeLinkFieldsPlayedBy = linkField.oppositeLinkFieldsPlayedBy.filter((lf) =>
								// @ts-expect-error - TODO description
								filter.some((ft) => lf.thing === ft.$role),
							);

							linkField.oppositeLinkFieldsPlayedBy = linkField.oppositeLinkFieldsPlayedBy.filter((lf) =>
								// @ts-expect-error - TODO description
								filter.some((ft) => lf.thing === ft.$thing),
							);
						}
						if (filter && !Array.isArray(filter)) {
							linkField.oppositeLinkFieldsPlayedBy = linkField.oppositeLinkFieldsPlayedBy.filter(
								// @ts-expect-error - TODO description
								(lf) => lf.$role === filter.$role,
							);
							linkField.oppositeLinkFieldsPlayedBy = linkField.oppositeLinkFieldsPlayedBy.filter(
								// @ts-expect-error - TODO description
								(lf) => lf.thing === filter.$thing,
							);
						}
						// #endregion
					});
				}
			}

			// role fields
			if (typeof value === 'object' && 'playedBy' in value) {
				// if (value.playedBy.length > 1) {
				if ([...new Set(value.playedBy?.map((x: LinkedFieldWithThing) => x.thing))].length > 1) {
					throw new Error(
						`Unsupported: roleFields can be only played by one thing. Role: ${key} path:${meta.nodePath}`,
					);
				}
				if (value.playedBy.length === 0) {
					throw new Error(
						`Unsupported: roleFields should be played at least by one thing. Role: ${key}, path:${meta.nodePath}`,
					);
				}
			}

			// if default or computed, add to computed fields list
			if (meta.depth === 4 && (value.default || value.computedValue)) {
				const [type, thingId] = meta.nodePath?.split('.') || [];
				// todo:
				// @ts-expect-error - TODO description
				draft[type][thingId].computedFields.push(value.path);
			}
		}),
	) as EnrichedBormSchema;

	// console.log('enrichedShema', JSON.stringify(enrichedSchema, null, 3));
	return enrichedSchema;
};

export const getCurrentSchema = (
	schema: BormSchema | EnrichedBormSchema,
	node: Partial<BQLMutationBlock>,
): EnrichedBormEntity | EnrichedBormRelation => {
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
	throw new Error(`Wrong schema or query for ${JSON.stringify(node)}`);
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
		'$parentKey',
		'$filter',
		'$fields',
		'$excludedFields',
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
		? (node.$fields.map((x: string | { $path: string }) => {
				if (typeof x === 'string') {
					return x;
				}
				if ('$path' in x && typeof x.$path === 'string') {
					return x.$path;
				}
				throw new Error(' Wrongly structured query');
		  }) as string[])
		: listify<any, string, string>(node, (k: string) => k);

	const localFilterFields = !node.$filter
		? []
		: listify(node.$filter, (k: string) => (k.toString().startsWith('$') ? undefined : k.toString())).filter(
				(x) => x && availableDataFields?.includes(x),
		  );
	const nestedFilterFields = !node.$filter
		? []
		: listify(node.$filter, (k: string) => (k.toString().startsWith('$') ? undefined : k.toString())).filter(
				(x) => x && [...(availableRoleFields || []), ...(availableLinkFields || [])]?.includes(x),
		  );

	const unidentifiedFields = [...usedFields, ...localFilterFields]
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
		unidentifiedFields,
		...(localFilterFields.length ? { localFilters } : {}),
		...(nestedFilterFields.length ? { nestedFilters } : {}),
	} as ReturnTypeWithNode;
};

// todo: move this function to typeDBhelpers
export const getLocalFilters = (
	currentSchema: EnrichedBormEntity | EnrichedBormRelation,
	// todo: node?: BQLMutationBlock | ParsedBQLQuery
	node: ParsedBQLQuery,
) => {
	const localFilters =
		node.$localFilters &&
		listify(node.$localFilters, (k: string, v) => {
			const currentDataField = currentSchema.dataFields?.find((x) => x.path === k);
			return `has ${currentDataField?.dbPath} '${v}'`;
		});
	const localFiltersTql = localFilters?.length ? `, ${localFilters.join(',')}` : '';
	return localFiltersTql;
};

export const arrayAt = <T>(arr: T[] | undefined, index: number): T | undefined => {
	if (arr === undefined || !Array.isArray(arr) || index < -arr.length || index >= arr.length) {
		return undefined;
	}
	return arr[index < 0 ? arr.length + index : index];
};

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
