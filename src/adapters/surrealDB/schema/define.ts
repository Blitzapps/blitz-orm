import type {
  EnrichedBormEntity,
  EnrichedBormRelation,
  EnrichedBormSchema,
  EnrichedDataField,
  EnrichedLinkField,
  EnrichedRoleField,
  Validations,
} from '../../../types';
import { sanitizeNameSurrealDB } from '../helpers';
import { parseValueSurrealDB, surrealDBtypeMap } from '../parsing/values';

const INDENTATION = '\t' as const;
const indent = (n: number): string => INDENTATION.repeat(n);

const indentPar = (str: string, level: number): string =>
  str
    .split('\n')
    .map((line) => (line.trim() ? `${indent(level)}${line}` : line))
    .join('\n');

type SchemaItem = EnrichedBormEntity | EnrichedBormRelation;

const convertBQLToSurQL = (schema: EnrichedBormSchema): string => {
  const header = `USE NS test;
USE DB test;

BEGIN TRANSACTION;
`;

  const entities = `-- ENTITIES\n${convertSchemaItems(schema.entities)}`;
  const relations = `\n-- RELATIONS\n${convertSchemaItems(schema.relations)}`;
  const utilityFunctions = addUtilityFunctions();

  return `${header}${entities}${relations}${utilityFunctions}COMMIT TRANSACTION;`;
};

const convertSchemaItems = (items: Record<string, SchemaItem>): string =>
  Object.entries(items)
    .map(([name, item]) => convertSchemaItem(sanitizeNameSurrealDB(name), item, 1))
    .join('\n\n');

const convertSchemaItem = (name: string, item: SchemaItem, level: number): string => {
  const baseDefinition = `${indent(level)}DEFINE TABLE ${name} SCHEMAFULL PERMISSIONS FULL;${'extends' in item && item.extends ? ` //EXTENDS ${item.extends};` : ''}`;
  const dataFields = indentPar(`-- DATA FIELDS\n${convertDataFields(item.dataFields ?? [], name, level)}`, level + 1);
  const linkFields = indentPar(`\n-- LINK FIELDS\n${convertLinkFields(item.linkFields ?? [], name, level)}`, level + 1);
  const roles = 'roles' in item ? indentPar(`\n-- ROLES\n${convertRoles(item.roles, name, level)}`, level + 1) : '';

  return `${baseDefinition}\n${dataFields}${linkFields}${roles}`;
};

const convertDataFields = (dataFields: EnrichedDataField[], parentName: string, level: number): string =>
  dataFields
    .map((field) => {
      if (field.path === 'id') {
        return ''; //skip id fields for now, we will migrate it to a different name later like _id
      }
      const fieldType = mapContentTypeToSurQL(field.contentType, field.validations);
      const baseDefinition = `${indent(level)}DEFINE FIELD ${field.path} ON TABLE ${parentName}${['FLEX', 'JSON'].includes(field.contentType) ? ' FLEXIBLE' : ''}`; //TTODO: Better type json

      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }
        return `${baseDefinition} VALUE ${dbValue};`;
      }
      return `${baseDefinition} TYPE ${fieldType};`;
    })
    .filter(Boolean)
    .join('\n');

const convertLinkFields = (linkFields: EnrichedLinkField[], parentName: string, level: number): string =>
  linkFields
    .map((linkField) => {
      const fieldType =
        //linkField.cardinality === 'MANY' ? `array<record<${linkField.relation}>>` : `record<${linkField.relation}>`; //todo: uncomment once surrealDB has smart transactions
        linkField.cardinality === 'MANY'
          ? `option<array<record<${linkField.$things.map(sanitizeNameSurrealDB).join('|')}>>>`
          : `option<record<${linkField.$things.map(sanitizeNameSurrealDB).join('|')}>>`;

      const baseDefinition = `${indent(level)}DEFINE FIELD ${sanitizeNameSurrealDB(linkField.path)} ON TABLE ${parentName}`;

      if (linkField.isVirtual) {
        const dbValue = linkField.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }

        return `${baseDefinition} VALUE ${dbValue};`;
      }

      if (linkField.target === 'role') {
        const relationLinkField = linkFields.find(
          (lf) => lf.target === 'relation' && lf.relation === linkField.relation,
        );
        const targetRole = linkField.oppositeLinkFieldsPlayedBy?.[0];
        const targetPath = targetRole.plays;

        if (!targetPath || linkField.oppositeLinkFieldsPlayedBy?.length !== 1) {
          throw new Error(`Invalid link field: ${linkField.path}`);
        }

        const type =
          linkField.cardinality === 'ONE'
            ? `record<${sanitizeNameSurrealDB(linkField.relation)}>`
            : `array<record<${sanitizeNameSurrealDB(linkField.relation)}>>`;

        const pathToRelation = sanitizeNameSurrealDB(linkField.pathToRelation || '');
        const relationPath = `${pathToRelation}.${targetPath}`;

        const baseField =
          linkField.cardinality === 'ONE'
            ? `${baseDefinition} VALUE <future> {RETURN SELECT VALUE ${relationPath} FROM ONLY $this};`
            : `${baseDefinition} VALUE <future> {array::distinct(SELECT VALUE array::flatten(${relationPath} || []) FROM ONLY $this)};`;
        const supportField = relationLinkField?.path
          ? ''
          : `${indent(level + 1)}DEFINE FIELD ${pathToRelation} ON TABLE ${parentName} TYPE references<${sanitizeNameSurrealDB(linkField.relation)}, ${targetPath}>;`;

        return [baseField, supportField].join('\n');
      }
      if (linkField.target === 'relation') {
        const fieldDefinition = `${indent(level)}DEFINE FIELD ${sanitizeNameSurrealDB(linkField.path)} ON TABLE ${parentName} TYPE ${fieldType};`;
        return `${fieldDefinition}`;
      }
      throw new Error(`Invalid link field: ${JSON.stringify(linkField)}`);
    })
    .join('\n');

const convertRoles = (roles: Record<string, EnrichedRoleField>, parentName: string, level: number): string =>
  Object.entries(roles)
    .map(([roleName, role]) => {
      const fieldType =
        role.cardinality === 'MANY'
          ? `array<record<${role.$things.map(sanitizeNameSurrealDB).join('|')}>>`
          : `record<${role.$things.map(sanitizeNameSurrealDB).join('|')}>`;
      const fieldDefinition = `${indent(level)}DEFINE FIELD ${roleName} ON TABLE ${parentName} TYPE option<${fieldType}> REFERENCE;`;
      return `${fieldDefinition}`;
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

const addUtilityFunctions = (): string => `
-- BORM TOOLS
	DEFINE FUNCTION fn::get_mutated_edges(
		$before_relation: option<array|record>,
		$after_relation: option<array|record>,
	) {
		LET $notEmptyCurrent = $before_relation ?? [];
		LET $current = array::flatten([$notEmptyCurrent]);
		LET $notEmptyResult = $after_relation ?? [];
		LET $result = array::flatten([$notEmptyResult]);
		LET $links = array::complement($result, $current);
		LET $unlinks = array::complement($current, $result);
		
		RETURN {
			additions: $links,
			deletions: $unlinks
		};
	};

	DEFINE FUNCTION fn::as_array($var: option<array<record>|record>) {           
		RETURN (type::is::array($var) AND $var) OR [$var]
	};
`;

export const defineSURQLSchema = (schema: EnrichedBormSchema): string => convertBQLToSurQL(schema);
