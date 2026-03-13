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

const INDENTATION = '  ' as const;
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
  const relationsStr = `\n\n-- RELATIONS\n${convertSchemaItems(relations, schema)}`;

  const internalStr = `\n\n-- INTERNAL\n${indent(1)}DEFINE TABLE Delta SCHEMALESS PERMISSIONS FULL;\n`;

  return `${header}${entitiesStr}${relationsStr}${internalStr}COMMIT TRANSACTION;\n`;
};

const convertSchemaItems = (items: [string, DraftSchemaItem][], schema: DRAFT_EnrichedBormSchema): string =>
  items.map(([name, item]) => convertSchemaItem(sanitizeNameSurrealDB(name), item, 1, schema)).join('\n\n');

const assertNoFieldNameConflicts = (thingName: string, item: DraftSchemaItem) => {
  const seen = new Map<string, { originalName: string; fieldType: string }>();

  const check = (effectiveName: string, originalName: string, fieldType: string) => {
    const existing = seen.get(effectiveName);
    if (existing && existing.originalName !== originalName) {
      throw new Error(
        `Field name conflict in "${thingName}": ${fieldType} field "${originalName}" resolves to "${effectiveName}" ` +
          `which conflicts with ${existing.fieldType} field "${existing.originalName}"`,
      );
    }
    seen.set(effectiveName, { originalName, fieldType });
  };

  for (const field of Object.values(item.fields)) {
    if (field.type === 'data') {
      if (field.name === 'id') {
        continue;
      }
      check(sanitizeNameSurrealDB(field.name), field.name, 'data');
    } else if (field.type === 'link') {
      check(computedFieldNameSurrealDB(field.name), field.name, 'link');
    } else if (field.type === 'role') {
      check(sanitizeNameSurrealDB(field.name), field.name, 'role');
    } else if (field.type === 'ref') {
      check(sanitizeNameSurrealDB(field.name), field.name, 'ref');
    }
  }
};

const convertSchemaItem = (
  sanitizedName: string,
  item: DraftSchemaItem,
  level: number,
  schema: DRAFT_EnrichedBormSchema,
): string => {
  assertNoFieldNameConflicts(sanitizedName, item);

  const baseDefinition = `${indent(level)}DEFINE TABLE ${sanitizedName} SCHEMAFULL PERMISSIONS FULL;${item.extends ? ` //EXTENDS ${item.extends};` : ''}`;

  // Data fields
  const dataFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormDataField => f.type === 'data');
  const dataFieldsOutput = convertDataFields(dataFields, sanitizedName, level);

  // Link fields (COMPUTED)
  const linkFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormLinkField => f.type === 'link');
  const linkFieldsOutput = convertLinkFields(linkFields, sanitizedName, level, schema);

  // Roles (REFERENCE)
  let rolesOutput = '';
  if (item.type === 'relation') {
    const roleFields = Object.entries(item.fields).filter(
      (entry): entry is [string, DRAFT_EnrichedBormRoleField] => entry[1].type === 'role',
    );
    if (roleFields.length > 0) {
      rolesOutput = convertRoles(roleFields, sanitizedName, level, schema);
    }
  }

  // Ref fields
  const refFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormRefField => f.type === 'ref');
  const refFieldsOutput = refFields.length > 0 ? convertRefFields(refFields, sanitizedName, level) : '';

  // Build sections conditionally
  const sections: string[] = [];

  if (dataFieldsOutput) {
    sections.push(`-- DATA FIELDS\n${dataFieldsOutput}`);
  }

  if (linkFieldsOutput) {
    sections.push(`-- LINK FIELDS\n${linkFieldsOutput}`);
  } else if (dataFieldsOutput && !rolesOutput && !refFieldsOutput) {
    // Empty LINK FIELDS acts as visual terminator when data fields is the only other section
    sections.push('-- LINK FIELDS');
  }

  if (rolesOutput) {
    sections.push(`-- ROLES\n${rolesOutput}`);
  }

  if (refFieldsOutput) {
    sections.push(`-- REF FIELDS\n${refFieldsOutput}`);
  }

  const body = sections.map((s) => indentPar(s, level + 1)).join('\n');
  return `${baseDefinition}\n${body}`;
};

const convertDataFields = (dataFields: DRAFT_EnrichedBormDataField[], parentName: string, level: number): string =>
  dataFields
    .map((field) => {
      if (field.name === 'id') {
        return ''; //skip id fields for now, we will migrate it to a different name later like _id
      }
      const sanitizedPath = sanitizeNameSurrealDB(field.name);
      const baseDefinition = `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName}`;

      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }
      if (['FLEX', 'JSON'].includes(field.contentType)) {
        return `${baseDefinition} TYPE any;`;
      }
      const fieldType = mapContentTypeToSurQL(field.contentType, field.validations, field.cardinality);
      return `${baseDefinition} TYPE ${fieldType};`;
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
      // - array::flatten needs `?? []` to ensure it receives an array
      // Note: Multi-table <~(T1 FIELD f, T2 FIELD f) is broken in SurrealDB v3,
      // so we split into individual <~(...) expressions and combine with array::concat.
      let computedExpr: string;
      if (sources.length === 1) {
        const rawExpr = `<~(${sources[0]})${targetSuffix}`;
        if (field.target === 'relation') {
          computedExpr = field.cardinality === 'ONE' ? `array::first(${rawExpr} ?? [])` : rawExpr;
        } else {
          if (field.cardinality === 'ONE') {
            computedExpr = `array::first(${rawExpr} ?? [])`;
          } else if (field.targetRoleCardinality === 'MANY') {
            computedExpr = `array::distinct(array::flatten(${rawExpr} ?? []))`;
          } else {
            computedExpr = `array::distinct(${rawExpr})`;
          }
        }
      } else {
        // Multiple sources: split to work around SurrealDB v3 multi-table <~() bug
        if (field.target === 'relation') {
          const exprs = sources.map((s) => `<~(${s}) ?? []`);
          const combined = `array::concat(${exprs.join(', ')})`;
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
        // FLEX: TYPE any covers all possible types for any cardinality
        fieldType = 'any';
      }
      return `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE ${fieldType};`;
    })
    .join('\n');

const mapContentTypeToSurQL = (
  contentType: string,
  validations?: Validations,
  cardinality?: 'ONE' | 'MANY',
): string => {
  const baseType = validations?.enum
    ? `${validations.enum.map((value: unknown) => parseValueSurrealDB(value, contentType)).join('|')}`
    : surrealDBtypeMap[contentType];
  if (!baseType) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  const type = cardinality === 'MANY' ? `array<${baseType}>` : baseType;

  if (validations?.required) {
    return type;
  }
  return `option<${type}>`;
};

export const defineSURQLSchema = (schema: DRAFT_EnrichedBormSchema): string => convertBQLToSurQL(schema);
