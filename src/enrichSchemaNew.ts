/* eslint-disable no-param-reassign */

import { SharedMetadata, SuqlMetadata } from './types/symbols';
import type {
	BormSchema,
	BormRelation,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	DataField,
	BormEntity,
	DBHandles,
	DBHandleKey,
	EnrichedDataField,
	EnrichedLinkField,
	EnrichedRoleField,
	LinkField,
	RefField,
	EnrichedRefField,
	LinkedFieldWithThing,
} from './types';
import { mapEntries } from 'radash';
import { adapterContext } from './adapters';
import { getSchemaByThing } from './helpers';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';

export const extendSchemaNew = (schema: BormSchema): BormSchema => {
	const extendedSchema = { ...schema };

	// Helper function to process inheritance for a single thing
	const processThing = (key: string, thing: BormEntity | BormRelation) => {
		if (!('extends' in thing) || !thing.extends) {
			return thing;
		}

		// Validate 'as' property
		if (!thing.defaultDBConnector.as) {
			throw new Error(`[Schema] ${key} is extending a thing but missing the "as" property in its defaultDBConnector.`);
		}

		// Get the extended schema
		const extendedThing = (extendedSchema.entities[thing.extends] || extendedSchema.relations[thing.extends]) as
			| EnrichedBormRelation
			| EnrichedBormEntity;

		if (!extendedThing) {
			throw new Error(`[Schema] ${key} is extending a thing that does not exist in the schema: ${thing.extends}`);
		}

		// Calculate all extends
		const allExtends = [thing.extends, ...(extendedThing.allExtends || [])];

		// Update subtypes
		allExtends.forEach((ext) => {
			if (extendedSchema.entities[ext]) {
				extendedSchema.entities[ext].subTypes = [key, ...(extendedSchema.entities[ext].subTypes || [])];
			} else if (extendedSchema.relations[ext]) {
				extendedSchema.relations[ext].subTypes = [key, ...(extendedSchema.relations[ext].subTypes || [])];
			}
		});

		// Merge data fields
		const mergedDataFields = [...(thing.dataFields || [])];
		if (extendedThing.dataFields) {
			const inheritedDataFields = extendedThing.dataFields.map((df: DataField) => {
				// Find the original thing that defined this data field
				let deepExtendedThing = thing.extends;
				let deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
				while (!deepSchema.dataFields?.find((deepDf: DataField) => deepDf.path === df.path)) {
					deepExtendedThing = 'extends' in deepSchema ? deepSchema.extends : undefined;
					deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
				}

				return {
					...df,
					inherited: true,
					dbPath: 'dbPath' in df ? df.dbPath : getDbPath(deepExtendedThing, df.path, df.shared),
					[SharedMetadata]: {
						...df[SharedMetadata],
						inheritanceOrigin: df[SharedMetadata]?.inheritanceOrigin || thing.extends,
					},
				};
			});
			mergedDataFields.push(...inheritedDataFields);
		}

		// Merge roles (for relations)
		let mergedRoles = { ...(thing.roles || {}) };
		if ('roles' in extendedThing && extendedThing.roles) {
			const inheritedRoles = Object.entries(extendedThing.roles).reduce(
				(acc, [roleKey, role]) => ({
					...acc,
					[roleKey]: {
						...role,
						inherited: true,
						[SharedMetadata]: {
							...role[SharedMetadata],
							inheritanceOrigin: role[SharedMetadata]?.inheritanceOrigin || thing.extends,
						},
					},
				}),
				{},
			);
			mergedRoles = { ...mergedRoles, ...inheritedRoles };
		}

		// Merge ref fields
		let mergedRefFields = { ...(thing.refFields || {}) };
		if ('refFields' in extendedThing && extendedThing.refFields) {
			const inheritedRefFields = Object.entries(extendedThing.refFields).reduce(
				(acc, [refFieldKey, refField]) => ({
					...acc,
					[refFieldKey]: {
						...refField,
						inherited: true,
						[SharedMetadata]: {
							...refField[SharedMetadata],
							inheritanceOrigin: refField[SharedMetadata]?.inheritanceOrigin || thing.extends,
						},
					},
				}),
				{},
			);
			mergedRefFields = { ...mergedRefFields, ...inheritedRefFields };
		}

		// Merge link fields
		const mergedLinkFields = [...(thing.linkFields || [])];
		if (extendedThing.linkFields) {
			const inheritedLinkFields = extendedThing.linkFields.map((lf) => ({
				...lf,
				inherited: true,
				[SharedMetadata]: {
					...lf[SharedMetadata],
					inheritanceOrigin: lf[SharedMetadata]?.inheritanceOrigin || thing.extends,
				},
			}));
			mergedLinkFields.push(...inheritedLinkFields);
		}

		// Merge hooks
		let mergedHooks = { ...thing.hooks };
		if (extendedThing.hooks?.pre) {
			mergedHooks = {
				...mergedHooks,
				pre: [...(extendedThing.hooks.pre || []), ...(thing.hooks?.pre || [])],
			};
		}

		return {
			...thing,
			key: key,
			allExtends,
			dataFields: mergedDataFields,
			roles: mergedRoles,
			refFields: mergedRefFields,
			linkFields: mergedLinkFields,
			hooks: mergedHooks,
			idFields: extendedSchema.idFields
				? Array.from(new Set((thing.idFields || []).concat(extendedSchema.idFields)))
				: thing.idFields,
		};
	};

	// Process all entities
	Object.entries(extendedSchema.entities).forEach(([key, entity]) => {
		extendedSchema.entities[key] = processThing(key, entity) as BormEntity;
	});

	// Process all relations
	Object.entries(extendedSchema.relations).forEach(([key, relation]) => {
		extendedSchema.relations[key] = processThing(key, relation) as BormRelation;
	});

	return extendedSchema;
};

const getDbPath = (thing: string, attribute: string, shared?: boolean) =>
	shared ? attribute : `${thing}·${attribute}`;

const enrichDataField = (
	df: DataField | EnrichedDataField,
	thing: string,
	thingSchema: BormEntity | BormRelation,
): EnrichedDataField => ({
	...df,
	cardinality: df.cardinality || 'ONE',
	dbPath: 'dbPath' in df ? df.dbPath : getDbPath(thing, df.path, df.shared),
	isIdField: !!thingSchema.idFields?.includes(df.path),
	[SharedMetadata]: {
		fieldType: 'dataField',
	},
});

const enrichRefField = (refField: RefField, path: string): EnrichedRefField => ({
	...refField,
	cardinality: refField.cardinality || 'ONE',
	dbPath: refField.dbPath || path,
	path, //todo: fix this
	[SharedMetadata]: {
		fieldType: 'refField',
	},
});

const enrichLinkField = (
	linkField: LinkField,
	thingSchema: BormEntity | BormRelation,
	schema: BormSchema,
	allLinkedFields: LinkedFieldWithThing[],
): EnrichedLinkField => {
	const linkFieldRelation = schema.relations[linkField.relation] as EnrichedBormRelation;

	const todo = 'todo';

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

	const queryPath =
		linkField.cardinality === 'MANY' ? `$parent.[\`${linkField.path}\`]` : `$parent.\`${linkField.path}\``;

	if (linkField.target === 'relation') {
		if (linkField.isVirtual) {
			throw new Error(
				`[Schema] Virtual linkFields can't target a relation. Thing: "${thingSchema.name}" LinkField: "${linkField.path}. Path:${todo}."`,
			);
		}

		return {
			...linkField,
			$things: [linkField.relation, ...(linkFieldRelation.subTypes || [])],
			oppositeLinkFieldsPlayedBy: [
				{
					plays: linkField.path,
					thing: linkField.relation,
					thingType: 'relation',
				},
			],
			[SharedMetadata]: {
				fieldType: 'linkField',
			},
			[SuqlMetadata]: {
				queryPath,
			},
		};
	}
	if (linkField.target === 'role') {
		///target role
		const oppositeLinkFieldsPlayedBy = allLinkedFields.filter(
			(x) => x.relation === linkField.relation && x.plays !== linkField.plays && x.target === 'role',
		);

		if (oppositeLinkFieldsPlayedBy.length === 0) {
			throw new Error(
				`[Schema] LinkFields require to have at least one opposite linkField playing an opposite role. Thing: "${thingSchema.name}" LinkField: "${linkField.path}. Path:${todo}."`,
			);
		}

		if (oppositeLinkFieldsPlayedBy.length > 1) {
			//temp: lets just warn and add an error only if actually used
			console.warn(
				`[Schema] LinkField ${linkField.path} in ${thingSchema.name} has multiple candidates ${oppositeLinkFieldsPlayedBy.map((lf) => lf.thing).join(',')} and this is not yet supported. Please target a single one using targetRoles with a single role`,
			);
		}

		const queryPath =
			linkField.cardinality === 'MANY' ? `$parent.[\`${linkField.path}\`]` : `$parent.\`${linkField.path}\``;

		return {
			...linkField,
			pathToRelation:
				thingSchema.linkFields?.find((lf) => lf.target === 'relation' && lf.relation === linkField.relation)?.path ??
				linkField.relation.toLocaleLowerCase(),
			$things: [
				...new Set(
					oppositeLinkFieldsPlayedBy.flatMap((x) => [x.thing, ...(getSchemaByThing(schema, x.thing)?.subTypes || [])]),
				),
			],
			oppositeLinkFieldsPlayedBy,
			[SharedMetadata]: {
				fieldType: 'linkField',
			},
			[SuqlMetadata]: {
				queryPath,
			},
		};

		// #region FILTERING OPPOSITE LINKFIELDS
		// const { targetRoles, filter } = linkField;
		// Example targetRoles: ['color', 'users']
		//Can be combined with filter, for instance to automatically filter by $thing

		//If after the filters, we still have 2, then the schema is wrong

		// #endregion
	}
};

const enrichRoleField = (
	roleKey: string,
	relationKey: string,
	relationSchema: BormRelation,
	schema: BormSchema,
	allLinkedFields: LinkedFieldWithThing[],
): EnrichedRoleField => {
	const todo = 'todo';

	const roleSchema = relationSchema.roles?.[roleKey];
	//Check if the key is used by linkFields or roleFields already
	if (
		relationSchema.dataFields?.find((df) => df.path === roleKey) ||
		relationSchema.linkFields?.find((lf) => lf.path === roleKey)
	) {
		throw new Error(
			`[Schema] The path ${roleKey} is already in use by a dataField or linkField in ${relationSchema.name}. Path:${todo}`,
		);
	}
	console.log('relationSchema!', relationSchema);
	const playedBy = allLinkedFields.filter((x) => x.relation === relationKey && x.plays === roleKey) || [];

	const impactedLinkFields = allLinkedFields.filter(
		(x) => x.target === 'relation' && x.plays === roleKey && relationSchema.allExtends?.includes(x.relation),
	);

	return {
		...roleSchema,
		playedBy: playedBy.map((lf) => ({
			...lf,
			pathToRelation:
				lf.target === 'relation'
					? lf.path
					: (relationSchema.linkFields?.find(
							(lf) => lf.target === 'relation' && lf.relation === roleKey && lf.plays === roleKey,
						)?.path ?? lf.relation.toLocaleLowerCase()),
		})),
		impactedLinkFields,
		path: roleKey,
		$things: [
			...new Set(
				playedBy
					.flatMap((x) => {
						const playerSchema = getSchemaByThing(schema, x.thing);
						return [...(playerSchema.subTypes || []), x.thing];
					})
					.flat()
					.filter(Boolean),
			),
		],
		[SharedMetadata]: {
			fieldType: 'roleField',
		},
		[SuqlMetadata]: {
			queryPath: roleSchema.cardinality === 'MANY' ? `$parent.[\`${roleKey}\`]` : `$parent.\`${roleKey}\``,
		},
	};
};

export const enrichSchema = (schema: BormSchema, dbHandles: DBHandles): EnrichedBormSchema => {
	// Process extensions first
	const extendedSchema = extendSchemaNew(schema);

	const allLinkedFields: LinkedFieldWithThing[] = []; //todo: immutably
	// #region 1)

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
				: value.map((x) => ({
						...x,
						...thingTypes,
					}));

			allLinkedFields.push(...withThing);
		}
	});

	const enrichThing = (key: string, thingSchema: BormEntity | BormRelation) => {
		const thingDB = Object.keys(dbHandles).find((dbKey) =>
			dbHandles[dbKey]?.get(thingSchema.defaultDBConnector.id),
		) as DBHandleKey;

		return {
			...thingSchema,
			name: key,
			thingType: 'roles' in thingSchema ? 'relation' : 'entity',
			db: thingDB,
			dbProviderConfig:
				thingDB === 'surrealDB'
					? dbHandles[thingDB]?.get(thingSchema.defaultDBConnector.id)?.providerConfig
					: undefined,
			dbContext: adapterContext[thingDB],
			dataFields: thingSchema.dataFields?.map((df) => enrichDataField(df, key, thingSchema)),
			linkFields: thingSchema.linkFields?.map((lf) => enrichLinkField(lf, thingSchema, schema, allLinkedFields)),
			...('roles' in thingSchema && thingSchema.roles
				? {
						roles: mapEntries(thingSchema.roles, (k, v) => [
							k,
							enrichRoleField(k, key, thingSchema, schema, allLinkedFields),
						]),
					}
				: {}),
			...('refFields' in thingSchema && thingSchema.refFields
				? { refFields: mapEntries(thingSchema.refFields, (k, v) => [k, enrichRefField(v, k)]) }
				: {}),
			enumFields: thingSchema.dataFields?.filter((df) => df.validations?.enum).map((df) => df.path),
			fnValidatedFields: thingSchema.dataFields?.filter((df) => df.validations?.fn).map((df) => df.path),
			virtualFields: thingSchema.dataFields?.filter((df) => df.isVirtual).map((df) => df.path),
			computedFields: thingSchema.dataFields?.filter((df) => df.default && !df.isVirtual).map((df) => df.path),
			requiredFields: thingSchema.dataFields?.filter((df) => df.validations?.required).map((df) => df.path),
		};
	};

	const entities = mapEntries(extendedSchema.entities, (k, v) => [k, enrichThing(k, v)]);
	const relations = mapEntries(extendedSchema.relations, (k, v) => [k, enrichThing(k, v)]);

	return {
		entities,
		relations,
	};
};
