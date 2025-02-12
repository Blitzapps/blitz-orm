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
	EnrichedDataField,
	EnrichedLinkField,
	EnrichedRoleField,
	LinkField,
	RefField,
	EnrichedRefField,
	LinkedFieldWithThing,
	AllDbHandles,
	SharedEnrichedProps,
	RoleField,
} from './types';
import { adapterContext } from './adapters';

export const enrichSchema = (schema: BormSchema, dbHandles: DBHandles) => {
	const orderedEntities = orderExtended(schema.entities);
	const orderedRelations = orderExtended(schema.relations);
	const allLinkFields = getAllLinkFields(schema);
	const enrichedSchema: EnrichedBormSchema = { entities: {}, relations: {} };

	orderedEntities.forEach((name) => {
		const thing = schema.entities[name];
		if (!thing) {
			throw new Error(`Entity "${name}" does not exist`);
		}
		const extendedThing = 'extends' in thing ? enrichedSchema.entities[thing.extends] : undefined;
		if (extendedThing) {
			addSubType(enrichedSchema, extendedThing.name, name);
		}
		const enrichedThing = enrichThing({ schema, enrichedSchema, extendedThing, name, thing, dbHandles, allLinkFields });
		enrichedSchema.entities[name] = {
			...enrichedThing,
			defaultDBConnector: thing.defaultDBConnector,
			thingType: 'entity',
		};
	});

	orderedRelations.forEach((name) => {
		const thing = schema.relations[name];
		if (!thing) {
			throw new Error(`Relation "${name}" does not exist`);
		}
		const extendedThing = 'extends' in thing ? enrichedSchema.relations[thing.extends] : undefined;
		if (extendedThing) {
			addSubType(enrichedSchema, extendedThing.name, name);
		}
		const enrichedThing = enrichThing({ schema, enrichedSchema, extendedThing, name, thing, dbHandles, allLinkFields });
		const enrichedRelation: EnrichedBormRelation = {
			...enrichedThing,
			defaultDBConnector: thing.defaultDBConnector,
			roles: Object.fromEntries(
				Object.entries(thing.roles ?? {}).map(([k, role]) => [
					k,
					enrichRoleField({
						role,
						roleName: k,
						relationName: name,
						relation: thing,
						allExtends: enrichedThing.allExtends,
						allLinkFields,
					}),
				]),
			),
			thingType: 'relation',
		};
		if ('extends' in thing && extendedThing) {
			Object.entries(extendedThing?.roles ?? {}).forEach(([k, role]) => {
				const inherited = enrichRoleField({
					role,
					roleName: k,
					relationName: name,
					relation: thing,
					allExtends: enrichedThing.allExtends,
					allLinkFields,
				});
				enrichedRelation.roles[k] = {
					...inherited,
					inherited: true,
					[SharedMetadata]: {
						...role[SharedMetadata],
						inheritanceOrigin: role[SharedMetadata]?.inheritanceOrigin || thing.extends,
					},
				};
			});
		}
		enrichedSchema.relations[name] = enrichedRelation;
	});

	Object.values(enrichedSchema.entities).forEach((entity) => {
		entity.linkFields?.forEach((lf) => {
			lf.$things = expandSubThings(enrichedSchema, lf.$things);
		});
	});

	Object.values(enrichedSchema.relations).forEach((relation) => {
		relation.linkFields?.forEach((lf) => {
			lf.$things = expandSubThings(enrichedSchema, lf.$things);
		});
		Object.values(relation.roles ?? {}).forEach((role) => {
			role.$things = expandSubThings(enrichedSchema, role.$things);
		});
	});

	return enrichedSchema;
};

const expandSubThings = (enrichedSchema: EnrichedBormSchema, things: string[]) => {
	return things.flatMap((i) => [i, ...((enrichedSchema.entities[i] ?? enrichedSchema.relations[i])?.subTypes ?? [])]);
};

const orderExtended = (thingMap: Record<string, BormEntity | BormRelation>) => {
	const ordered: string[] = [];
	const seen = new Set<string>();
	const inProcess = new Set<string>();
	Object.keys(thingMap).forEach((name) => pushExtended({ thingMap, name, inProcess, seen, ordered }));
	return ordered;
};

/**
 * Mutate `ordered` and `seen`.
 */
const pushExtended = (params: {
	thingMap: Record<string, BormEntity | BormRelation>;
	name: string;
	inProcess: Set<string>;
	seen: Set<string>;
	ordered: string[];
}) => {
	const { thingMap, name, inProcess, seen, ordered } = params;
	if (seen.has(name)) {
		return;
	}
	if (inProcess.has(name)) {
		throw new Error(`A list of thing extends each other that creates circular dependencies: ${[...inProcess]}`);
	}
	inProcess.add(name);
	const entity = thingMap[name];
	if (!entity) {
		throw new Error(`Entity/relation "${name}" does not exist`);
	}
	if ('extends' in entity) {
		pushExtended({ ...params, name: entity.extends });
	}
	inProcess.delete(name);
	seen.add(name);
	ordered.push(name);
};

const getAllExtended = (schema: EnrichedBormSchema, extended: string) => {
	let name: string | undefined = extended;
	const _extended: string[] = [];
	while (name) {
		const thing: EnrichedBormEntity | EnrichedBormRelation | undefined =
			schema.entities[name] || schema.relations[name];
		if (!thing) {
			throw new Error(`Entity/relation "${name}" does not exist`);
		}
		_extended.push(name);
		name = 'extends' in thing ? thing.extends : undefined;
	}
	return _extended.length !== 0 ? _extended : undefined;
};

/**
 * Mutate `enrichedSchema`.
 */
const addSubType = (enrichedSchema: EnrichedBormSchema, thing: string, subThing: string) => {
	const _thing = enrichedSchema.entities[thing] ?? enrichedSchema.relations[thing];
	if (!_thing) {
		throw new Error(`Entity/relation "${thing}" does not exist`);
	}
	_thing.subTypes = _thing.subTypes ?? [];
	_thing.subTypes.push(subThing);
	if (_thing.extends) {
		addSubType(enrichedSchema, _thing.extends, subThing);
	}
};

const enrichThing = <T extends BormEntity | BormRelation>(params: {
	schema: BormSchema;
	enrichedSchema: EnrichedBormSchema;
	name: string;
	thing: T;
	extendedThing?: T extends BormRelation ? EnrichedBormRelation : EnrichedBormEntity;
	dbHandles: DBHandles;
	allLinkFields: LinkedFieldWithThing[];
}): SharedEnrichedProps => {
	const { schema, enrichedSchema, name, thing, dbHandles, extendedThing, allLinkFields } = params;
	const [db] =
		(Object.entries(dbHandles).find(([_, handle]) =>
			handle.get(thing.defaultDBConnector.id),
		) as (keyof AllDbHandles)[]) ?? [];

	if (!db) {
		throw new Error(`DB handle for ${thing.defaultDBConnector.id} does not exist`);
	}

	const hooks = { ...thing.hooks };
	const idFields = [...(thing.idFields ?? extendedThing?.idFields ?? [])]; // TODO: Where to get the idFields if it's not defined?
	const dataFields = thing.dataFields?.map((df) => enrichDataField(df, name, idFields)) ?? [];
	const linkFields =
		thing.linkFields?.map((linkField) =>
			enrichLinkField({ linkField, thingName: name, thing, schema, allLinkFields }),
		) ?? [];
	const refFields = Object.fromEntries(
		Object.entries(thing.refFields ?? {}).map(([k, v]) => [k, enrichRefField(v, k)]),
	);

	if ('extends' in thing && extendedThing) {
		if (extendedThing.hooks?.pre) {
			hooks.pre = [...(extendedThing.hooks.pre || []), ...(thing.hooks?.pre || [])];
		}

		extendedThing.dataFields?.forEach((df) => {
			dataFields.push({
				...df,
				inherited: true,
				[SharedMetadata]: {
					...df[SharedMetadata],
					inheritanceOrigin: df[SharedMetadata]?.inheritanceOrigin || thing.extends,
				},
			});
		});

		extendedThing.linkFields?.forEach((lf) => {
			linkFields.push({
				...lf,
				inherited: true,
				[SharedMetadata]: {
					...lf[SharedMetadata],
					inheritanceOrigin: lf[SharedMetadata]?.inheritanceOrigin || thing.extends,
				},
			});
		});

		Object.entries(extendedThing.refFields ?? {}).forEach(([k, v]) => {
			refFields[k] = {
				...v,
				inherited: true,
				[SharedMetadata]: {
					...v[SharedMetadata],
					inheritanceOrigin: v[SharedMetadata]?.inheritanceOrigin || thing.extends,
				},
			};
		});
	}

	return {
		...thing,
		name,
		db,
		dbContext: adapterContext[db],
		idFields,
		hooks,
		dataFields,
		linkFields,
		refFields,
		enumFields: dataFields?.filter((df) => df.validations?.enum).map((df) => df.path) ?? [],
		fnValidatedFields: dataFields?.filter((df) => df.validations?.fn).map((df) => df.path) ?? [],
		virtualFields: dataFields?.filter((df) => df.isVirtual).map((df) => df.path) ?? [],
		computedFields: dataFields?.filter((df) => df.default && !df.isVirtual).map((df) => df.path) ?? [],
		requiredFields: dataFields?.filter((df) => df.validations?.required).map((df) => df.path) ?? [],
		allExtends: 'extends' in thing ? getAllExtended(enrichedSchema, thing.extends) : undefined,
		// @ts-expect-error TODO: Define it in the type
		dbProviderConfig: db === 'surrealDB' ? dbHandles[db]?.get(thing.defaultDBConnector.id)?.providerConfig : undefined,
	};
};

const getAllLinkFields = (schema: BormSchema): LinkedFieldWithThing[] => {
	const linkFields: LinkedFieldWithThing[] = [];
	Object.entries(schema.entities).forEach(([name, entity]) => {
		entity.linkFields?.forEach((lf) => {
			linkFields.push({
				...lf,
				thing: name,
				thingType: 'entity',
				pathToRelation: lf.target === 'relation' ? lf.path : lf.relation.toLocaleLowerCase(),
			});
		});
	});
	Object.entries(schema.relations).forEach(([name, entity]) => {
		entity.linkFields?.forEach((lf) => {
			linkFields.push({
				...lf,
				thing: name,
				thingType: 'relation',
				pathToRelation: lf.target === 'relation' ? lf.path : lf.relation.toLocaleLowerCase(),
			});
		});
	});
	return linkFields;
};

const enrichDataField = (df: DataField, thing: string, idFields: string[]): EnrichedDataField => ({
	...df,
	cardinality: df.cardinality || 'ONE',
	dbPath: 'dbPath' in df && typeof df.dbPath === 'string' ? df.dbPath : getDbPath(thing, df.path, df.shared),
	isIdField: !!idFields?.includes(df.path),
	inherited: false,
	[SharedMetadata]: {
		fieldType: 'dataField',
	},
	[SuqlMetadata]: {
		dbPath: df.path, // TODO
	},
});

const enrichRefField = (refField: RefField, path: string): EnrichedRefField => ({
	...refField,
	cardinality: refField.cardinality || 'ONE',
	path,
	dbPath: refField.dbPath || path,
	inherited: false,
	[SharedMetadata]: {
		fieldType: 'refField',
	},
});

const enrichLinkField = (params: {
	linkField: LinkField;
	thing: BormEntity | BormRelation;
	thingName: string;
	schema: BormSchema;
	allLinkFields: LinkedFieldWithThing[];
}): EnrichedLinkField => {
	const { linkField, thing, thingName, schema, allLinkFields } = params;
	const linkFieldRelation = schema.relations[linkField.relation] as EnrichedBormRelation;
	const todo = 'todo';

	if (!linkField.isVirtual) {
		//its ok for virtual linkFields to don't have a relation
		if (!linkFieldRelation) {
			throw new Error(`The relation ${linkField.relation} does not exist in the schema`);
		}

		if (!hasRole(schema, linkField.relation, linkField.plays)) {
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
				`[Schema] Virtual linkFields can't target a relation. Thing: "${thingName}" LinkField: "${linkField.path}. Path:${todo}."`,
			);
		}

		return {
			...linkField,
			$things: [linkField.relation],
			// $things: [linkField.relation, ...(linkFieldRelation.subTypes || [])],
			oppositeLinkFieldsPlayedBy: [
				{
					plays: linkField.path,
					thing: linkField.relation,
					thingType: 'relation',
				},
			],
			fieldType: 'linkField',
			inherited: false,
			[SharedMetadata]: {
				fieldType: 'linkField',
			},
			[SuqlMetadata]: {
				queryPath,
			},
		};
	}

	///target role

	const oppositeLinkFieldsPlayedBy = allLinkFields.filter(
		(x) => x.relation === linkField.relation && x.plays !== linkField.plays && x.target === 'role',
	);

	if (oppositeLinkFieldsPlayedBy.length === 0) {
		throw new Error(
			`[Schema] LinkFields require to have at least one opposite linkField playing an opposite role. Thing: "${thingName}" LinkField: "${linkField.path}. Path:${todo}."`,
		);
	}

	if (oppositeLinkFieldsPlayedBy.length > 1) {
		//temp: lets just warn and add an error only if actually used
		console.warn(
			`[Schema] LinkField ${linkField.path} in ${thingName} has multiple candidates ${oppositeLinkFieldsPlayedBy.map((lf) => lf.thing).join(',')} and this is not yet supported. Please target a single one using targetRoles with a single role`,
		);
	}

	return {
		...linkField,
		fieldType: 'linkField',
		pathToRelation:
			thing.linkFields?.find((lf) => lf.target === 'relation' && lf.relation === linkField.relation)?.path ??
			linkField.relation.toLocaleLowerCase(),
		inherited: false,
		$things: oppositeLinkFieldsPlayedBy.map((i) => i.thing),
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
};

const enrichRoleField = (params: {
	role: RoleField;
	roleName: string;
	relationName: string;
	relation: BormRelation;
	allExtends?: string[];
	allLinkFields: LinkedFieldWithThing[];
}): EnrichedRoleField => {
	const { role, roleName, relationName, relation, allExtends, allLinkFields } = params;
	const todo = 'todo';

	//Check if the key is used by linkFields or roleFields already
	if (
		relation.dataFields?.find((df) => df.path === roleName) ||
		relation.linkFields?.find((lf) => lf.path === roleName)
	) {
		throw new Error(
			`[Schema] The path ${roleName} is already in use by a dataField or linkField in ${relationName}. Path:${todo}`,
		);
	}
	const playedBy = allLinkFields.filter((x) => x.relation === relationName && x.plays === roleName);

	const impactedLinkFields = allLinkFields.filter(
		(x) => x.target === 'relation' && x.plays === roleName && allExtends?.includes(x.relation),
	);

	return {
		...role,
		fieldType: 'roleField',
		inherited: false,
		playedBy: playedBy.map((lf) => ({
			...lf,
			pathToRelation:
				lf.target === 'relation'
					? lf.path
					: (relation.linkFields?.find(
							(lf) => lf.target === 'relation' && lf.relation === roleName && lf.plays === roleName,
						)?.path ?? lf.relation.toLocaleLowerCase()),
		})),
		impactedLinkFields,
		path: roleName,
		$things: [...new Set(playedBy.map((i) => i.thing))],
		[SharedMetadata]: {
			fieldType: 'roleField',
		},
		[SuqlMetadata]: {
			queryPath: role.cardinality === 'MANY' ? `$parent.[\`${roleName}\`]` : `$parent.\`${roleName}\``,
		},
	};
};

const getDbPath = (thing: string, attribute: string, shared?: boolean) =>
	shared ? attribute : `${thing}·${attribute}`;

const hasRole = (schema: BormSchema, thing: string, role: string) => {
	const _thing = schema.relations[thing];
	if (!_thing) {
		throw new Error(`Relation "${thing}" does not exist`);
	}
	if (_thing.roles?.[role]) {
		return true;
	}
	if ('extends' in _thing) {
		return hasRole(schema, _thing.extends, role);
	}
	return false;
};
