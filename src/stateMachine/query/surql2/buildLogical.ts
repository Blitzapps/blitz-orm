import z from 'zod/v4';
import {
  type BQLField,
  type BQLFilter,
  type BQLFilterValue,
  type BQLFilterValueList,
  type BQLQuery,
  type NestedBQLFilter,
  NestedBQLFilterParser,
  StrictBQLValueFilterParser,
} from '../../../types/requests/parser';
import type {
  DRAFT_EnrichedBormDataField,
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormField,
  DRAFT_EnrichedBormLinkField,
  DRAFT_EnrichedBormRefField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormRoleField,
  DRAFT_EnrichedBormSchema,
} from '../../../types/schema/enriched.draft';
import type {
  DataSource,
  Filter,
  ListFilter,
  LogicalQuery,
  Projection,
  ProjectionField,
  ScalarFilter,
  Sort,
} from './logical';

export const buildLogicalQuery = (
  query: BQLQuery,
  schema: DRAFT_EnrichedBormSchema,
  metadata: boolean,
): LogicalQuery => {
  const thingSchema = schema[query.$thing];
  const projection = buildProjection({ fields: query.$fields, thing: thingSchema, schema, metadata });
  const filter = query.$filter ? buildFilter(query.$filter, thingSchema, schema) : undefined;
  const ids = Array.isArray(query.$id) ? query.$id : query.$id ? [query.$id] : [];
  const cardinality = ids.length === 1 || isUniqueFilter(thingSchema, filter) ? 'ONE' : 'MANY';
  const source: DataSource =
    ids.length > 0
      ? {
          type: 'record_pointer',
          thing: [thingSchema.name, ...thingSchema.subTypes],
          ids,
        }
      : {
          type: 'table_scan',
          thing: [thingSchema.name, ...thingSchema.subTypes],
        };

  return {
    source,
    projection,
    filter,
    limit: validateLimit(query.$limit),
    offset: validateOffset(query.$offset),
    sort: validateSort(projection, buildSort(query.$sort)),
    cardinality,
  };
};

const buildProjection = (params: {
  fields?: BQLField[];
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation;
  schema: DRAFT_EnrichedBormSchema;
  metadata: boolean;
}): Projection => {
  const { fields, thing, schema, metadata } = params;
  const projectionFields: ProjectionField[] = [];

  if (metadata) {
    projectionFields.push({
      type: 'metadata',
      path: '$id',
    });
    projectionFields.push({
      type: 'metadata',
      path: '$thing',
    });
  }

  // No fields specified. Project all fields.
  if (!fields) {
    for (const field of Object.values(thing.fields)) {
      projectionFields.push(buildSimpleFieldProjection(field));
    }
    return { fields: projectionFields };
  }

  for (const field of fields) {
    if (typeof field === 'string') {
      if (field === '$id' || field === '$thing') {
        projectionFields.push({
          type: 'metadata',
          path: field,
        });
        continue;
      }

      const fieldSchema = thing.fields[field];
      if (!fieldSchema) {
        throw new Error(`Field ${field} not found in ${thing.name}`);
      }
      projectionFields.push(buildSimpleFieldProjection(fieldSchema));
      continue;
    }

    if (field.$path === '$id' || field.$path === '$thing') {
      projectionFields.push({
        type: 'metadata',
        path: field.$path,
        alias: field.$as,
      });
      continue;
    }

    const fieldSchema = thing.fields[field.$path];
    if (!fieldSchema) {
      throw new Error(`Field ${field} not found in ${thing.name}`);
    }

    if (fieldSchema.type === 'constant' || fieldSchema.type === 'computed') {
      continue;
    }

    if (fieldSchema.type === 'data' || fieldSchema.type === 'ref') {
      projectionFields.push(buildSimpleFieldProjection(fieldSchema, field.$as));
      continue;
    }

    const oppositeThingSchema = schema[fieldSchema.opposite.thing];
    const oppositeProjection = buildProjection({ fields: field.$fields, thing: oppositeThingSchema, schema, metadata });
    const filter =
      '$filter' in field && field.$filter ? buildFilter(field.$filter, oppositeThingSchema, schema) : undefined;
    projectionFields.push({
      type: 'nested_reference',
      path: field.$path,
      projection: oppositeProjection,
      cardinality:
        typeof field.$id === 'string' || isUniqueFilter(oppositeThingSchema, filter) ? 'ONE' : fieldSchema.cardinality,
      alias: field.$as,
      ids: typeof field.$id === 'string' ? [field.$id] : field.$id,
      filter,
      limit: validateLimit(field.$limit),
      offset: validateOffset(field.$offset),
      sort: validateSort(oppositeProjection, buildSort(field.$sort)),
    });
  }

  return {
    fields: projectionFields,
  };
};

const buildSimpleFieldProjection = (field: DRAFT_EnrichedBormField, alias?: string): ProjectionField => {
  if (field.type === 'data') {
    return {
      type: 'data',
      path: field.name,
      alias,
    };
  }
  if (field.type === 'ref' && field.contentType === 'FLEX') {
    return {
      type: 'flex',
      path: field.name,
      cardinality: field.cardinality,
      alias,
    };
  }
  return {
    type: 'reference',
    path: field.name,
    cardinality: field.cardinality,
    alias,
  };
};

const buildFilter = (
  filter: BQLFilter | BQLFilter[],
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  schema: DRAFT_EnrichedBormSchema,
): Filter | undefined => {
  if (Array.isArray(filter)) {
    const filters = filter.map((f) => buildFilter(f, thing, schema)).filter((f) => !!f);
    return {
      type: 'or',
      filters: filters,
    };
  }

  const filters = buildFilters(filter, thing, schema);
  return {
    type: 'and',
    filters,
  };
};

const buildFilters = (
  filter: BQLFilter,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  schema: DRAFT_EnrichedBormSchema,
): Filter[] => {
  return Object.entries(filter)
    .map(([key, value]): Filter | undefined => {
      if (key === '$not' && filter.$not) {
        return buildNotFilter(filter.$not, thing, schema);
      }

      if (key === '$or' && filter.$or) {
        return buildOrFilter(filter.$or, thing, schema);
      }

      const fieldSchema = thing.fields[key];

      if (!fieldSchema) {
        throw new Error(`Field ${key} not found in ${thing.name}`);
      }

      if (fieldSchema.type === 'constant' || fieldSchema.type === 'computed') {
        throw new Error(`Filtering on constant or computed field ${key} is not supported`);
      }

      if (value === undefined) {
        return undefined;
      }

      if (fieldSchema.type === 'data') {
        return buildDataFieldFilter(fieldSchema, value as BQLFilterValue | BQLFilterValueList | NestedBQLFilter);
      }

      if (fieldSchema.type === 'ref') {
        return buildRefFieldFilter(fieldSchema, value);
      }

      return buildLinkFieldFilter(fieldSchema, value, schema);
    })
    .filter((f): f is Filter => f !== undefined);
};

const buildNotFilter = (
  $not: BQLFilter,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  schema: DRAFT_EnrichedBormSchema,
): Filter | undefined => {
  const inner = buildFilter($not, thing, schema);
  return inner
    ? {
        type: 'not',
        filter: inner,
      }
    : undefined;
};

const buildOrFilter = (
  $or: BQLFilter[],
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  schema: DRAFT_EnrichedBormSchema,
): Filter | undefined => {
  return buildFilter($or, thing, schema);
};

const buildDataFieldFilter = (
  field: DRAFT_EnrichedBormDataField,
  filter: BQLFilterValue | BQLFilterValueList | NestedBQLFilter,
): Filter => {
  // No-sub field. Only scalar and list filters are allowed.
  // If `right` is not of the same type as the field, the query will return an empty result.
  // Ideally SurrealDB's query planner should skip the query.

  // scalar and list operators
  const result = StrictBQLValueFilterParser.safeParse(filter);
  if (result.success) {
    const filters: Filter[] = [];
    for (const [op, right] of Object.entries(result.data)) {
      if (op === '$exists') {
        filters.push({
          type: 'null',
          op: right ? 'IS NOT' : 'IS',
          left: field.name,
          tunnel: false,
        });
        continue;
      }
      if ((op === '$eq' || op === '$ne') && right === null) {
        filters.push({
          type: 'null',
          op: op === '$eq' ? 'IS' : 'IS NOT',
          left: field.name,
          tunnel: false,
        });
        continue;
      }
      const scalarOp = scalarOpMap[op];
      if (scalarOp) {
        filters.push({
          type: 'scalar',
          op: scalarOp,
          left: field.name,
          right: right as BQLFilterValue,
        });
        continue;
      }
      const listOp = listOpMap[op];
      if (listOp) {
        filters.push({
          type: 'list',
          op: listOp,
          left: field.name,
          right: right as BQLFilterValueList,
        });
        continue;
      }
      throw new Error(`Invalid filter operation: ${op}`);
    }
    return {
      type: 'and',
      filters,
    };
  }

  // List value
  if (Array.isArray(filter)) {
    if (field.cardinality === 'ONE') {
      return {
        type: 'list',
        op: 'IN',
        left: field.name,
        right: filter,
      };
    }

    return {
      type: 'list',
      op: 'CONTAINSANY',
      left: field.name,
      right: filter,
    };
  }

  // Single value
  if (field.cardinality === 'ONE') {
    if (filter === null) {
      return {
        type: 'null',
        op: 'IS',
        left: field.name,
        tunnel: false,
      };
    }
    return {
      type: 'scalar',
      op: '=',
      left: field.name,
      right: filter as BQLFilterValue,
    };
  }

  return {
    type: 'scalar',
    op: 'CONTAINS',
    left: field.name,
    right: filter as BQLFilterValue,
  };
};

const buildRefFieldFilter = (
  field: DRAFT_EnrichedBormRefField,
  filter: BQLFilterValue | BQLFilterValueList | NestedBQLFilter | BQLFilter[],
): Filter | undefined => {
  if (field.contentType === 'REF') {
    if (field.cardinality === 'ONE') {
      if (typeof filter === 'string') {
        return {
          type: 'ref',
          op: 'IN',
          left: field.name,
          right: [filter],
          tunnel: false,
        };
      }
      if (StringArrayParser.safeParse(filter).success) {
        return {
          type: 'ref',
          op: 'IN',
          left: field.name,
          right: filter as string[],
          tunnel: false,
        };
      }
      throw new Error(`Invalid filter value for ref field ${field.name}: ${JSON.stringify(filter)}`);
    }
    if (typeof filter === 'string') {
      return {
        type: 'ref',
        op: 'CONTAINSANY',
        left: field.name,
        right: [filter],
        tunnel: false,
      };
    }
    if (StringArrayParser.safeParse(filter).success) {
      return {
        type: 'ref',
        op: 'CONTAINSANY',
        left: field.name,
        right: filter as string[],
        tunnel: false,
      };
    }
    throw new Error(`Invalid filter value for ref field ${field.name}: ${JSON.stringify(filter)}`);
  }
  // The cast can't be determined.
  throw new Error('Filtering by FLEX reference is not supported');
};

const buildLinkFieldFilter = (
  field: DRAFT_EnrichedBormLinkField | DRAFT_EnrichedBormRoleField,
  filter: BQLFilterValue | BQLFilterValueList | NestedBQLFilter | BQLFilter[],
  schema: DRAFT_EnrichedBormSchema,
): Filter => {
  const tunnel = field.type === 'link' && field.target === 'role';

  if (filter === null) {
    return {
      type: 'null',
      op: 'IS',
      left: field.name,
      tunnel,
    };
  }

  if (typeof filter === 'string') {
    return {
      type: 'ref',
      op: field.cardinality === 'ONE' ? 'IN' : 'CONTAINSANY',
      left: field.name,
      right: [filter],
      tunnel,
    };
  }

  if (StringArrayParser.safeParse(filter).success) {
    return {
      type: 'ref',
      op: field.cardinality === 'ONE' ? 'IN' : 'CONTAINSANY',
      left: field.name,
      right: filter as string[],
      tunnel,
    };
  }

  const nestedFilter = z.union([NestedBQLFilterParser, z.array(NestedBQLFilterParser)]).safeParse(filter);

  if (nestedFilter.error) {
    throw new Error(`Invalid nested filter: ${nestedFilter.error.message}`);
  }

  const oppositeThingSchema = schema[field.opposite.thing];

  if (!oppositeThingSchema) {
    throw new Error(`Opposite thing ${field.opposite.thing} not found`);
  }

  const oppositeThings: [string, ...string[]] = [field.opposite.thing, ...oppositeThingSchema.subTypes];

  if (Array.isArray(nestedFilter.data)) {
    const filters = nestedFilter.data.map((f) => buildLinkFieldFilter(field, f, schema));
    return {
      type: 'or',
      filters,
    };
  }

  const {
    $eq: _eq,
    $ne: _ne,
    $contains: _contains,
    $containsNot: _containsNot,
    $in: _in,
    $nin: _nin,
    $containsAll: _containsAll,
    $containsAny: _containsAny,
    $containsNone: _containsNone,
    ...rest
  } = nestedFilter.data;

  for (const unsupportedOp of ['$gt', '$lt', '$gte', '$lte']) {
    if (rest[unsupportedOp]) {
      throw new Error(`Filtering ${field.type} field with ${unsupportedOp} operator is not supported`);
    }
  }

  const filters: Filter[] = [];

  for (const op of ['$exists', '$eq', '$ne', '$contains', '$containsNot']) {
    const value = nestedFilter.data[op];
    if (value === undefined) {
      continue;
    }
    if (op === '$exists') {
      filters.push({
        type: 'null',
        op: value ? 'IS NOT' : 'IS',
        left: field.name,
        tunnel,
      });
      continue;
    }
    if ((op === '$eq' || op === '$ne') && value === null) {
      filters.push({
        type: 'null',
        op: op === '$eq' ? 'IS' : 'IS NOT',
        left: field.name,
        tunnel,
      });
      continue;
    }
    if (typeof value !== 'string') {
      throw new Error(`Filter value for ${field.type} field with operator ${op} must be a string`);
    }
    filters.push({
      type: 'ref',
      op: op === '$eq' || op === '$contains' ? 'IN' : 'NOT IN',
      left: field.name,
      right: [value],
      thing: oppositeThings,
      tunnel,
    });
  }

  for (const op of ['$in', '$nin', '$containsAll', '$containsAny', '$containsNone']) {
    const value = nestedFilter.data[op];
    if (value === undefined) {
      continue;
    }
    const stringArray = StringArrayParser.safeParse(value);
    if (!stringArray.success) {
      throw new Error(`Filter value for ${field.type} field with operator ${op} must be a string array`);
    }
    const listOp = listOpMap[op];
    if (!listOp) {
      throw new Error(`Invalid list operator: ${op}`);
    }
    filters.push({
      type: 'ref',
      op: listOp,
      left: field.name,
      right: stringArray.data,
      thing: oppositeThings,
      tunnel,
    });
  }

  const oppositeSchema = schema[field.opposite.thing];
  if (!oppositeSchema) {
    throw new Error(`Unknown thing: ${field.opposite.thing}`);
  }

  const nestedLogicalFilter = buildFilter(rest, oppositeSchema, schema);
  if (nestedLogicalFilter) {
    filters.push({
      type: 'nested',
      path: field.name,
      filter: nestedLogicalFilter,
      cardinality: field.cardinality,
    });
  }

  return {
    type: 'and',
    filters,
  };
};

const isUniqueFilter = (thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation, filter?: Filter): boolean => {
  if (!filter) {
    return false;
  }
  if (filter.type === 'scalar') {
    if (filter.op !== '=') {
      return false;
    }
    const field = thing.fields[filter.left];
    if (!field) {
      throw new Error(`Field ${filter.left} not found in ${thing.name}`);
    }
    return field.type === 'data' && field.unique;
  }
  if (filter.type === 'list') {
    if (filter.op !== 'IN' || filter.right.length > 1) {
      return false;
    }
    const field = thing.fields[filter.left];
    if (!field) {
      throw new Error(`Field ${filter.left} not found in ${thing.name}`);
    }
    return field.type === 'data' && field.unique;
  }
  if (filter.type === 'and') {
    return filter.filters.some((f) => isUniqueFilter(thing, f));
  }
  return false;
};

const buildSort = (sort?: ({ field: string; desc?: boolean } | string)[]): Sort[] | undefined => {
  if (!sort || sort.length === 0) {
    return undefined;
  }
  return sort.map((s) => {
    if (typeof s === 'string') {
      return { field: s, desc: false };
    }
    return { field: s.field, desc: s.desc ?? false };
  });
};

const scalarOpMap: Record<string, ScalarFilter['op']> = {
  $eq: '=',
  $ne: '!=',
  $gt: '>',
  $lt: '<',
  $gte: '>=',
  $lte: '<=',
  $contains: 'CONTAINS',
  $containsNot: 'CONTAINSNOT',
};

const listOpMap: Record<string, ListFilter['op']> = {
  $in: 'IN',
  $nin: 'NOT IN',
  $containsAll: 'CONTAINSALL',
  $containsAny: 'CONTAINSANY',
  $containsNone: 'CONTAINSNONE',
};

const StringArrayParser = z.array(z.string());

const validateLimit = (limit?: number): number | undefined => {
  if (limit !== undefined && (typeof limit !== 'number' || limit < 0)) {
    throw new Error(`Invalid limit: ${limit}`);
  }
  return limit;
};

const validateOffset = (offset?: number): number | undefined => {
  if (offset !== undefined && (typeof offset !== 'number' || offset < 0)) {
    throw new Error(`Invalid offset: ${offset}`);
  }
  return offset;
};

const validateSort = (projection: Projection, sort?: Sort[]): Sort[] | undefined => {
  if (!sort || sort.length === 0) {
    return undefined;
  }
  const projectionSet = new Set(projection.fields.map((f) => (f.type === 'metadata' ? f.path : (f.alias ?? f.path))));
  for (const s of sort) {
    if (!projectionSet.has(s.field)) {
      throw new Error(`Missing sorter field in the selected fields: ${s.field}`);
    }
  }
  return sort;
};
