import { SessionType, TransactionType } from 'typedb-driver';
import type { BormConfig, DBHandles, EnrichedBormSchema } from '../../../types';

type Attribute = {
	dbPath: string;
	contentType: string;
};

const removeDuplicateObjects = (arr: Attribute[]) => {
	const uniqueObjects: Attribute[] = [];

	const uniqueMap = new Map();

	arr.forEach((obj) => {
		const { dbPath, contentType } = obj;
		const key = `${dbPath}-${contentType}`;

		if (!uniqueMap.has(key)) {
			uniqueMap.set(key, true);
			uniqueObjects.push(obj);
		}
	});

	return uniqueObjects;
};

export const convertTQLSchema = (connectorId = 'default', schema: EnrichedBormSchema) => {
	let output = '';
	const usedAttributes: Attribute[] = [];

	output += '\n';

	// CONVERTING ENTITIES

	Object.keys(schema.entities)
		.filter((eName) => schema.entities[eName].defaultDBConnector.id === connectorId)
		.forEach((entityName) => {
			const entity = schema.entities[entityName];
			const { dataFields, linkFields, name } = entity;
			// Checks to see if parent already contains these fields

			output += `${name} sub ${'extends' in entity ? entity.extends : 'entity'},\n`;

			// Adding data fields
			if (dataFields && dataFields.length > 0) {
				dataFields.forEach((field: any) => {
					if (field.inherited) {
						return;
					}
					if (field.isIdField) {
						output += `\towns ${field.dbPath} @key,\n`;
					} else {
						output += `\towns ${field.dbPath},\n`;
					}
					usedAttributes.push({ dbPath: field.dbPath, contentType: field.contentType });
				});
			}
			// Adding link fields
			if (linkFields && linkFields.length > 0) {
				const usedLinkFields: string[] = [];
				linkFields.forEach((linkField) => {
					const { relation, plays, inherited } = linkField;
					if (inherited) {
						return;
					}
					//check if the role in the relation is inherited
					const isInheritedRole = schema.relations[relation].roles[plays].inherited;
					if (!isInheritedRole && !usedLinkFields.includes(`${relation}:${plays}`)) {
						output += `\tplays ${relation}:${plays},\n`;
						usedLinkFields.push(`${relation}:${plays}`);
					}
				});
			}
			output = output.replace(/,\s*$/, ';\n');
			output += '\n';
		});

	// CONVERTING RELATIONS
	Object.keys(schema.relations)
		.filter((rName) => schema.relations[rName].defaultDBConnector.id === connectorId)
		.forEach((relationName) => {
			const relation = schema.relations[relationName];
			// TODO: fix name ts error
			const { dataFields, roles, name, linkFields } = relation;
			// Checks to see if parent already contains these fields

			output += `${name} sub ${'extends' in relation ? relation.extends : 'relation'},\n`;
			// Removes ids from data fields, so their attributes aren't repeated

			// Adding data fields
			if (dataFields && dataFields.length > 0) {
				dataFields.forEach((field: any) => {
					if (!field.inherited) {
						if (field.isIdField) {
							output += `\towns ${field.dbPath} @key,\n`;
						} else {
							output += `\towns ${field.dbPath},\n`;
						}
						usedAttributes.push({ dbPath: field.dbPath, contentType: field.contentType });
					}
				});
			}
			// Adding role fields
			if (roles) {
				Object.keys(roles).forEach((roleName) => {
					if (!roles[roleName].inherited) {
						output += `\trelates ${roleName},\n`;
					}
				});
			}
			// Adding link fields
			if (linkFields && linkFields.length > 0) {
				const usedLinkFields: string[] = [];
				linkFields.forEach((linkField) => {
					const { plays, relation } = linkField;
					const isInheritedRole = schema.relations[relation].roles[plays].inherited;
					if (!isInheritedRole && !linkField.inherited && !usedLinkFields.includes(`${relation}:${plays}`)) {
						output += `\tplays ${linkField.relation}:${plays},\n`;
						usedLinkFields.push(`${relation}:${plays}`);
					}
				});
			}
			output = output.replace(/,\s*$/, ';\n');
			output += '\n';
		});

	// DEFINING ATTRIBUTES

	let attributes = 'define\n\n';
	const newUsedAttributes = removeDuplicateObjects(usedAttributes);

	newUsedAttributes.forEach((attribute: Attribute) => {
		// All conditions for BORM to TQL attribute types
		if (attribute.contentType === 'TEXT' || attribute.contentType === 'ID' || attribute.contentType === 'JSON') {
			attributes += `${attribute.dbPath} sub attribute, value string;\n`;
		} else if (attribute.contentType === 'EMAIL') {
			attributes += `${attribute.dbPath} sub attribute, value string,\n`;
			attributes +=
				"\tregex '^(?=.{1,64}@)[A-Za-z0-9_-]+(\\\\.[A-Za-z0-9_-]+)*@[^-][A-Za-z0-9-]+(\\\\.[A-Za-z0-9-]+)*(\\\\.[A-Za-z]{2,})$';\n";
		} else if (attribute.contentType === 'DATE') {
			attributes += `${attribute.dbPath} sub attribute, value datetime;\n`;
		} else if (attribute.contentType === 'BOOLEAN') {
			attributes += `${attribute.dbPath} sub attribute, value boolean;\n`;
		} else if (attribute.contentType === 'NUMBER') {
			attributes += `${attribute.dbPath} sub attribute, value long;\n`;
		} else if (attribute.contentType === 'FLEX') {
			attributes += `${attribute.dbPath} sub flexAttribute;\n`;
		} else {
			throw new Error(
				`Conversion of borm schema to TypeDB schema for data type "${attribute.contentType}" is not implemented`,
			);
		}
	});

	const utils = `#Tools, reserved for every schema using borm

stringAttribute sub attribute, value string;
longAttribute sub attribute, value long;
doubleAttribute sub attribute, value double;
booleanAttribute sub attribute, value boolean;
datetimeAttribute sub attribute, value datetime;
flexAttribute sub attribute, abstract, value string,
	owns stringAttribute,
	owns longAttribute,
	owns doubleAttribute,
	owns booleanAttribute,
	owns datetimeAttribute;
`;

	return `${attributes}\n\n${output}\n${utils}`;
};

export const defineTQLSchema = async (
	connectorId: string,
	config: BormConfig,
	schema: EnrichedBormSchema,
	dbHandles: DBHandles,
) => {
	if (!dbHandles.typeDB) {
		throw new Error('No TypeDB handles found');
	}
	const typeDBString = convertTQLSchema(connectorId, schema);
	const session = dbHandles.typeDB.get(connectorId)?.session;
	const client = dbHandles.typeDB.get(connectorId)?.client;
	if (!session) {
		console.log('Session Status: ', 'NO SESSION');
		return;
	}

	if (!client) {
		throw new Error('No TypeDB client found');
	}

	await session.close();
	const [{ dbName }] = config.dbConnectors;
	const db = await client.databases.get(dbName);
	await db.delete();
	await client.databases.create(dbName);

	const schemaSession = await client.session(config.dbConnectors[0].dbName, SessionType.SCHEMA);
	//const dataSession = await client.session(config.dbConnectors[0].dbName, SessionType.DATA);

	// 3. Defining new schema

	const schemaTransaction = await schemaSession.transaction(TransactionType.WRITE);

	await schemaTransaction.query.define(typeDBString);
	await schemaTransaction.commit();
	await schemaTransaction.close();

	/*const getSchemaTransaction = await dataSession.transaction(TransactionType.READ);
	const getSchemaQuery = 'match $a sub thing; get $a;';
	const getSchemaStream = await getSchemaTransaction.query.fetch(getSchemaQuery);
	const schemaThings = await getSchemaStream.collect();
	console.log('schemaThings', schemaThings);
	*/
	return typeDBString;
	//await getSchemaTransaction.close();
};
