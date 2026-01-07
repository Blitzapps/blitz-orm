/* eslint-disable no-param-reassign */
import type { Draft } from 'immer';
import { current, isDraft, produce } from 'immer';
import { customAlphabet } from 'nanoid';
import type { TraversalCallbackContext, TraversalMeta } from 'object-traversal';
import { getNodeByPath, traverse } from 'object-traversal';
import { isArray, isObject, listify, tryit } from 'radash';

// todo: split helpers between common helpers, typeDBhelpers, dgraphelpers...
import type {
  BormSchema,
  BQLMutationBlock,
  EnrichedBormEntity,
  EnrichedBormRelation,
  EnrichedBormSchema,
  EnrichedDataField,
  EnrichedLinkField,
  EnrichedRefField,
  EnrichedRoleField,
  FilledBQLMutationBlock,
  PositiveFilter,
  RawBQLQuery,
  ThingType,
} from './types';

export const oFind = <RemovedKeys extends string, T extends Record<string | number | symbol, any>>(
  obj: T,
  fn: (k: string | number | symbol, v: any) => boolean,
): Omit<T, RemovedKeys>[Exclude<keyof T, RemovedKeys>] =>
  Object.values(Object.fromEntries(Object.entries(obj).filter(([k, v]) => fn(k, v))))[0];

export const oFilter = <K extends string | number | symbol, T extends Record<K, any>>(
  obj: T,
  fn: (k: K, v: any) => boolean,
): Partial<T> => {
  const entries = Reflect.ownKeys(obj).map((key) => [key, obj[key as keyof T]]);
  return Object.fromEntries(
    entries.filter(([k, v]) => {
      const [error, result] = tryit(() => fn(k as K, v))();
      return error ? false : result;
    }),
  ) as Partial<T>;
};

export const getSchemaByThing = (
  schema: BormSchema | EnrichedBormSchema,
  $thing: string,
): EnrichedBormEntity | EnrichedBormRelation => {
  if ($thing in schema.entities) {
    return schema.entities[$thing] as EnrichedBormEntity;
  }
  if ($thing in schema.relations) {
    return schema.relations[$thing] as EnrichedBormRelation;
  }
  throw new Error(`${$thing} is not defined in the schema`);
};

export const getCurrentSchema = (
  schema: BormSchema | EnrichedBormSchema,
  node: Partial<BQLMutationBlock>,
): EnrichedBormEntity | EnrichedBormRelation => {
  if (!node) {
    throw new Error('[Internal] No node for getCurrentSchema');
  }
  if (node.$thing) {
    if (node.$thingType === 'entity') {
      if (!(node.$thing in schema.entities)) {
        throw new Error(`Missing entity '${node.$thing}' in the schema`);
      }
      return schema.entities[node.$thing] as EnrichedBormEntity;
    }
    if (node.$thingType === 'relation') {
      if (!(node.$thing in schema.relations)) {
        throw new Error(`Missing relation '${node.$thing}' in the schema`);
      }
      return schema.relations[node.$thing] as EnrichedBormRelation;
    }
    // TODO: This should be validated during the initialization
    if (node.$thing in schema.entities && node.$thing in schema.relations) {
      throw new Error(`Ambiguous $thing ${node.$thing}`);
    }
    if (node.$thing in schema.entities) {
      return schema.entities[node.$thing] as EnrichedBormEntity;
    }
    if (node.$thing in schema.relations) {
      return schema.relations[node.$thing] as EnrichedBormRelation;
    }
    throw new Error(`Wrong schema or query for ${JSON.stringify(node, null, 2)}`);
  }

  //! Todo: delete when this works with the new $thing and $thingType fields
  if (node.$entity) {
    if (!(node.$entity in schema.entities)) {
      throw new Error(`Missing entity '${node.$entity}' in the schema`);
    }
    return schema.entities[node.$entity] as EnrichedBormEntity;
  }
  if (node.$relation) {
    if (!(node.$relation in schema.relations)) {
      throw new Error(`Missing relation '${node.$relation}' in the schema`);
    }
    return schema.relations[node.$relation] as EnrichedBormRelation;
  }
  throw new Error(`Wrong schema or query for ${JSON.stringify(node, null, 2)}`);
};

export const getFieldType = (
  currentSchema: EnrichedBormRelation | EnrichedBormEntity,
  key: string,
): ['idField' | 'dataField' | 'linkField' | 'roleField', EnrichedDataField | EnrichedLinkField | EnrichedRoleField] => {
  const dataFieldSchema = currentSchema.dataFields?.find((dataField: any) => dataField.path === key);

  if (currentSchema.idFields?.includes(key)) {
    if (!dataFieldSchema) {
      throw new Error(`Field ${key} is an idField but not a dataField in schema`);
    }
    return ['idField', dataFieldSchema];
  }
  if (dataFieldSchema) {
    return ['dataField', dataFieldSchema];
  }
  const linkFieldSchema = currentSchema.linkFields?.find((linkField: any) => linkField.path === key);
  if (linkFieldSchema) {
    return ['linkField', linkFieldSchema];
  }
  const roleFieldSchema = 'roles' in currentSchema ? currentSchema.roles[key] : undefined;
  if (roleFieldSchema) {
    return ['roleField', roleFieldSchema];
  }
  throw new Error(`Field ${key} not found in schema, Defined in $filter`);
};
export const getIdFieldKey = (schema: EnrichedBormSchema, node: Partial<BQLMutationBlock>) => {
  const currentSchema = getCurrentSchema(schema, node);
  if (currentSchema?.idFields?.length && currentSchema?.idFields?.length > 1) {
    throw new Error(`Multiple ids not yet enabled / composite ids: ${currentSchema?.idFields}`);
  }

  const [idField] = currentSchema.idFields; //todo composed ids
  return idField;
};

export const getThingType = (rootNode: BQLMutationBlock, schema: EnrichedBormSchema): ThingType => {
  const thing = rootNode.$thing || rootNode.$entity || rootNode.$relation;
  if (!thing) {
    throw new Error('[Internal] No thing found');
  }
  if (rootNode.$entity) {
    return 'entity';
  }
  if (rootNode.$relation) {
    return 'relation';
  }
  if (schema.entities[thing]) {
    return 'entity';
  }
  if (schema.relations[thing]) {
    return 'relation';
  }
  throw new Error('No thing found');
};

export const getFieldSchema = (
  schema: EnrichedBormSchema,
  node: Partial<BQLMutationBlock>,
  field: string,
): EnrichedDataField | EnrichedLinkField | EnrichedRoleField | EnrichedRefField => {
  const currentSchema = getCurrentSchema(schema, node);
  const foundLinkField = currentSchema.linkFields?.find((lf) => lf.path === field);
  if (foundLinkField) {
    return foundLinkField as EnrichedLinkField;
  }
  const foundDataField = currentSchema.dataFields?.find((lf) => lf.path === field);
  if (foundDataField) {
    return foundDataField as EnrichedDataField;
  }
  const foundRoleField = 'roles' in currentSchema ? currentSchema.roles?.[field] : undefined;
  if (foundRoleField) {
    return foundRoleField as EnrichedRoleField;
  }
  const foundRefField = 'refFields' in currentSchema ? currentSchema.refFields?.[field] : undefined;
  if (foundRefField) {
    return foundRefField as EnrichedRefField;
  }
  throw new Error(`Field ${field} not found in schema`);
};

export const getCardinality = (
  schema: EnrichedBormSchema,
  node: Partial<BQLMutationBlock>,
  field: string,
): 'ONE' | 'MANY' | 'INTERVAL' | undefined => {
  const currentFieldSchema = getFieldSchema(schema, node, field);
  return currentFieldSchema?.cardinality;
};

type ReturnTypeWithoutNode = {
  fields: string[];
  dataFields: string[];
  roleFields: string[];
  linkFields: string[];
  refFields: string[];
};

type ReturnTypeWithNode = ReturnTypeWithoutNode & {
  usedFields: string[];
  usedRoleFields: string[];
  usedLinkFields: string[];
  usedDataFields: string[];
  usedRefFields: string[];
  unidentifiedFields: string[];
};

// todo: do something so this enriches the query so no need to call it multiple times
export const getCurrentFields = <T extends (BQLMutationBlock | RawBQLQuery) | undefined>(
  currentSchema: EnrichedBormEntity | EnrichedBormRelation,
  node?: T,
): T extends undefined ? ReturnTypeWithoutNode : ReturnTypeWithNode => {
  const availableDataFields = currentSchema.dataFields?.map((x) => x.path) || [];
  const availableLinkFields = currentSchema.linkFields?.map((x) => x.path) || [];
  const availableRefFields = 'refFields' in currentSchema ? listify(currentSchema.refFields, (k: string) => k) : [];
  const availableRoleFields = 'roles' in currentSchema ? listify(currentSchema.roles, (k: string) => k) : [];
  const availableFields = [
    ...(availableDataFields || []),
    ...(availableLinkFields || []),
    ...(availableRoleFields || []),
    ...(availableRefFields || []),
  ];

  // spot non existing fields
  const reservedRootFields = [
    '$entity',
    '$op',
    '$id',
    '$tempId',
    '$bzId',
    '$relation',
    '$parentKey', //todo: this is not a valid one, to delete and migrate to symbol!
    '$filter',
    '$fields',
    '$excludedFields',
    '$thing',
    '$thingType',
  ];

  const allowedFields = [...reservedRootFields, ...availableFields];

  if (!node) {
    return {
      fields: availableFields,
      dataFields: availableDataFields,
      roleFields: availableRoleFields,
      linkFields: availableLinkFields,
    } as ReturnTypeWithNode;
  }
  const usedFields = node.$fields
    ? //queries
      (node.$fields.map((x: string | { $path: string }) => {
        if (typeof x === 'string') {
          if (x.startsWith('$') || x.startsWith('%')) {
            return undefined;
          }
          if (!availableFields.includes(x)) {
            throw new Error(`Field ${x} not found in the schema`);
          }
          return x;
        }
        if ('$path' in x && typeof x.$path === 'string') {
          return x.$path;
        }
        throw new Error('[Wrong format] Wrongly structured query');
      }) as string[])
    : //mutations
      (listify<any, string, any>(node, (k: string) => {
        if (k.startsWith('$') || k.startsWith('%')) {
          return undefined;
        }
        if (!availableFields.includes(k)) {
          throw new Error(`[Schema] Field ${k} not found in the schema`);
        }
        return k;
      }).filter((x) => x !== undefined) as string[]);

  const localFilterFields = !node.$filter
    ? []
    : listify(node.$filter as PositiveFilter, (k: string) =>
        k.toString().startsWith('$') ? undefined : k.toString(),
      ).filter((x) => x && availableDataFields?.includes(x));
  const nestedFilterFields = !node.$filter
    ? []
    : listify(node.$filter as PositiveFilter, (k: string) =>
        k.toString().startsWith('$') ? undefined : k.toString(),
      ).filter((x) => x && [...(availableRoleFields || []), ...(availableLinkFields || [])]?.includes(x));

  const unidentifiedFields = [...usedFields, ...localFilterFields]
    .filter((x) => !x?.startsWith('%'))
    // @ts-expect-error - TODO description
    .filter((x) => !allowedFields.includes(x))
    .filter((x) => x) as string[]; // todo 🤔
  const localFilters = !node.$filter ? {} : oFilter(node.$filter, (k: string, _v) => localFilterFields.includes(k));
  const nestedFilters = !node.$filter ? {} : oFilter(node.$filter, (k: string, _v) => nestedFilterFields.includes(k));

  return {
    fields: availableFields,
    dataFields: availableDataFields,
    roleFields: availableRoleFields,
    linkFields: availableLinkFields,
    refFields: availableRefFields,
    usedFields,
    usedLinkFields: availableLinkFields.filter((x) => usedFields.includes(x)),
    usedRoleFields: availableRoleFields.filter((x) => usedFields.includes(x)),
    usedDataFields: availableDataFields.filter((x) => usedFields.includes(x)),
    usedRefFields: availableRefFields.filter((x) => usedFields.includes(x)),
    unidentifiedFields,
    ...(localFilterFields.length ? { localFilters } : {}),
    ...(nestedFilterFields.length ? { nestedFilters } : {}),
  } as ReturnTypeWithNode;
};

/*
export const arrayAt = <T>(arr: T[] | undefined, index: number): T | undefined => {
	if (arr === undefined || !Array.isArray(arr) || index < -arr.length || index >= arr.length) {
		return undefined;
	}
	return arr[index < 0 ? arr.length + index : index];
};*/

export const notNull = <TValue>(value: TValue | null): value is TValue => {
  return value !== null;
};

export const extractChildEntities = (entities: EnrichedBormSchema['entities'], parentEntity: string) => {
  return Object.values(entities).reduce((acc: string[], value) => {
    if (value.extends === parentEntity) {
      acc.push(value.name);
    }
    return acc;
  }, []);
};

export const capitalizeFirstLetter = (string: string) => {
  if (typeof string !== 'string') {
    throw new Error('capitalizeFirstLetter: string is not a string');
  }
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

export const getParentNode = (blocks: Record<any, any>, parent: any, meta: TraversalMeta) => {
  const currentPath = meta.nodePath || '';
  const pathParts = currentPath.split('.');
  const parentPath = isArray(parent)
    ? pathParts
        .slice(0, -2)
        .join('.') // Remove last two parts for an array parent
    : pathParts.slice(0, -1).join('.'); // Remove only the last part for a non-array parent
  return parent ? getNodeByPath(blocks, parentPath) : {}; //undefined parent for root
};

export const getSymbols = (oldBlock: Partial<FilledBQLMutationBlock>): Record<symbol, any> => {
  return Reflect.ownKeys(oldBlock)
    .filter((key): key is symbol => typeof key === 'symbol')
    .reduce(
      (symbols, symbolKey) => {
        //@ts-expect-error - TODO
        // eslint-disable-next-line no-param-reassign
        symbols[symbolKey] = oldBlock[symbolKey];
        return symbols;
      },
      {} as Record<symbol, any>,
    );
};

export const normalPropsCount = (obj: Record<string, any>) => {
  return Object.keys(obj).filter((key) => !key.startsWith('$')).length;
};

export const isBQLBlock = (block: unknown): block is FilledBQLMutationBlock => {
  return isObject(block) && ('$entity' in block || '$relation' in block || '$thing' in block);
};

type Drafted<T> = T | Draft<T>;

// Recursively define the type to handle nested structures
type DeepCurrent<T> =
  T extends Array<infer U> ? Array<DeepCurrent<U>> : T extends object ? { [K in keyof T]: DeepCurrent<T[K]> } : T;

export const deepCurrent = <T>(obj: Drafted<T>): any => {
  if (Array.isArray(obj)) {
    // Explicitly cast the return type for arrays
    return obj.map((item) => current(item)) as DeepCurrent<T>;
  }
  if (obj && typeof obj === 'object') {
    // Handle non-null objects
    const plainObject = isDraft(obj) ? current(obj) : obj;
    const result: any = {};
    for (const [key, value] of Object.entries(plainObject)) {
      // Use the key to dynamically assign the converted value
      result[key] = isDraft(value) ? current(value) : value;
    }
    // Explicitly cast the return type for objects
    return result as DeepCurrent<T>;
  }
  // Return the value directly for non-objects and non-arrays
  return obj as DeepCurrent<T>;
};

export const assertDefined = <T>(value?: T, msg?: string): T => {
  if (value === undefined) {
    if (msg) {
      throw new Error(msg);
    }
    throw new Error('Value is undefined');
  }
  return value;
};

export const indent = (line: string, depth: number) => {
  let _indent = '';
  for (let i = 0; i < depth; i++) {
    _indent += '  ';
  }
  return `${_indent}${line}`;
};

export const genId = (n?: number) => {
  const idLength = n ?? 21;
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, idLength);
  return nanoid();
};

export const genAlphaId = (length = 5): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, length);
  return nanoid();
};

export const deepRemoveMetaData = (obj: object) => {
  const removeMeta = ({ value }: TraversalCallbackContext) => {
    if (value && typeof value === 'object' && '$id' in value) {
      const metas = Object.keys(value).filter((k) => k.startsWith('$'));
      for (const k of metas) {
        delete value[k];
      }
    }
    return value;
  };
  return produce(obj, (draft) => traverse(draft, removeMeta));
};
