import { adapterContext } from './adapters';
import type {
  AllDbHandles,
  BormEntity,
  BormRelation,
  BormSchema,
  DataField,
  DBHandles,
  EnrichedBormEntity,
  EnrichedBormRelation,
  EnrichedBormSchema,
  EnrichedDataField,
  EnrichedLinkField,
  EnrichedRefField,
  EnrichedRoleField,
  LinkedFieldWithThing,
  LinkField,
  RefField,
  RoleField,
  SharedEnrichedProps,
} from './types';
import { SharedMetadata, SuqlMetadata } from './types/symbols';

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
      // eslint-disable-next-line no-param-reassign
      lf.$things = expandSubThings(enrichedSchema, lf.$things);
    });
  });

  Object.values(enrichedSchema.relations).forEach((relation) => {
    relation.linkFields?.forEach((lf) => {
      // eslint-disable-next-line no-param-reassign
      lf.$things = expandSubThings(enrichedSchema, lf.$things);
    });
    Object.values(relation.roles ?? {}).forEach((role) => {
      // eslint-disable-next-line no-param-reassign
      role.$things = expandSubThings(enrichedSchema, role.$things);
    });
  });

  return enrichedSchema;
};

const orderExtended = (thingMap: Record<string, BormEntity | BormRelation>) => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const inProcess = new Set<string>();
  for (const name of Object.keys(thingMap)) {
    pushExtended({ thingMap, name, inProcess, seen, ordered });
  }
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

  const idFields = [...(thing.idFields ?? extendedThing?.idFields ?? [])]; // TODO: Where to get the idFields if it's not defined?
  if (idFields.length === 0) {
    throw new Error(`"${name}" does not have an id field`);
  }

  const hooks = { ...thing.hooks };
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
    dbPath: df.path, // TODO: What should be the value?
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

  const queryPath =
    linkField.cardinality === 'MANY' ? `$parent.[\`${linkField.path}\`]` : `$parent.\`${linkField.path}\``;

  if (linkField.target === 'relation') {
    if (linkField.isVirtual) {
      throw new Error(
        `[Schema] Virtual linkFields can't target a relation. Thing: "${thingName}" LinkField: "${linkField.path}."`,
      );
    }

    return {
      ...linkField,
      $things: [linkField.relation],
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

  const oppositeLinkFieldsPlayedBy = allLinkFields.filter(
    (x) => x.relation === linkField.relation && x.plays !== linkField.plays && x.target === 'role',
  );

  if (oppositeLinkFieldsPlayedBy.length === 0) {
    throw new Error(
      `[Schema] LinkFields require to have at least one opposite linkField playing an opposite role. Thing: "${thingName}" LinkField: "${linkField.path}."`,
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

  //Check if the key is used by linkFields or roleFields already
  if (
    relation.dataFields?.find((df) => df.path === roleName) ||
    relation.linkFields?.find((lf) => lf.path === roleName)
  ) {
    throw new Error(`[Schema] The path ${roleName} is already in use by a dataField or linkField in ${relationName}.`);
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

const expandSubThings = (enrichedSchema: EnrichedBormSchema, things: string[]) => {
  return things.flatMap((i) => [i, ...((enrichedSchema.entities[i] ?? enrichedSchema.relations[i])?.subTypes ?? [])]);
};

//todo!: review line per line to ensure all behaviour has been migrated. Specially the errors and checks
// /* eslint-disable no-param-reassign */
// import { produce } from 'immer';
// import type { TraversalCallbackContext } from 'object-traversal';
// import { traverse } from 'object-traversal';
// import { isArray, mapEntries } from 'radash';
// import { SharedMetadata, SuqlMetadata } from './types/symbols';

// // todo: split helpers between common helpers, typeDBhelpers, dgraphelpers...
// import type {
// 	BormSchema,
// 	BormRelation,
// 	EnrichedBormEntity,
// 	EnrichedBormRelation,
// 	EnrichedBormSchema,
// 	LinkedFieldWithThing,
// 	DataField,
// 	BormEntity,
// 	DBHandles,
// 	DBHandleKey,
// 	EnrichedDataField,
// 	EnrichedLinkField,
// 	LinkField,
// 	RefField,
// } from './types';
// import type { AdapterContext } from './adapters';
// import { adapterContext } from './adapters';
// import { getSurrealLinkFieldQueryPath } from './adapters/surrealDB/enrichSchema/helpers';
// import { getSchemaByThing } from './helpers';

// const getDbPath = (thing: string, attribute: string, shared?: boolean) =>
// 	shared ? attribute : `${thing}·${attribute}`;

// export const getPath = (dbPath: string) => {
// 	const parts = dbPath.split('·');
// 	return parts[parts.length - 1];
// };

// export const extendSchema = (schema: BormSchema): BormSchema => {
// 	const withExtensionsSchema = produce(schema, (draft) =>
// 		traverse(
// 			draft,
// 			({ key, value, meta }: TraversalCallbackContext) => {
// 				if (meta.depth !== 2) {
// 					return;
// 				}
// 				const val = value as BormEntity | BormRelation;

// 				if (key) {
// 					//* DATA_FIELDS: Adding default values and metadata to every dataField
// 					val.dataFields = val.dataFields?.map((df: DataField | EnrichedDataField) => ({
// 						...df,
// 						...(val.idFields?.includes(df.path) ? { isIdField: true } : { isIdField: false }),
// 						cardinality: df.cardinality || 'ONE',
// 						//todo: Make this user defined and remove the prefix by default
// 						dbPath: 'dbPath' in df ? df.dbPath : getDbPath(key, df.path, df.shared), //if it was already defined in a parent, we keep it
// 						[SharedMetadata]: {
// 							fieldType: 'dataField',
// 						},
// 					})) as EnrichedDataField[];

// 					//* REFERENCE_FIELDS: Adding default values and metadata to every refField
// 					if (val.refFields) {
// 						val.refFields = mapEntries(val.refFields || {}, (refFieldKey, refField) => {
// 							return [
// 								refFieldKey,
// 								{
// 									...refField,
// 									cardinality: refField.cardinality || 'ONE',
// 									path: refFieldKey,
// 									[SharedMetadata]: {
// 										fieldType: 'refField',
// 									},
// 								},
// 							];
// 						});
// 					}

// 					//* LINK_FIELDS: Adding default values and metadata to every linkField
// 					val.linkFields = val.linkFields?.map((lf: LinkField | EnrichedLinkField) => ({
// 						...lf,
// 						[SharedMetadata]: {
// 							fieldType: 'linkField',
// 						},
// 					}));

// 					//* ROLE_FIELDS: Adding default values and metadata to every roleField
// 					if ('roles' in val) {
// 						val.roles = mapEntries(val.roles || {}, (roleKey, role) => {
// 							return [
// 								roleKey,
// 								{
// 									...role,
// 									cardinality: role.cardinality || 'ONE',
// 									[SharedMetadata]: {
// 										fieldType: 'roleField',
// 									},
// 								},
// 							];
// 						});
// 					}
// 				}

// 				if (value.extends) {
// 					if (!value.defaultDBConnector.as) {
// 						//todo: Check if we can add the "as" as default. When the path of the parent === name of the parent then it's fine. As would be used for those cases where they are not equal (same as path, which is needed only if different names)
// 						throw new Error(
// 							`[Schema] ${key} is extending a thing but missing the "as" property in its defaultDBConnector. Path:${meta.nodePath}`,
// 						);
// 					}

// 					/// IMPORT THE EXTENDED SCHEMA
// 					const extendedSchema = (draft.entities[value.extends] || draft.relations[value.extends]) as
// 						| EnrichedBormRelation
// 						| EnrichedBormEntity;

// 					/// find out all the thingTypes this thingType is extending
// 					const allExtends = [value.extends, ...(extendedSchema.allExtends || [])];
// 					value.allExtends = allExtends;
// 					value as BormEntity | BormRelation;

// 					allExtends.forEach((ext) => {
// 						if (draft.entities[ext]) {
// 							//@ts-expect-error : it's normal is just a draft
// 							draft.entities[ext].subTypes = [key, ...(draft.entities[ext].subTypes || [])];
// 						} else if (draft.relations[ext]) {
// 							//@ts-expect-error : it's normal is just a draft
// 							draft.relations[ext].subTypes = [key, ...(draft.relations[ext].subTypes || [])];
// 						} else {
// 							throw new Error(`[Schema] ${key} is extending a thing that does not exist in the schema: ${ext}`);
// 						}
// 					});

// 					value.idFields = extendedSchema.idFields
// 						? Array.from(new Set((value.idFields || []).concat(extendedSchema.idFields)))
// 						: value.idFields;

// 					value.dataFields = extendedSchema.dataFields
// 						? (value.dataFields || []).concat(
// 								extendedSchema.dataFields.map((df: DataField) => {
// 									// * Adding dbPath of extended dataFields
// 									let deepExtendedThing = value.extends;
// 									let deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
// 									while (!deepSchema.dataFields?.find((deepDf: DataField) => deepDf.path === df.path)) {
// 										deepExtendedThing = 'extends' in deepSchema ? deepSchema.extends : undefined;
// 										deepSchema = schema.entities[deepExtendedThing] || schema.relations[deepExtendedThing];
// 									}
// 									return {
// 										...df,
// 										inherited: true,
// 										dbPath: 'dbPath' in df ? df.dbPath : getDbPath(deepExtendedThing, df.path, df.shared), //i
// 										[SharedMetadata]: {
// 											//@ts-expect-error - Is normal because we are extending it here
// 											...df[SharedMetadata],
// 											//@ts-expect-error - Is normal because we are extending it here
// 											inheritanceOrigin: df[SharedMetadata]?.inheritanceOrigin || value.extends,
// 										},
// 									};
// 								}),
// 							)
// 						: value.dataFields;

// 					//Only for roles in th extended schema
// 					if ('roles' in extendedSchema) {
// 						const val = value as BormRelation;
// 						const extendedRelationSchema = extendedSchema as BormRelation;
// 						if (extendedRelationSchema.roles) {
// 							const extendedRelationSchemaWithOrigin = mapEntries(extendedRelationSchema.roles, (roleKey, role) => {
// 								return [
// 									roleKey,
// 									{
// 										...role,
// 										inherited: true,
// 										[SharedMetadata]: {
// 											//@ts-expect-error - Is normal because we are extending it here
// 											...role[SharedMetadata],
// 											//@ts-expect-error - Is normal because we are extending it here
// 											inheritanceOrigin: role[SharedMetadata]?.inheritanceOrigin || value.extends,
// 										},
// 									},
// 								];
// 							});

// 							val.roles = {
// 								...(val.roles || {}),
// 								...extendedRelationSchemaWithOrigin,
// 							};
// 						}
// 					}

// 					if ('refFields' in extendedSchema) {
// 						const val = value as BormRelation | BormEntity;
// 						const extendedThingSchema = extendedSchema as BormRelation | BormEntity;
// 						if (extendedThingSchema.refFields) {
// 							const extendedRefFields = mapEntries(extendedThingSchema.refFields, (refFieldKey, refField) => {
// 								return [
// 									refFieldKey,
// 									{
// 										...refField,
// 										inherited: true,
// 										[SharedMetadata]: {
// 											//@ts-expect-error - Is normal because we are extending it here
// 											...refField[SharedMetadata],
// 											//@ts-expect-error - Is normal because we are extending it here
// 											inheritanceOrigin: refField[SharedMetadata]?.inheritanceOrigin || value.extends,
// 										},
// 									},
// 								];
// 							});

// 							val.refFields = {
// 								...(val.refFields || {}),
// 								...extendedRefFields,
// 							};
// 						}
// 					}

// 					value.linkFields = extendedSchema.linkFields
// 						? (value.linkFields || []).concat(
// 								extendedSchema.linkFields.map((lf) => ({
// 									...lf,
// 									inherited: true,
// 									[SharedMetadata]: {
// 										...lf[SharedMetadata],
// 										inheritanceOrigin: lf[SharedMetadata]?.inheritanceOrigin || value.extends,
// 									},
// 								})),
// 							)
// 						: value.linkFields;

// 					//todo: Do some checks, and potentially simplify the hooks structure
// 					if (extendedSchema?.hooks?.pre) {
// 						value.hooks = value.hooks || {};
// 						value.hooks.pre = value.hooks.pre || [];
// 						value.hooks.pre = [...(extendedSchema?.hooks?.pre || []), ...(value?.hooks?.pre || [])];
// 					}
// 				}
// 			},
// 			{ traversalType: 'breadth-first' },
// 		),
// 	);
// 	return withExtensionsSchema;
// };

// export const enrichSchema = (schema: BormSchema, dbHandles: DBHandles): EnrichedBormSchema => {
// 	const allLinkedFields: LinkedFieldWithThing[] = [];
// 	// #region 1)

// 	// #endregion

// 	// * Gather linkFields
// 	traverse(schema, ({ key, value, meta }: TraversalCallbackContext) => {
// 		if (key === 'linkFields') {
// 			const getThingTypes = () => {
// 				if (!meta.nodePath) {
// 					throw new Error('No path');
// 				}
// 				const [thingPath, thing] = meta.nodePath.split('.');
// 				const thingType = thingPath === 'entities' ? 'entity' : thingPath === 'relations' ? 'relation' : '';
// 				return {
// 					thing,
// 					thingType,
// 				};
// 			};
// 			const thingTypes = getThingTypes();
// 			const withThing = !Array.isArray(value)
// 				? [
// 						{
// 							...value,
// 							...thingTypes,
// 						},
// 					]
// 				: value.map((x) => ({
// 						...x,
// 						...thingTypes,
// 					}));

// 			allLinkedFields.push(...withThing);
// 		}
// 	});

// 	const withExtensionsSchema = extendSchema(schema);

// 	// * Enrich the schema
// 	const enrichedSchema = produce(withExtensionsSchema, (draft: Partial<EnrichedBormSchema>) =>
// 		traverse(draft, ({ value, key, meta }: TraversalCallbackContext) => {
// 			// id things
// 			if (meta.depth === 2 && value.idFields && !value.id) {
// 				// depth 2 are entities and relations
// 				// eslint-disable-next-line prefer-destructuring
// 				value.name = key;
// 				const thingType = () => {
// 					if (meta.nodePath?.split('.')[0] === 'entities') {
// 						return 'entity';
// 					}
// 					if (meta.nodePath?.split('.')[0] === 'relations') {
// 						return 'relation';
// 					}
// 					throw new Error('Unsupported node attributes');
// 				};
// 				value.thingType = thingType();
// 				/// We identify the database assigned to this thing
// 				//@ts-expect-error - TODO
// 				const thingDB: DBHandleKey = Object.keys(dbHandles).find((key) =>
// 					// @ts-expect-error - TODO
// 					dbHandles[key]?.get(value.defaultDBConnector.id),
// 				);
// 				value.db = thingDB as DBHandleKey; //todo
// 				value.dbContext = adapterContext[thingDB] as AdapterContext; //todo

// 				value.dbProviderConfig =
// 					thingDB === 'surrealDB' ? dbHandles[thingDB]?.get(value.defaultDBConnector.id)?.providerConfig : undefined;

// 				// init the arrays
// 				value.computedFields = [];
// 				value.virtualFields = [];
// 				value.requiredFields = [];
// 				value.enumFields = [];
// 				value.fnValidatedFields = [];

// 				//todo: Maybe move all this to the pre-step and enrich all the linkFields there and same with the roles so then we can usse allLinkFields and allRoles as enriched ones.
// 				if ('linkFields' in value && value.linkFields) {
// 					const val = value as EnrichedBormRelation;

// 					val.linkFields?.forEach((linkField) => {
// 						///Check if the path is already in use
// 						if (
// 							val.dataFields?.find((df) => df.path === linkField.path) ||
// 							Object.keys(val.roles || {}).includes(linkField.path)
// 						) {
// 							throw new Error(
// 								`[Schema] The path ${linkField.path} is already in use by a dataField or linkField in ${val.name}. Path:${meta.nodePath}`,
// 							);
// 						}
// 						const linkFieldRelation = withExtensionsSchema.relations[linkField.relation] as EnrichedBormRelation;

// 						if (!linkField.isVirtual) {
// 							//its ok for virtual linkFields to don't have a relation
// 							if (!linkFieldRelation) {
// 								throw new Error(`The relation ${linkField.relation} does not exist in the schema`);
// 							}

// 							if (linkFieldRelation.roles?.[linkField.plays] === undefined) {
// 								throw new Error(
// 									`The role ${linkField.plays} is not defined in the relation ${linkField.relation} (linkField: ${linkField.path})`,
// 								);
// 							}
// 						}

// 						//#region SHARED METADATA

// 						if (linkField.target === 'relation') {
// 							if (linkField.isVirtual) {
// 								throw new Error(
// 									`[Schema] Virtual linkFields can't target a relation. Thing: "${val.name}" LinkField: "${linkField.path}. Path:${meta.nodePath}."`,
// 								);
// 							}
// 							linkField.$things = [linkField.relation, ...(linkFieldRelation.subTypes || [])];
// 							linkField.oppositeLinkFieldsPlayedBy = [
// 								{
// 									plays: linkField.path,
// 									thing: linkField.relation,
// 									thingType: 'relation',
// 								},
// 							];
// 						}
// 						if (linkField.target === 'role') {
// 							///target role
// 							linkField.oppositeLinkFieldsPlayedBy = allLinkedFields.filter(
// 								(x) => x.relation === linkField.relation && x.plays !== linkField.plays && x.target === 'role',
// 							);

// 							if (linkField.oppositeLinkFieldsPlayedBy.length === 0) {
// 								throw new Error(
// 									`[Schema] LinkFields require to have at least one opposite linkField playing an opposite role. Thing: "${val.name}" LinkField: "${linkField.path}. Path:${meta.nodePath}."`,
// 								);
// 							}

// 							// This is duplicated here and in playedBy on purpose
// 							linkField.pathToRelation =
// 								val.linkFields?.find((lf) => lf.target === 'relation' && lf.relation === linkField.relation)?.path ??
// 								linkField.relation.toLocaleLowerCase();

// 							linkField.$things = [
// 								...new Set(
// 									linkField.oppositeLinkFieldsPlayedBy.flatMap((x) => [
// 										x.thing,
// 										...(getSchemaByThing(withExtensionsSchema, x.thing)?.subTypes || []),
// 									]),
// 								),
// 							];

// 							// #region FILTERING OPPOSITE LINKFIELDS
// 							// const { targetRoles, filter } = linkField;
// 							// Example targetRoles: ['color', 'users']
// 							//Can be combined with filter, for instance to automatically filter by $thing

// 							//If after the filters, we still have 2, then the schema is wrong
// 							if (linkField.oppositeLinkFieldsPlayedBy.length > 1) {
// 								//temp: lets just warn and add an error only if actually used
// 								console.warn(
// 									`[Schema] LinkField ${linkField.path} in ${val.name} has multiple candidates ${linkField.oppositeLinkFieldsPlayedBy.map((lf) => lf.thing).join(',')} and this is not yet supported. Please target a single one using targetRoles with a single role`,
// 								);
// 							}
// 							// #endregion
// 						}
// 						//#endregion

// 						//#region SUREALDB METADATA

// 						if (value.db === 'surrealDB') {
// 							const originalRelation =
// 								linkFieldRelation?.roles?.[linkField.plays][SharedMetadata]?.inheritanceOrigin ?? linkField.relation;

// 							const queryPath = getSurrealLinkFieldQueryPath({
// 								linkField,
// 								originalRelation,
// 								withExtensionsSchema,
// 								linkMode: value.dbProviderConfig.linkMode,
// 							});

// 							linkField[SuqlMetadata] = {
// 								queryPath,
// 							};
// 						}

// 						// We take the original relation as its the one that holds the name of the relation in surrealDB

// 						//#endregion
// 					});
// 				}

// 				if ('refFields' in value && value.refFields) {
// 					value.refFields = mapEntries(value.refFields, (refFieldKey: string, refField: RefField) => {
// 						const enrichedRefField = {
// 							...refField,
// 							dbPath: refField.dbPath || refFieldKey,
// 						};
// 						return [refFieldKey, enrichedRefField];
// 					});
// 				}

// 				// adding all the linkFields to roles
// 				if ('roles' in value) {
// 					const val = value as EnrichedBormRelation;

// 					Object.entries(val.roles).forEach(([roleKey, role]) => {
// 						//Check if the key is used by linkFields or roleFields already
// 						if (
// 							val.dataFields?.find((df) => df.path === roleKey) ||
// 							val.linkFields?.find((lf) => lf.path === roleKey)
// 						) {
// 							throw new Error(
// 								`[Schema] The path ${roleKey} is already in use by a dataField or linkField in ${val.name}. Path:${meta.nodePath}`,
// 							);
// 						}
// 						const playedBy = allLinkedFields.filter((x) => x.relation === key && x.plays === roleKey) || [];
// 						// Duplicating path to relation here and in normal linkfields as it is used in both places
// 						role.playedBy = playedBy.map((lf) => ({
// 							...lf,
// 							pathToRelation:
// 								lf.target === 'relation'
// 									? lf.path
// 									: (val.linkFields?.find(
// 											(lf) => lf.target === 'relation' && lf.relation === key && lf.plays === roleKey,
// 										)?.path ?? lf.relation.toLocaleLowerCase()),
// 						}));

// 						const impactedLinkFields = allLinkedFields.filter(
// 							(x) => x.target === 'relation' && x.plays === roleKey && val.allExtends?.includes(x.relation),
// 						);
// 						role.impactedLinkFields = impactedLinkFields;

// 						role.path = roleKey;
// 						const $things = [
// 							...new Set(
// 								playedBy
// 									.flatMap((x) => {
// 										const playerSchema = getSchemaByThing(withExtensionsSchema, x.thing);
// 										return [...(playerSchema.subTypes || []), x.thing];
// 									})
// 									.flat()
// 									.filter(Boolean),
// 							),
// 						];

// 						role.$things = $things;

// 						const originalRelation = role[SharedMetadata]?.inheritanceOrigin || value.name;

// 						/*if ($things.length > 1) {
// 							console.warn(
// 								`Not supported yet: Role ${roleKey} in ${'name' in value ? value.name : JSON.stringify(value)} is played by multiple things: ${$things.join(', ')}`,
// 							);
// 						}*/
// 						//get all subTyped for each potential player
// 						const playerThingsWithSubTypes = $things.flatMap((playerThing) => {
// 							const playerSchema = getSchemaByThing(schema, playerThing);
// 							const subTypes = playerSchema?.subTypes || [];
// 							return [playerThing, ...subTypes];
// 						});

// 						const getQueryPath = () => {
// 							if (value.dbProviderConfig.linkMode === 'edges') {
// 								return `->\`${originalRelation}_${roleKey}\`->(\`${playerThingsWithSubTypes.join('`,`')}\`)`;
// 							}
// 							if (value.dbProviderConfig.linkMode === 'refs') {
// 								if (role.cardinality === 'MANY') {
// 									return `$parent.[\`${roleKey}\`]`;
// 								}
// 								if (role.cardinality === 'ONE') {
// 									return `$parent.\`${roleKey}\``;
// 								}
// 							}
// 							throw new Error('Unsupported linkMode');
// 						};

// 						if (value.db === 'surrealDB') {
// 							const queryPath = getQueryPath();

// 							role[SuqlMetadata] = {
// 								queryPath,
// 							};
// 						}
// 					});
// 				}
// 			}

// 			// role fields
// 			if (value && typeof value === 'object' && 'playedBy' in value) {
// 				// if (value.playedBy.length > 1) {
// 				const playedBySet = [...new Set(value.playedBy.map((x: LinkedFieldWithThing) => x.thing))];
// 				if (playedBySet.length > 1) {
// 					console.warn(
// 						`[Schema] roleFields can be only played by one thing. Role: ${key}, path:${meta.nodePath}, played by: ${playedBySet.join(', ')}`,
// 					);
// 				}
// 				if (value.playedBy.length === 0) {
// 					throw new Error(
// 						`[Schema] roleFields should be played at least by one thing. Role: ${key}, path:${meta.nodePath}`,
// 					);
// 				}
// 			}

// 			//if default or computed, add to computed fields list
// 			if (meta.depth === 4) {
// 				const [type, thingId] = meta.nodePath?.split('.') || [];
// 				//todo change "type" to "thingType"
// 				// @ts-expect-error - TODO
// 				const draftSchema = draft[type][thingId] as EnrichedBormEntity;

// 				if (!isArray(value) && typeof value === 'object') {
// 					//skip meta.depth 4 when its arrays or undefined or not an object
// 					if (value.validations) {
// 						if (value.validations.required) {
// 							draftSchema.requiredFields.push(value.path);
// 						}
// 						if (value.validations.enum) {
// 							draftSchema.enumFields.push(value.path);
// 						}
// 						if (value.validations.fn) {
// 							draftSchema.fnValidatedFields.push(value.path);
// 						}
// 					}

// 					if (value.default) {
// 						if (value.isVirtual) {
// 							// default and virtual means computed
// 							draftSchema.virtualFields.push(value.path);
// 						} else {
// 							//default but not virtual means pre-computed (default value), borm side
// 							draftSchema.computedFields.push(value.path);
// 						}
// 					} else {
// 						if (value.isVirtual) {
// 							//not default but isVirtual means, computed in the DB side, not borm side
// 							draftSchema.virtualFields.push(value.path);
// 						}
// 					}
// 				}
// 			}

// 			//if it requires validations, add to the fields that required validations
// 		}),
// 	) as EnrichedBormSchema;

// 	//console.log('schema and enrichedSchema', JSON.stringify(schema), JSON.stringify(enrichedSchema));
// 	return enrichedSchema;
// };
