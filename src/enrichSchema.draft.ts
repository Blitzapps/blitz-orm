import { isEqual } from 'radash';
import type { BormEntity, BormRelation, BormSchema, DataField, LinkField, RefField, RoleField } from './types';
import type {
  DRAFT_EnrichedBormComputedField,
  DRAFT_EnrichedBormConstantField,
  DRAFT_EnrichedBormDataField,
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormField,
  DRAFT_EnrichedBormLinkField,
  DRAFT_EnrichedBormRefField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormRoleField,
  DRAFT_EnrichedBormSchema,
} from './types/schema/enriched.draft';

export const enrichSchemaDraft = (schema: BormSchema): DRAFT_EnrichedBormSchema => {
  const extendedSchema = extendSchema(schema);
  const enrichedSchema: DRAFT_EnrichedBormSchema = {};
  const rolePlayerMap: RolePlayerMap = buildRolePlayerMap(extendedSchema);

  for (const entity in extendedSchema.entities) {
    enrichThing('entity', entity, enrichedSchema, extendedSchema, rolePlayerMap);
  }

  for (const relation in extendedSchema.relations) {
    enrichThing('relation', relation, enrichedSchema, extendedSchema, rolePlayerMap);
  }

  return enrichedSchema;
};

/**
 * Mutate the enriched schema in place.
 */
const enrichThing = (
  type: 'entity' | 'relation',
  thingName: string,
  mutEnrichedSchema: DRAFT_EnrichedBormSchema,
  schema: BormSchema,
  rolePlayerMap: RolePlayerMap,
): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation => {
  const enrichedEntity = mutEnrichedSchema[thingName];
  if (enrichedEntity) {
    if (enrichedEntity.type === type) {
      return enrichedEntity;
    }
    throw new Error(`Found entity and relation with the same name: ${thingName}`);
  }
  const thing =
    type === 'entity' ? schema.entities[thingName] : (schema.relations[thingName] as BormEntity | BormRelation);
  if (!thing) {
    throw new Error(`${type === 'entity' ? 'Entity' : 'Relation'} "${thingName}" not found`);
  }

  const extended =
    'extends' in thing && thing.extends
      ? enrichThing(type, thing.extends, mutEnrichedSchema, schema, rolePlayerMap)
      : undefined;

  if (extended) {
    addSubType(extended.name, thingName, mutEnrichedSchema);
  }

  const fields: Record<string, DRAFT_EnrichedBormField> = {};
  const idFields = extended ? extended.idFields : getIdFields(thingName, thing);

  enrichDataFields(fields, thing.dataFields ?? [], thingName);
  enrichRefFields(fields, thing.refFields ?? {}, thingName);
  enrichLinkFields(fields, thing.linkFields ?? [], thingName, schema, rolePlayerMap);

  if (type === 'entity') {
    const enriched: DRAFT_EnrichedBormEntity = {
      type: 'entity',
      name: thingName,
      idFields,
      extends: extended ? extended.name : undefined,
      subTypes: [],
      indexes: thing.indexes ?? [],
      fields: fields as DRAFT_EnrichedBormEntity['fields'],
    };
    mutEnrichedSchema[thingName] = enriched;
    return enriched;
  }

  if ('roles' in thing && thing.roles) {
    enrichRoleFields(
      fields as Record<string, DRAFT_EnrichedBormRoleField>,
      (thing.roles as Record<string, RoleField>) ?? {},
      thingName,
      rolePlayerMap,
    );
  }

  const enriched: DRAFT_EnrichedBormRelation = {
    type: 'relation',
    name: thingName,
    idFields,
    extends: extended ? extended.name : undefined,
    subTypes: [],
    indexes: thing.indexes ?? [],
    fields,
  };
  mutEnrichedSchema[thingName] = enriched;
  return enriched;
};

const addSubType = (thing: string, subThing: string, mutSchema: DRAFT_EnrichedBormSchema) => {
  let currentThing: string | undefined = thing;
  while (currentThing) {
    const enrichedThing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation | undefined = mutSchema[currentThing];
    if (!enrichedThing) {
      throw new Error(`Thing "${currentThing}" not found`);
    }
    enrichedThing.subTypes.push(subThing);
    currentThing = enrichedThing.extends;
  }
};

/**
 * Mutate the enriched fields in place.
 */
const enrichDataFields = (
  mutEnrichedFields: Record<string, DRAFT_EnrichedBormField>,
  dataFields: readonly DataField[],
  thingName: string,
) => {
  for (const df of dataFields ?? []) {
    const existing = mutEnrichedFields[df.path];
    if (df.isVirtual) {
      if (df.default?.type === 'fn' && typeof df.default.fn === 'function') {
        const enriched: DRAFT_EnrichedBormComputedField = {
          type: 'computed',
          name: df.path,
          contentType: df.contentType,
          cardinality: df.cardinality ?? 'ONE',
          fn: df.default.fn,
        };
        assertNoDuplicateField(thingName, enriched, existing);
        mutEnrichedFields[df.path] = enriched;
        continue;
      }

      if (df.default?.type === 'value') {
        const enriched: DRAFT_EnrichedBormConstantField = {
          type: 'constant',
          name: df.path,
          contentType: df.contentType,
          cardinality: df.cardinality ?? 'ONE',
          value: df.default.value,
        };
        assertNoDuplicateField(thingName, enriched, existing);
        mutEnrichedFields[df.path] = enriched;
        continue;
      }
    }

    const enriched: DRAFT_EnrichedBormDataField = {
      type: 'data',
      name: df.path,
      contentType: df.contentType,
      cardinality: df.cardinality ?? 'ONE',
      unique: df.validations?.unique ?? false,
    };
    assertNoDuplicateField(thingName, enriched, existing);
    mutEnrichedFields[df.path] = enriched;
  }
};

/**
 * Mutate the enriched fields in place.
 */
const enrichRefFields = (
  mutEnrichedFields: Record<string, DRAFT_EnrichedBormField>,
  refFields: Record<string, RefField>,
  thingName: string,
) => {
  for (const [refName, ref] of Object.entries(refFields ?? {})) {
    const existing = mutEnrichedFields[refName];
    const enriched: DRAFT_EnrichedBormRefField = {
      type: 'ref',
      name: refName,
      contentType: ref.contentType,
      cardinality: ref.cardinality ?? 'ONE',
    };
    assertNoDuplicateField(thingName, enriched, existing);
    mutEnrichedFields[refName] = enriched;
  }
};

/**
 * Mutate the enriched fields in place.
 */
const enrichLinkFields = (
  mutEnrichedFields: Record<string, DRAFT_EnrichedBormField>,
  linkFields: readonly LinkField[],
  thingName: string,
  schema: BormSchema,
  rolePlayerMap: RolePlayerMap,
) => {
  for (const lf of linkFields ?? []) {
    const targetRel = schema.relations[lf.relation];
    if (!targetRel) {
      throw new Error(`Relation ${lf.relation} not found`);
    }
    const targetRole = targetRel.roles?.[lf.plays];
    if (!targetRole) {
      throw new Error(`Role ${lf.plays} not found in relation ${lf.relation}`);
    }
    const existing = mutEnrichedFields[lf.path];

    if (lf.target === 'relation') {
      const enriched: DRAFT_EnrichedBormLinkField = {
        type: 'link',
        name: lf.path,
        cardinality: lf.cardinality,
        target: 'relation',
        opposite: {
          thing: lf.relation,
          path: lf.plays,
          cardinality: targetRole.cardinality,
        },
      };
      assertNoDuplicateField(thingName, enriched, existing);
      mutEnrichedFields[lf.path] = enriched;
      continue;
    }

    // NOTE: If the opposite role path is not defined, the opposite role path is the same as the link field path.
    // This is an implicit rule and it's not standardized yet.
    const oppositeRole = rolePlayerMap[lf.relation]?.[lf.targetRole];
    if (!oppositeRole) {
      throw new Error(`Role ${lf.path} in relation ${lf.relation} does not exist`);
    }
    const rolePlayer = oppositeRole.targetingRole;
    if (!rolePlayer) {
      throw new Error(`Role ${oppositeRole} in relation ${lf.relation} is not played by any other thing`);
    }
    const enriched: DRAFT_EnrichedBormLinkField = {
      type: 'link',
      name: lf.path,
      cardinality: lf.cardinality,
      target: 'role',
      opposite: rolePlayer,
    };
    assertNoDuplicateField(thingName, enriched, existing);
    mutEnrichedFields[lf.path] = enriched;
  }
};

/**
 * Mutate the enriched fields in place.
 */
const enrichRoleFields = (
  mutEnrichedFields: Record<string, DRAFT_EnrichedBormRoleField>,
  roles: Record<string, RoleField>,
  thingName: string,
  rolePlayerMap: RolePlayerMap,
) => {
  for (const [roleName, role] of Object.entries(roles)) {
    // TODO: This is WRONG.
    // It should not fallback to targetingRole if targetingRelation is not found
    // because in the SurrealDB schema the value of the targetingRelation.thing[targetingRelation.path] is not thingName.
    // This becomes problematic when we transform filter into sub-query:
    // SELECT * FROM <thingName> WHERE <roleName> = xyz
    // Is not the same as:
    // SELECT * FROM (SELECT VALUE <targetingRelation.path> FROM <targetingRelation.thing> WHERE id = xyz)
    const opposite =
      rolePlayerMap[thingName]?.[roleName]?.targetingRelation ?? rolePlayerMap[thingName]?.[roleName]?.targetingRole;
    if (!opposite) {
      throw new Error(`Role ${roleName} in relation ${thingName} is not played by any other thing`);
    }
    const existing = mutEnrichedFields[roleName];
    const enriched: DRAFT_EnrichedBormRoleField = {
      type: 'role',
      name: roleName,
      cardinality: role.cardinality ?? 'ONE',
      opposite: opposite,
    };
    assertNoDuplicateField(thingName, enriched, existing);
    mutEnrichedFields[roleName] = enriched;
  }
};

const assertNoDuplicateField = (
  thing: string,
  newField: DRAFT_EnrichedBormField,
  existing?: DRAFT_EnrichedBormField,
) => {
  if (!existing) {
    return;
  }
  if (isEqual(newField, existing)) {
    return;
  }
  throw new Error(`Duplicate field name "${newField.name}" in "${thing}"`);
};

type RolePlayerMap = Record<
  DRAFT_EnrichedBormRelation['name'],
  Record<
    DRAFT_EnrichedBormRoleField['name'],
    {
      targetingRole?: DRAFT_EnrichedBormRoleField['opposite'];
      targetingRelation?: DRAFT_EnrichedBormRoleField['opposite'];
    }
  >
>;

const buildRolePlayerMap = (schema: BormSchema): RolePlayerMap => {
  const rolePlayerMap: RolePlayerMap = {};
  for (const [relName, rel] of [...Object.entries(schema.relations), ...Object.entries(schema.entities)]) {
    for (const lf of rel.linkFields ?? []) {
      const roleMap = rolePlayerMap[lf.relation] ?? {};
      rolePlayerMap[lf.relation] = roleMap;
      const rolePlayer = roleMap[lf.plays] ?? {};
      roleMap[lf.plays] = rolePlayer;
      const existingOpposite = lf.target === 'relation' ? rolePlayer.targetingRelation : rolePlayer.targetingRole;
      if (existingOpposite) {
        if (existingOpposite.thing === relName) {
          // Multiple link fields of the same thing may play the same role. And it's fine.
          continue;
        }
        if (isExtend(relName, existingOpposite.thing, schema)) {
          // The current relation extends the role's opposite relation. Keep it.
          continue;
        }
        if (!isExtend(existingOpposite.thing, relName, schema)) {
          throw new Error(`Found multiple players for role ${lf.plays} in relation ${lf.relation}`);
        }
      }
      if (lf.target === 'relation') {
        rolePlayer.targetingRelation = {
          thing: relName,
          path: lf.path,
          cardinality: lf.cardinality,
        };
      } else {
        rolePlayer.targetingRole = {
          thing: relName,
          path: lf.path,
          cardinality: lf.cardinality,
        };
      }
    }
  }
  return rolePlayerMap;
};

/**
 * Return true if thingA extends thingB directly or indirectly.
 */
const isExtend = (thingA: string, thingB: string, schema: BormSchema): boolean => {
  const ancestorsA = getAncestors(thingA, schema);
  return ancestorsA.includes(thingB);
};

const getAncestors = (thing: string, schema: BormSchema): string[] => {
  const ancestors: string[] = [];
  let current = thing;
  while (current) {
    const _thing = schema.entities[current] ?? schema.relations[current];
    if (!_thing) {
      throw new Error(`Thing "${current}" not found`);
    }
    if (!('extends' in _thing) || !_thing.extends) {
      break;
    }
    ancestors.push(_thing.extends);
    current = _thing.extends;
  }
  return ancestors.reverse();
};

const getIdFields = (name: string, entity: BormEntity | BormRelation): [string, ...string[]] => {
  if (entity.idFields && entity.idFields.length > 0) {
    return [entity.idFields[0], ...entity.idFields.slice(1)];
  }
  const f = entity.dataFields?.find((f) => f.contentType === 'ID');
  if (f) {
    return [f.path];
  }
  throw new Error(`No id field found for entity "${name}"`);
};

const extendSchema = (schema: BormSchema): BormSchema => {
  const extendedSchema: BormSchema = {
    entities: {},
    relations: {},
  };
  for (const name in schema.entities) {
    extendEntity(name, schema, extendedSchema);
  }
  for (const name in schema.relations) {
    extendRelation(name, schema, extendedSchema);
  }
  return extendedSchema;
};

/**
 * NOTE: Mutate the extended schema in place.
 */
const extendEntity = (name: string, schema: BormSchema, mutExtendedSchema: BormSchema): BormEntity => {
  const entity = schema.entities[name];
  if (!entity) {
    throw new Error(`Entity "${name}" not found`);
  }
  if ('extends' in entity && entity.extends) {
    const ancestor = extendEntity(entity.extends, schema, mutExtendedSchema);
    const extended = {
      ...entity,
      idFields: entity.idFields ?? ancestor.idFields,
      dataFields: extendDataFields(ancestor, entity),
      linkFields: extendLinkFields(ancestor, entity),
      refFields: extendRefFields(ancestor, entity),
    };
    mutExtendedSchema.entities[name] = extended;
    return extended;
  }
  mutExtendedSchema.entities[name] = entity;
  return entity;
};

/**
 * NOTE: Mutate the extended schema in place.
 */
const extendRelation = (name: string, schema: BormSchema, mutExtendedSchema: BormSchema): BormRelation => {
  const relation = schema.relations[name];
  if (!relation) {
    throw new Error(`Relation "${name}" not found`);
  }
  if ('extends' in relation && relation.extends) {
    const ancestor = extendRelation(relation.extends, schema, mutExtendedSchema);
    const extended = {
      ...relation,
      idFields: relation.idFields ?? ancestor.idFields,
      dataFields: extendDataFields(ancestor, relation),
      linkFields: extendLinkFields(ancestor, relation),
      refFields: extendRefFields(ancestor, relation),
      roles: extendRoles(ancestor, relation),
    };
    mutExtendedSchema.relations[name] = extended;
    return extended;
  }
  mutExtendedSchema.relations[name] = relation;
  return relation;
};

const extendDataFields = (ancestor: BormEntity | BormRelation, entity: BormEntity | BormRelation): DataField[] => {
  const explicitDataFieldSet = new Set(entity.dataFields?.map((df) => df.path) ?? []);
  const inheritedDataFields = ancestor.dataFields?.filter((df) => !explicitDataFieldSet.has(df.path)) ?? [];
  return [...inheritedDataFields, ...(entity.dataFields ?? [])];
};

const extendLinkFields = (ancestor: BormEntity | BormRelation, entity: BormEntity | BormRelation): LinkField[] => {
  const explicitLinkFieldSet = new Set(entity.linkFields?.map((lf) => lf.path) ?? []);
  const inheritedLinkFields = ancestor.linkFields?.filter((lf) => !explicitLinkFieldSet.has(lf.path)) ?? [];
  return [...inheritedLinkFields, ...(entity.linkFields ?? [])];
};

const extendRefFields = (
  ancestor: BormEntity | BormRelation,
  entity: BormEntity | BormRelation,
): Record<string, RefField> => {
  const inheritedRefFields = Object.fromEntries(
    Object.entries(ancestor.refFields ?? {}).filter(([k]) => !entity.refFields?.[k]),
  );
  return { ...inheritedRefFields, ...(entity.refFields ?? {}) };
};

const extendRoles = (ancestor: BormRelation, entity: BormRelation): Record<string, RoleField> => {
  const inheritedRoles = Object.fromEntries(Object.entries(ancestor.roles ?? {}).filter(([k]) => !entity.roles?.[k]));
  return { ...inheritedRoles, ...(entity.roles ?? {}) };
};
