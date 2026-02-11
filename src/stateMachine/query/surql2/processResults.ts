import type { BQLQuery, NestedBQL } from '../../../types/requests/parser';
import type {
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormSchema,
} from '../../../types/schema/enriched.draft';

type ResultObject = Record<string, unknown>;

const isResultObject = (value: unknown): value is ResultObject => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isNullish = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

const isEmptyArray = (value: unknown): boolean => {
  return Array.isArray(value) && value.length === 0;
};

export const processResults = (params: {
  batch: BQLQuery[];
  results: unknown[];
  schema: DRAFT_EnrichedBormSchema;
  metadata: boolean;
  returnNulls: boolean;
}) => {
  const { batch, results, schema, metadata, returnNulls } = params;
  return batch.map((query, i) => processQueryResult({ query, result: results[i], schema, metadata, returnNulls }));
};

const processQueryResult = (params: {
  query: BQLQuery;
  result: unknown;
  schema: DRAFT_EnrichedBormSchema;
  metadata: boolean;
  returnNulls: boolean;
}) => {
  const { query, result, schema, metadata, returnNulls } = params;
  if (!result) {
    return result ?? null;
  }
  const thing = schema[query.$thing];
  if (!thing) {
    throw new Error(`Thing ${query.$thing} not found in schema`);
  }
  if (Array.isArray(result)) {
    if (returnNulls && result.length === 0) {
      return null;
    }
    return result.map((r) => transformResultObject({ query, result: r, thing, schema, metadata, returnNulls }));
  }
  return transformResultObject({ query, result, thing, schema, metadata, returnNulls });
};

const processNestedResult = (params: {
  query: NestedBQL;
  result: unknown;
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation;
  schema: DRAFT_EnrichedBormSchema;
  metadata: boolean;
  returnNulls: boolean;
}) => {
  const { query, result, thing, schema, metadata, returnNulls } = params;
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return null;
    }
    return result.map((r) => transformResultObject({ query, result: r, thing, schema, metadata, returnNulls }));
  }
  return transformResultObject({ query, result, thing, schema, metadata, returnNulls });
};

const transformResultObject = (params: {
  query: BQLQuery | NestedBQL;
  result: unknown;
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation;
  schema: DRAFT_EnrichedBormSchema;
  metadata: boolean;
  returnNulls: boolean;
}): ResultObject | null => {
  const { query, result, thing, schema, metadata, returnNulls } = params;
  if (!isResultObject(result)) {
    return null;
  }

  const newResult: ResultObject = {};

  if (metadata) {
    newResult.$thing = result.$thing ?? null;
    newResult.$id = result.$id ?? null;
    newResult.$thingType = thing.type;
  }

  const fieldsToProcess = query.$fields ?? Object.keys(thing.fields);

  for (const fieldQuery of fieldsToProcess) {
    const path = typeof fieldQuery === 'string' ? fieldQuery : fieldQuery.$path;
    const alias = typeof fieldQuery === 'string' ? fieldQuery : (fieldQuery.$as ?? path);

    if (query.$excludedFields?.includes(path)) {
      continue;
    }

    if (path === '$id' || path === '$thing') {
      newResult[alias] = result[alias] ?? null;
      continue;
    }

    const field = thing.fields[path];

    if (!field) {
      throw new Error(`Field ${path} not found in ${thing.name}`);
    }

    if (field.type === 'constant') {
      newResult[alias] = field.value;
      continue;
    }

    if (field.type === 'computed') {
      newResult[alias] = field.fn(result);
      continue;
    }

    const value = result[alias];

    if (field.type === 'data') {
      if (!returnNulls && isNullish(value)) {
        continue;
      }
      newResult[alias] = value ?? null;
      continue;
    }

    if (!returnNulls && (isNullish(value) || isEmptyArray(value))) {
      continue;
    }

    if (typeof fieldQuery === 'string' || field.type === 'ref') {
      newResult[alias] = isEmptyArray(value) ? null : (value ?? null);
      continue;
    }

    const opposite = schema[field.opposite.thing];
    newResult[alias] = processNestedResult({
      query: fieldQuery,
      result: value,
      thing: opposite,
      schema,
      metadata,
      returnNulls,
    });
  }

  return newResult;
};
