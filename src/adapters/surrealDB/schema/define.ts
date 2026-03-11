import type {
  DRAFT_EnrichedBormDataField,
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormLinkField,
  DRAFT_EnrichedBormRefField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormRoleField,
  DRAFT_EnrichedBormSchema,
} from '../../../types/schema/enriched.draft';
import type { Validations } from '../../../types/schema/fields';
import { computedFieldNameSurrealDB, sanitizeNameSurrealDB } from '../helpers';
import { parseValueSurrealDB, surrealDBtypeMap } from '../parsing/values';

const INDENTATION = '\t' as const;
const indent = (n: number): string => INDENTATION.repeat(n);

const indentPar = (str: string, level: number): string =>
  str
    .split('\n')
    .map((line) => (line.trim() ? `${indent(level)}${line}` : line))
    .join('\n');

type DraftSchemaItem = DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation;

const convertBQLToSurQL = (schema: DRAFT_EnrichedBormSchema): string => {
  const header = `USE NS test;
USE DB test;

BEGIN TRANSACTION;
`;

  const entities = Object.entries(schema).filter(([, item]) => item.type === 'entity');
  const relations = Object.entries(schema).filter(([, item]) => item.type === 'relation');

  const entitiesStr = `-- ENTITIES\n${convertSchemaItems(entities, schema)}`;
  const relationsStr = `\n-- RELATIONS\n${convertSchemaItems(relations, schema)}`;

  const internalStr = `\n-- INTERNAL\n\tDEFINE TABLE Delta SCHEMALESS PERMISSIONS FULL;\n`;

  return `${header}${entitiesStr}${relationsStr}${internalStr}COMMIT TRANSACTION;`;
};

const convertSchemaItems = (items: [string, DraftSchemaItem][], schema: DRAFT_EnrichedBormSchema): string =>
  items.map(([name, item]) => convertSchemaItem(sanitizeNameSurrealDB(name), item, 1, schema)).join('\n\n');

const convertSchemaItem = (
  sanitizedName: string,
  item: DraftSchemaItem,
  level: number,
  schema: DRAFT_EnrichedBormSchema,
): string => {
  const baseDefinition = `${indent(level)}DEFINE TABLE ${sanitizedName} SCHEMAFULL PERMISSIONS FULL;${item.extends ? ` //EXTENDS ${item.extends};` : ''}`;

  // Data fields
  const dataFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormDataField => f.type === 'data');
  const dataFieldsStr = indentPar(`-- DATA FIELDS\n${convertDataFields(dataFields, sanitizedName, level)}`, level + 1);

  // Link fields (COMPUTED)
  const linkFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormLinkField => f.type === 'link');
  const linkFieldsStr = indentPar(
    `\n-- LINK FIELDS\n${convertLinkFields(linkFields, sanitizedName, level, schema)}`,
    level + 1,
  );

  // Roles (REFERENCE)
  let rolesStr = '';
  if (item.type === 'relation') {
    const roleFields = Object.entries(item.fields).filter(
      (entry): entry is [string, DRAFT_EnrichedBormRoleField] => entry[1].type === 'role',
    );
    if (roleFields.length > 0) {
      rolesStr = indentPar(`\n-- ROLES\n${convertRoles(roleFields, sanitizedName, level, schema)}`, level + 1);
    }
  }

  // Ref fields
  const refFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormRefField => f.type === 'ref');
  const refFieldsStr =
    refFields.length > 0 ? indentPar(`\n${convertRefFields(refFields, sanitizedName, level)}`, level + 1) : '';

  return `${baseDefinition}\n${dataFieldsStr}${linkFieldsStr}${rolesStr}${refFieldsStr}`;
};

const convertDataFields = (dataFields: DRAFT_EnrichedBormDataField[], parentName: string, level: number): string =>
  dataFields
    .map((field) => {
      if (field.name === 'id') {
        return ''; //skip id fields for now, we will migrate it to a different name later like _id
      }
      const fieldType = mapContentTypeToSurQL(field.contentType, field.validations);
      const baseDefinition = `${indent(level)}DEFINE FIELD ${field.name} ON TABLE ${parentName}`;
      const flexible = ['FLEX', 'JSON'].includes(field.contentType) ? ' FLEXIBLE' : '';

      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }
      return `${baseDefinition} TYPE ${fieldType}${flexible};`;
    })
    .filter(Boolean)
    .join('\n');

const convertLinkFields = (
  linkFields: DRAFT_EnrichedBormLinkField[],
  parentName: string,
  level: number,
  draftSchema: DRAFT_EnrichedBormSchema,
): string =>
  linkFields
    .map((field) => {
      // Use safe internal name for COMPUTED fields (SurrealDB v3 bug with escaped names)
      const computedPath = computedFieldNameSurrealDB(field.name);
      const baseDefinition = `${indent(level)}DEFINE FIELD ${computedPath} ON TABLE ${parentName}`;

      // Virtual link fields use custom dbValue expressions, not standard COMPUTED fields
      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; // computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }

      // Build the <~(...) reverse lookup expression
      const selfRole = field.plays;
      const relationName = field.target === 'relation' ? field.opposite.thing : field.relation;
      const sources = collectPolymorphicSources(relationName, selfRole, draftSchema);

      const targetSuffix = field.target === 'role' ? `.${sanitizeNameSurrealDB(field.targetRole)}` : '';

      // Wrap with appropriate array function based on cardinality.
      // Guard against NONE from <~(...) when no back-references exist:
      // - array::first needs `?? []` to avoid "Expected array but found NONE"
      // - array::flatten needs wrapping in [...] to ensure it's always an array
      // Note: Multi-table <~(T1 FIELD f, T2 FIELD f) is broken in SurrealDB v3,
      // so we split into individual <~(...) expressions and combine with array::flatten.
      let computedExpr: string;
      if (sources.length === 1) {
        const rawExpr = `<~(${sources[0]})${targetSuffix}`;
        if (field.target === 'relation') {
          computedExpr = field.cardinality === 'ONE' ? `array::first(${rawExpr} ?? [])` : rawExpr;
        } else {
          if (field.cardinality === 'ONE') {
            computedExpr = `array::first(${rawExpr} ?? [])`;
          } else if (field.targetRoleCardinality === 'MANY') {
            computedExpr = `array::distinct(array::flatten(array::flatten([${rawExpr}])))`;
          } else {
            computedExpr = `array::distinct(${rawExpr})`;
          }
        }
      } else {
        // Multiple sources: split to work around SurrealDB v3 multi-table <~() bug
        if (field.target === 'relation') {
          const exprs = sources.map((s) => `<~(${s}) ?? []`);
          const combined = `array::flatten([${exprs.join(', ')}])`;
          computedExpr =
            field.cardinality === 'ONE' ? `array::first(${combined} ?? [])` : `array::distinct(${combined})`;
        } else {
          const exprs = sources.map((s) => `(<~(${s}) ?? [])${targetSuffix}`);
          const combined = `array::flatten([${exprs.join(', ')}])`;
          if (field.cardinality === 'ONE') {
            computedExpr = `array::first(${combined} ?? [])`;
          } else if (field.targetRoleCardinality === 'MANY') {
            computedExpr = `array::distinct(array::flatten(${combined}))`;
          } else {
            computedExpr = `array::distinct(${combined})`;
          }
        }
      }

      return `${baseDefinition} COMPUTED ${computedExpr};`;
    })
    .join('\n');

/**
 * Collect all tables in the inheritance chain for a polymorphic COMPUTED field.
 * Returns entries like `["Table FIELD role", "SubType1 FIELD role", ...]`.
 */
const collectPolymorphicSources = (
  thingName: string,
  roleName: string,
  draftSchema: DRAFT_EnrichedBormSchema,
): string[] => {
  const thing = draftSchema[thingName];
  if (!thing) {
    return [`${sanitizeNameSurrealDB(thingName)} FIELD ${sanitizeNameSurrealDB(roleName)}`];
  }
  const allThings = [thingName, ...thing.subTypes];
  return allThings.map((t) => `${sanitizeNameSurrealDB(t)} FIELD ${sanitizeNameSurrealDB(roleName)}`);
};

const convertRoles = (
  roleFields: [string, DRAFT_EnrichedBormRoleField][],
  parentName: string,
  level: number,
  draftSchema: DRAFT_EnrichedBormSchema,
): string =>
  roleFields
    .map(([, role]) => {
      const sanitizedPath = sanitizeNameSurrealDB(role.name);
      const baseThing = role.opposite.thing;
      const draftThing = draftSchema[baseThing];
      const allThings = draftThing ? [baseThing, ...draftThing.subTypes] : [baseThing];
      const thingNames = allThings.map(sanitizeNameSurrealDB).join('|');
      const fieldType = role.cardinality === 'MANY' ? `array<record<${thingNames}>>` : `record<${thingNames}>`;
      const onDelete = role.onDelete ?? 'UNSET';
      return `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE option<${fieldType}> REFERENCE ON DELETE ${onDelete};`;
    })
    .join('\n');

const convertRefFields = (refFields: DRAFT_EnrichedBormRefField[], parentName: string, level: number): string =>
  refFields
    .map((field) => {
      const sanitizedPath = sanitizeNameSurrealDB(field.name);
      let fieldType: string;
      if (field.contentType === 'REF') {
        fieldType = field.cardinality === 'MANY' ? 'option<array<record>>' : 'option<record>';
      } else {
        // FLEX: use TYPE any for MANY cardinality to allow arbitrary nested structures
        // (arrays of arrays, objects with any keys, etc.) on SCHEMAFULL tables.
        const flexTypes = 'record|array|bool|bytes|datetime|duration|geometry|number|object|string';
        fieldType = field.cardinality === 'MANY' ? 'any' : `option<${flexTypes}>`;
      }
      const flexible = field.contentType === 'FLEX' && field.cardinality !== 'MANY' ? ' FLEXIBLE' : '';
      const baseDef = `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE ${fieldType}${flexible};`;
      return baseDef;
    })
    .join('\n');

const mapContentTypeToSurQL = (contentType: string, validations?: Validations): string => {
  const type = validations?.enum
    ? `${validations.enum.map((value: unknown) => parseValueSurrealDB(value, contentType)).join('|')}`
    : surrealDBtypeMap[contentType];
  if (!type) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  if (validations?.required) {
    return `${type}`;
  }
  return `option<${type}>`;
};

export const defineSURQLSchema = (schema: DRAFT_EnrichedBormSchema): string => convertBQLToSurQL(schema);
