import { SessionType, TransactionType, TypeDB } from 'typedb-client';

import { testConfig } from '../../tests/mocks/testConfig';
import { BormConfig, BormSchema, LinkField } from '../types';

type Attribute = {
  dbPath: string;
  contentType: string;
};

function removeDuplicateObjects(arr: Attribute[]) {
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
}

export const bormDefine = async (config: BormConfig, schema: BormSchema) => {
  function convertSchema() {
    // getting attributes from entities
    let output = '';
    const usedAttributes: Attribute[] = [];

    output += '\n';

    Object.keys(schema.entities).forEach((entityName) => {
      const entity = schema.entities[entityName];
      // @ts-expect-error
      const { idFields, dataFields, linkFields, name } = entity;
      const commonDataFields: string[] = [];
      const commonLinkFields: string[] = [];
      const commonIdFields: string[] = [];

      // If extended by parent, get rid of parent's declared attributes
      if (entity.extends) {
        const parentEntity = schema.entities[entity.extends];
        if (parentEntity.dataFields) {
          parentEntity.dataFields.forEach((dataField: any) => {
            commonDataFields.push(dataField.dbPath);
          });
        }
        if (parentEntity.linkFields) {
          parentEntity.linkFields.forEach((linkField: LinkField) => {
            commonLinkFields.push(linkField.path);
          });
        }

        if (parentEntity.idFields) {
          parentEntity.idFields.forEach((idField: any) => {
            commonIdFields.push(idField);
          });
        }
      }

      output += `${name} sub ${entity.extends ? entity.extends : 'entity'},\n`;
      const idsAsData: string[] = [];

      if (idFields && idFields.length > 0) {
        const setIds = new Set(idFields);
        const newIdFields = Array.from(setIds);
        const idFieldsString = newIdFields.map((field: string) => `${field}`).join(', ');
        if (!commonIdFields.includes(idFieldsString)) {
          output += `    owns ${idFieldsString} @key,\n`;
          idsAsData.push(idFieldsString);
        }
      }

      if (dataFields && dataFields.length > 0) {
        dataFields.forEach((field: any) => {
          if (!commonDataFields.includes(field.dbPath) && !idsAsData.includes(field.dbPath)) {
            output += `    owns ${field.dbPath},\n`;
          }
          usedAttributes.push({ dbPath: field.dbPath, contentType: field.contentType });
        });
      }

      if (linkFields && linkFields.length > 0) {
        const usedLinkFields: string[] = [];

        linkFields.forEach((linkField) => {
          const { relation, plays } = linkField;

          if (!commonLinkFields.includes(linkField.path) && !usedLinkFields.includes(`${relation}:${plays}`)) {
            output += `    plays ${relation}:${plays},\n`;
            usedLinkFields.push(`${relation}:${plays}`);
          }
        });
      }
      output = output.replace(/,\s*$/, ';\n');
      output += '\n';
    });

    // Convert relation declarations
    Object.keys(schema.relations).forEach((relationName) => {
      const relation = schema.relations[relationName];
      // @ts-expect-error
      const { idFields, dataFields, roles, name, linkFields } = relation;
      const commonDataFields: string[] = [];
      const commonLinkFields: string[] = [];
      const commonRoleFields: string[] = [];
      const commonIdFields: string[] = [];

      // If extended by parent, get rid of parent's declared attributes
      if (relation.extends) {
        const parentRelation = schema.relations[relation.extends];
        if (parentRelation.dataFields) {
          parentRelation.dataFields.forEach((dataField: any) => {
            commonDataFields.push(dataField.dbPath);
          });
        }
        if (parentRelation.linkFields) {
          parentRelation.linkFields.forEach((linkField: any) => {
            commonLinkFields.push(linkField.dbPath);
          });
        }
        if (parentRelation.roles) {
          const roleFields = Object.values(parentRelation.roles);
          roleFields.forEach((roleField: any) => {
            commonRoleFields.push(roleField.name);
          });
        }
        if (parentRelation.idFields) {
          parentRelation.idFields.forEach((idField: any) => {
            commonIdFields.push(idField);
          });
        }
      }

      output += `${name} sub ${relation.extends ? relation.extends : 'relation'},\n`;
      const idsAsData: string[] = [];
      if (idFields && idFields.length > 0) {
        const setIds = new Set(idFields);
        const newIdFields = Array.from(setIds);
        const idFieldsString = newIdFields.map((field: string) => `${field}`).join(', ');
        if (!commonIdFields.includes(idFieldsString)) {
          output += `    owns ${idFieldsString} @key,\n`;
          idsAsData.push(idFieldsString);
        }
      }

      if (dataFields && dataFields.length > 0) {
        dataFields.forEach((field: any) => {
          if (!commonDataFields.includes(field.dbPath) && !idsAsData.includes(field.dbPath)) {
            output += `    owns ${field.dbPath},\n`;
          }
          usedAttributes.push({ dbPath: field.dbPath, contentType: field.contentType });
        });
      }

      if (roles) {
        Object.keys(roles).forEach((roleName) => {
          if (!commonRoleFields.includes(roleName)) {
            output += `    relates ${roleName},\n`;
          }
        });
      }
      if (linkFields && linkFields.length > 0) {
        const usedLinkFields: string[] = [];
        linkFields.forEach((linkField) => {
          const { plays } = linkField;
          if (!commonLinkFields.includes(linkField.path) && !usedLinkFields.includes(`${relation}:${plays}`)) {
            output += `    plays ${linkField.relation}:${plays},\n`;
            usedLinkFields.push(`${relation}:${plays}`);
          }
        });
      }
      output = output.replace(/,\s*$/, ';\n');
      output += '\n';
    });
    let attributes = 'define\n\n';
    const newUsedAttributes = removeDuplicateObjects(usedAttributes);

    newUsedAttributes.forEach((attribute: Attribute) => {
      attributes += `${attribute.dbPath} sub attribute,\n`;

      if (attribute.contentType === 'TEXT' || attribute.contentType === 'ID') {
        attributes += `    value string;\n`;
      } else if (attribute.contentType === 'EMAIL') {
        attributes += `    value string,\n`;
        attributes += `    regex '^(?=.{1,64}@)[A-Za-z0-9_-]+(\\.[A-Za-z0-9_-]+)*@[^-][A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*(\\.[A-Za-z]{2,})$';\n`;
      } else if (attribute.contentType === 'DATE') {
        attributes += `    value datetime;\n`;
      } else if (attribute.contentType === 'BOOLEAN') {
        attributes += `    value boolean;\n`;
      } else if (attribute.contentType === 'NUMBER') {
        attributes += `    value long;\n`;
      }
    });

    return `${attributes}\n\n${output}`;
  }

  const typeDBString = convertSchema();
  const [connector] = testConfig.dbConnectors;
  const dbName = `define_test`;

  const client = TypeDB.coreClient(connector.url);
  await client.databases.create(dbName);

  const schemaSession = await client.session(dbName, SessionType.SCHEMA);
  const schemaTransaction = await schemaSession.transaction(TransactionType.WRITE);

  await schemaTransaction.query.define(typeDBString);

  await schemaTransaction.commit();
  await schemaTransaction.close();
  await schemaSession.close();
};
