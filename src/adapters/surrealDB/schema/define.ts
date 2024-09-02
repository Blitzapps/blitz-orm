import type {
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedDataField,
	EnrichedLinkField,
	EnrichedRoleField,
} from '../../../types';

const INDENTATION = '  ' as const;

type SchemaItem = EnrichedBormEntity | EnrichedBormRelation;

const convertBQLToSurQL = (schema: EnrichedBormSchema): string => {
	const header = `USE NS test;
USE DB test;

BEGIN TRANSACTION;
`;

	const entities = convertSchemaItems(schema.entities);
	const relations = convertSchemaItems(schema.relations);
	const utilityFunctions = addUtilityFunctions();

	return `${header}${entities}${relations}${utilityFunctions}COMMIT TRANSACTION;`;
};

const convertSchemaItems = (items: Record<string, SchemaItem>): string =>
	Object.entries(items)
		.map(([name, item]) => convertSchemaItem(name, item))
		.join('\n\n');

const convertSchemaItem = (name: string, item: SchemaItem): string => {
	const baseDefinition = `DEFINE TABLE ${name} SCHEMAFULL PERMISSIONS FULL;`;
	const dataFields = convertDataFields(item.dataFields ?? [], name);
	const linkFields = convertLinkFields(item.linkFields ?? [], name);
	const roles = 'roles' in item ? convertRoles(item.roles, name) : '';
	const events = generateEvents(item, name);

	return `${baseDefinition}\n${dataFields}${linkFields}${roles}${events}`;
};

const convertDataFields = (dataFields: EnrichedDataField[], parentName: string): string =>
	dataFields
		.map((field) => {
			const fieldType = mapContentTypeToSurQL(field.contentType);
			const baseDefinition = `${INDENTATION}DEFINE FIELD ${field.path} ON TABLE ${parentName} TYPE ${fieldType};`;

			if (field.isVirtual) {
				return `${baseDefinition}\n${INDENTATION}${INDENTATION}DEFINE FIELD ${field.path} ON TABLE ${parentName} VALUE <future> { /* TODO: Implement virtual field logic */ };`;
			}

			return baseDefinition;
		})
		.join('\n');

const convertLinkFields = (linkFields: EnrichedLinkField[], parentName: string): string =>
	linkFields
		.map((field) => {
			const fieldType = field.cardinality === 'MANY' ? `array<record<${field.relation}>>` : `record<${field.relation}>`;
			return `${INDENTATION}DEFINE FIELD ${field.path} ON TABLE ${parentName} TYPE ${fieldType};`;
		})
		.join('\n');

const convertRoles = (roles: Record<string, EnrichedRoleField>, parentName: string): string =>
	Object.entries(roles)
		.map(([roleName, role]) => {
			const fieldType =
				role.cardinality === 'MANY' ? `array<record<${role.$things.join('|')}>>` : `record<${role.$things.join('|')}>`;
			return `${INDENTATION}DEFINE FIELD ${roleName} ON TABLE ${parentName} TYPE ${fieldType};`;
		})
		.join('\n');

// Type guard for link fields with target 'role'
const isRoleLinkField = (field: EnrichedLinkField): field is EnrichedLinkField & { target: 'role' } =>
	field.target === 'role';

const generateEvents = (item: SchemaItem, parentName: string): string => {
	const linkFieldEvents = (item.linkFields ?? [])
		.filter(isRoleLinkField)
		.map((field) => generateLinkFieldEvent(field, parentName))
		.join('\n\n');

	const roleEvents =
		'roles' in item
			? Object.entries(item.roles)
					.map(([roleName, role]) => generateRoleEvent(roleName, parentName, role))
					.join('\n\n')
			: '';

	return `${linkFieldEvents}\n\n${roleEvents}`;
};

const generateLinkFieldEvent = (field: EnrichedLinkField & { target: 'role' }, parentName: string): string => {
	const eventName = `update_${field.path}`;
	const oppositeField = field.plays;

	return `${INDENTATION}DEFINE EVENT ${eventName} ON TABLE ${parentName} WHEN $before.${field.path} != $after.${field.path} THEN {
    LET $edges = fn::get_mutated_edges($before.${field.path}, $after.${field.path});
    FOR $unlink IN $edges.deletions {
      UPDATE $unlink SET ${oppositeField} -= [$before.id];
    };
    FOR $link IN $edges.additions {
      UPDATE $link SET ${oppositeField} ${field.cardinality === 'ONE' ? '=' : '+='} [$after.id];
    };
  };`;
};

const generateRoleEvent = (roleName: string, parentName: string, role: EnrichedRoleField): string => {
	const eventName = `update_${roleName}`;
	const oppositeField = role.playedBy?.[0]?.path ?? roleName;

	return `${INDENTATION}DEFINE EVENT ${eventName} ON TABLE ${parentName} WHEN $before.${roleName} != $after.${roleName} THEN {
    LET $edges = fn::get_mutated_edges($before.${roleName}, $after.${roleName});
    FOR $unlink IN $edges.deletions {
      UPDATE $unlink SET ${oppositeField} ${role.cardinality === 'ONE' ? '= NONE' : '-= [$before.id]'};
    };
    FOR $link IN $edges.additions {
      ${role.cardinality === 'ONE' ? `IF ($link.${parentName}) THEN {UPDATE $link.${parentName} SET ${roleName} = NONE} END;` : ''}
      UPDATE $link SET ${oppositeField} ${role.cardinality === 'ONE' ? '=' : '+='} $after.id;
    };
  };`;
};

const mapContentTypeToSurQL = (contentType: string): string => {
	const typeMap: Record<string, string> = {
		TEXT: 'string',
		ID: 'string',
		EMAIL: 'string',
		NUMBER: 'int',
		BOOLEAN: 'bool',
		DATE: 'datetime',
		JSON: 'object',
		FLEX: 'any',
	};

	return typeMap[contentType] ?? 'string';
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

DEFINE FUNCTION fn::as_array(
  $var: option<array<record>|record>,
) {           
  RETURN (type::is::array($var) AND $var) OR [$var]
};
`;

export const defineSurQLSchema = (schema: EnrichedBormSchema): string => convertBQLToSurQL(schema);
