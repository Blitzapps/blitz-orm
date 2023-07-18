import { BormConfig, BormSchema } from '../types';

export const bormDefine = (config: BormConfig, schema: BormSchema) => {
  console.log('schema', schema);
  // TODO: cases for shared, owned privately, extends
  function convertSchema() {
    // getting attributes from entities
    let output = '';
    const usedAttributes = new Set<string>();
    Object.keys(schema.entities).forEach((entityName) => {
      const entity = schema.entities[entityName];
      const { idFields, dataFields, linkFields } = entity;

      if (idFields && idFields.length > 0) {
        idFields.forEach((field: string) => usedAttributes.add(field));
      }

      if (dataFields && dataFields.length > 0) {
        dataFields.forEach((field: any) => {
          usedAttributes.add(field.name);
        });
      }

      if (linkFields && linkFields.length > 0) {
        linkFields.forEach((linkField: any) => {
          usedAttributes.add(linkField.relation);
          usedAttributes.add(linkField.plays);
          usedAttributes.add(linkField.target);
        });
      }
    });

    // getting attributes from relations
    Object.keys(schema.relations).forEach((relationName) => {
      const relation = schema.relations[relationName];
      const { idFields, dataFields, roles } = relation;

      if (idFields && idFields.length > 0) {
        idFields.forEach((field: string) => usedAttributes.add(field));
      }

      if (dataFields && dataFields.length > 0) {
        dataFields.forEach((field: any) => {
          // @ts-ignore
          usedAttributes.add(field.name);
        });
      }

      if (roles) {
        Object.keys(roles).forEach((roleName) => {
          usedAttributes.add(roleName);
        });
      }
    });

    // Adding attributes
    usedAttributes.forEach((attribute) => {
      console.log({ attribute });
      output += `${attribute} sub attribute`;

      if (attribute && attribute.includes('·')) {
        const [entity, attr] = attribute.split('·');
        output += `, value ${entity}, ${attr}`;
      } else if (attribute === 'email') {
        output += `, abstract`;
      } else if (attribute === 'Session·expires') {
        output += `,\n    value datetime`;
      } else {
        output += `, value string`;
      }

      output += ';\n';
    });

    output += '\n';

    Object.keys(schema.entities).forEach((entityName) => {
      const entity = schema.entities[entityName];
      // @ts-expect-error
      const { idFields, dataFields, linkFields, name } = entity;

      output += `${name} sub entity,\n`;

      if (idFields && idFields.length > 0) {
        const idFieldsString = idFields.map((field: string) => `'${field}'`).join(', ');
        output += `    owns ${idFieldsString} @key,\n`;
      }

      if (dataFields && dataFields.length > 0) {
        dataFields.forEach((field: any) => {
          output += `    owns ${field.dbPath},\n`;
        });
      }

      if (linkFields && linkFields.length > 0) {
        linkFields.forEach((linkField) => {
          const { relation, plays, target } = linkField;
          output += `    plays ${relation}:${plays},\n`;
          output += `    relates ${target},\n`;
        });
      }

      output += '\n';
    });

    // Convert relation declarations
    Object.keys(schema.relations).forEach((relationName) => {
      const relation = schema.relations[relationName];
      // @ts-expect-error
      const { idFields, dataFields, roles, name } = relation;

      output += `${name} sub relation,\n`;

      if (idFields && idFields.length > 0) {
        const idFieldsString = idFields.map((field: string) => `'${field}'`).join(', ');
        output += `    owns ${idFieldsString} @key,\n`;
      }

      if (dataFields && dataFields.length > 0) {
        dataFields.forEach((field: any) => {
          output += `    owns ${field.dbPath},\n`;
        });
      }

      if (roles) {
        Object.keys(roles).forEach((roleName) => {
          const role = roles[roleName];
          const { cardinality } = role;
          output += `    relates ${roleName}, #cardinality: ${cardinality}\n`;
        });
      }

      output += '\n';
    });

    return output;
  }

  const typeDBString = convertSchema();
  console.log('main output', JSON.stringify(typeDBString, null, 2));
};
