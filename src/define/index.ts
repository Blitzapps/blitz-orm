import { BormConfig, BormSchema } from '../types';

export const bormDefine = (config: BormConfig, schema: BormSchema) => {
  console.log('config', config);
  console.log('schema', schema);
  // Define the function to convert Format 1 to Format 2
  function convertSchema(input: string) {
    // TODO: create "sub" helper func that works for each

    // converting data fields
    let output = input.replace(/export const (\w+): DataField = {\n([\s\S]*?)\n};/g, (_, name, fields) => {
      const properties = fields.replace(/(\w+):/g, '$1 sub attribute,');
      return `${name} sub attribute,\n${properties}`;
    });

    // converting link fields
    output = output.replace(/linkFields: \[\n([\s\S]*?)\n\s+]\n},/g, (_, fields) => {
      const relations = fields.replace(/(\w+):/g, '$1 sub relation,\n    relates');
      return `${relations};\n`;
    });

    // converting entities
    output = output.replace(/entities: {\n([\s\S]*?)\n\s+},/g, (_, entities) => {
      const declarations = entities.replace(/(\w+): {[\s\S]*?},/g, (__: any, entityName: any) => {
        const entity = __.replace(entityName, `${entityName} sub entity,`);
        return entity;
      });
      return declarations;
    });

    // converting relations
    output = output.replace(/relations: {\n([\s\S]*?)\n\s+},/g, (_, relations) => {
      const declarations = relations.replace(/(\w+): {[\s\S]*?},/g, (__: any, relationName: any) => {
        const relation = __.replace(relationName, `${relationName} sub relation,`);
        return relation;
      });
      return declarations;
    });
    console.log('in output', JSON.stringify(output, null, 2));

    return output;
  }

  const typeDBString = convertSchema(schema.toString());
  console.log('main output', JSON.stringify(typeDBString, null, 2));
};
