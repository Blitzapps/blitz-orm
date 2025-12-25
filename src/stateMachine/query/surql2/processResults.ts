import type { BQLQuery, NestedBQL } from "../../../types/requests/parser";
import type { DRAFT_EnrichedBormEntity, DRAFT_EnrichedBormRelation, DRAFT_EnrichedBormSchema } from "../../../types/schema/enriched.draft";

export const processResults = (params: {
  batch: BQLQuery[],
  results: unknown[],
  schema: DRAFT_EnrichedBormSchema,
  metadata: boolean,
  returnNulls: boolean,
}) => {
  const { batch, results, schema, metadata, returnNulls } = params;
  return batch.map((query, i) => processQueryResult({ query, result: results[i], schema, metadata, returnNulls }));
}

const processQueryResult = (params: {
  query: BQLQuery,
  result: unknown,
  schema: DRAFT_EnrichedBormSchema,
  metadata: boolean,
  returnNulls: boolean,
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
    return result.map((r) => transformResultObject({ query, result: r, thing, schema, metadata, returnNulls }));
  }
  return transformResultObject({ query, result, thing, schema, metadata, returnNulls });
}

const processNestedResult = (params: {
  query: NestedBQL,
  result: unknown,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  schema: DRAFT_EnrichedBormSchema,
  metadata: boolean,
  returnNulls: boolean,
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
  query: BQLQuery | NestedBQL,
  result: unknown,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  schema: DRAFT_EnrichedBormSchema,
  metadata: boolean,
  returnNulls: boolean,
}) => {
  const { query, result, thing, schema, metadata, returnNulls } = params;
  if (!result || typeof result !== 'object') {
    return result ?? null;
  }

  const obj = result as Record<string, unknown>;
  const newResult: Record<string, unknown> = {};

  if (metadata) {
    newResult.$thing = obj.$thing;
    newResult.$id = obj.$id;
    newResult.$thingType = thing.type;
  }

  for (const fieldQuery of query.$fields ?? Object.keys(thing.fields)) {
    const path = typeof fieldQuery === 'string' ? fieldQuery : fieldQuery.$path;
    // Skip excluded fields.
    if (query.$excludedFields?.includes(path)) {
      continue;
    }

    const field = thing.fields[path];

    if (!field) {
      throw new Error(`Field ${path} not found in ${thing.name}`);
    }

    if (field.type === 'constant') {
      newResult[path] = field.value;
      continue;
    }

    if (field.type === 'computed') {
      newResult[path] = field.fn(obj);
      continue;
    }

    const value = obj[path] ?? null;

    if (field.type === 'data') {
      if (!returnNulls && (value === null || value === undefined)) {
        continue;
      }
      newResult[path] = value ?? null;
      continue;
    }

    if (!returnNulls && (value === null || value === undefined || (Array.isArray(value) && value.length === 0))) {
      continue;
    }

    if (typeof fieldQuery === 'string' || field.type === 'ref') {
      newResult[path] = Array.isArray(value) && value.length === 0 ? null : value ?? null;
      continue;
    }

    const opposite = schema[field.opposite.thing];
    newResult[path] =  processNestedResult({ query: fieldQuery, result: value, thing: opposite, schema, metadata, returnNulls });
  }

  return newResult;
};
