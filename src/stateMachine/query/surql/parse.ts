import { isArray, isDate, mapEntries } from 'radash';
import { sanitizeTableNameSurrealDb } from '../../../adapters/surrealDB/helpers';
import { getSchemaByThing } from '../../../helpers';
import type {
  BormConfig,
  ContentType,
  EnrichedBormSchema,
  EnrichedBQLQuery,
  EnrichedFieldQuery,
  EnrichedLinkQuery,
  EnrichedRoleQuery,
} from '../../../types';
import { FieldSchema, QueryPath } from '../../../types/symbols';

export const parse = (props: {
  res: Record<string, any>[][];
  queries: EnrichedBQLQuery[];
  schema: EnrichedBormSchema;
  config: BormConfig;
}) => {
  const { res, queries, schema } = props;
  //console.log('res!', JSON.stringify(res, null, 2));
  const result = res.map((r, i) => parseRes(queries[i], r, schema));
  //console.log('result', result);
  return result;
};

const parseRes = (
  query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery,
  res: Record<string, any>[],
  schema: EnrichedBormSchema,
) => {
  if (isArray(res)) {
    if (res.length === 0) {
      return null;
    }
    if (query.$filterByUnique) {
      if (res.length > 1) {
        throw new Error('Multiple results found for unique query');
      }
      return parseObj(query, res[0], schema);
    }
    if (res.length >= 1) {
      return res.map((r) => parseObj(query, r, schema));
    }
  } else {
    throw new Error('res is unexpectedly not an array');
  }
};

const parseObj = (
  query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery,
  obj: Record<string, any>,
  schema: EnrichedBormSchema,
) => {
  // eslint-disable-next-line prefer-destructuring
  const $thing = obj.$thing || obj.tb;
  const $thingType = $thing in schema.entities ? 'entity' : $thing in schema.relations ? 'relation' : 'error';
  if ($thingType === 'error') {
    throw new Error(`[Internal] The $thing ${$thing} is not defined in the schema.`);
  }

  const newObj: Record<string, any> = {
    //init with symbols
    [QueryPath]: obj.$$queryPath,
    $id: obj.$id,
    $thing: sanitizeTableNameSurrealDb($thing),
    $thingType, //This is actually not true always, will need to be fetched from the $thing
  };

  // For normal fields, we parse each field classically
  query.$fields.forEach((f) => {
    const key = f.$as;
    const value = obj[key];
    // TODO: Look up what the id field is in the schema.
    if (f.$path === 'id' && query.$idNotIncluded) {
      return;
    }
    newObj[key] = parseFieldResult(f, value, schema);
  });

  return newObj;
};

const parseFieldResult = (query: EnrichedFieldQuery, value: any, schema: EnrichedBormSchema) => {
  if (value === undefined || value === null || (isArray(value) && value.length === 0)) {
    return null;
  }

  if (query.$fieldType === 'data') {
    const { contentType /*,cardinality*/ } = query[FieldSchema];

    return parseValue(value, contentType) ?? null;
  }
  if (query.$fieldType === 'ref') {
    const asArray = isArray(value) ? value : [value];
    const parsedContent = asArray.map((v) => {
      if (v.$thing) {
        const currentSchema = getSchemaByThing(schema, v.$thing);
        const [idField] = currentSchema.idFields;
        //console.log('currentSchema!', currentSchema);
        if (query.$justId) {
          return v.$id;
        }
        //todo: We will fix this once surrealDB enables some sort of SELECT ( SELECT * FROM $parent.*). Meanwhile we can only query one nested level
        const flatNestedField = (nf: unknown) => {
          if (nf && typeof nf === 'object' && 'id' in nf && 'tb' in nf) {
            return nf.id;
          }
          //todo: This is a value, and we might need to parse it correctly. We know the schema and the key, so we can do it.
          return nf;
        };
        const temporallyFlatNestedIds = mapEntries(v, (key, content) => {
          if (isArray(content)) {
            return [key, content.map((i) => flatNestedField(i))];
          }
          return [key, flatNestedField(content)];
        });

        return {
          ...temporallyFlatNestedIds,
          [QueryPath]: v.$$queryPath,
          [idField]: v.$id, //todo: this is a hack. But we should add this always!
        };
      }
      if (v.$value) {
        return parseValue(v.$value, 'FLEX');
      }
      return v; //in cardinality many the query returns the values already. Todo: To optimize this we can remove the $value when cardinality MANY or find a smarter solution
    });
    const { cardinality } = query[FieldSchema];
    if (cardinality === 'ONE') {
      //not filterByUnique because we can't filter inside a refField
      return parsedContent[0];
    }
    return parsedContent;
  }

  if (query.$justId) {
    if (query.$filterByUnique || query[FieldSchema].cardinality === 'ONE') {
      // TODO: Look up what the id field is in the schema.
      //return isArray(value) ? value[0]?.id : value?.id; //RefFields receive direct
      return value[0]?.$id ?? null;
    }
    return value?.map((i: Record<string, any>) => i.$id) ?? [];
  }
  if (query.$filterByUnique || query[FieldSchema].cardinality === 'ONE') {
    return parseObj(query, value[0], schema);
  }
  return parseRes(query, value, schema);
};

const parseValue = (value: unknown, contentType: ContentType) => {
  const asArray = isArray(value) ? value : [value];
  if (contentType === 'DATE') {
    const res = asArray.map((v) => new Date(v).toISOString());
    return isArray(value) ? res : res[0];
  }
  if (contentType === 'FLEX') {
    const res = asArray.map((v) => {
      if (isDate(v)) {
        return new Date(v).toISOString(); //Todo: in the future probably just return the date object instead, but we need to fix it in typedb.
      }
      return v;
    });
    return isArray(value) ? res : res[0];
  }
  return value;
};
