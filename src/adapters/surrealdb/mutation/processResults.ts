import { isArray, isObject } from 'radash';
import { RecordId } from 'surrealdb';
import type { BormConfig } from '../../../types';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { StmtMap, StmtMapEntry } from './buildSurql';

/**
 * Process raw SurrealDB results into a flat mutation result array.
 */
export const processResults = (
  rawResults: unknown[],
  stmtMap: StmtMap,
  schema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
): any[] => {
  const results: any[] = [];
  const noMetadata = config.mutation?.noMetadata ?? false;

  // Each mutation entry has a resultIndex pointing to the RETURN statement
  // in the raw results array that holds its data.
  const mutationEntries = stmtMap.filter(
    (e) => (e.type === 'create' || e.type === 'update' || e.type === 'delete') && e.resultIndex !== undefined,
  );

  for (const entry of mutationEntries) {
    const resultIndex = entry.resultIndex ?? -1;
    const raw = resultIndex < rawResults.length ? rawResults[resultIndex] : null;

    // Skip auto-generated intermediary creates from user-visible results
    if (entry.isIntermediary) {
      continue;
    }

    if (entry.type === 'create') {
      processCreateResult(raw, entry, schema, noMetadata, results);
    } else if (entry.type === 'update') {
      processUpdateResult(raw, entry, schema, noMetadata, results);
    } else if (entry.type === 'delete') {
      processDeleteResult(raw, entry, schema, noMetadata, results);
    }
  }

  return results;
};

const processCreateResult = (
  raw: unknown,
  entry: StmtMapEntry,
  schema: DRAFT_EnrichedBormSchema,
  noMetadata: boolean,
  results: any[],
): void => {
  const records = normalizeResultArray(raw);
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const processed = processRecord(record as Record<string, unknown>);
    const tableName = processed._tableName as string | undefined;
    delete processed._tableName;
    const thing = entry.thing ?? tableName ?? (processed.$thing as string | undefined);
    const thingSchema = thing ? schema[thing as string] : undefined;

    const result: Record<string, unknown> = {
      ...processed,
    };

    if (!noMetadata) {
      result.$id = processed.id;
      result.$thing = thing;
      result.$thingType = thingSchema?.type ?? 'entity';
      result.$op = 'create';
      if (entry.tempId) {
        result.$tempId = entry.tempId;
      }
    }

    results.push(result);
  }
};

const processUpdateResult = (
  raw: unknown,
  entry: StmtMapEntry,
  schema: DRAFT_EnrichedBormSchema,
  noMetadata: boolean,
  results: any[],
): void => {
  const records = normalizeResultArray(raw);
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const processed = processRecord(record as Record<string, unknown>);
    const tableName = processed._tableName as string | undefined;
    delete processed._tableName;
    const thing = entry.thing ?? tableName ?? getThingFromRecord(processed, schema);
    const thingSchema = thing ? schema[thing] : undefined;

    const result: Record<string, unknown> = {
      ...processed,
    };

    if (!noMetadata) {
      result.$id = processed.id;
      result.$thing = thing;
      result.$thingType = thingSchema?.type ?? 'entity';
      result.$op = 'update';
    }

    results.push(result);
  }
};

const processDeleteResult = (
  raw: unknown,
  entry: StmtMapEntry,
  schema: DRAFT_EnrichedBormSchema,
  noMetadata: boolean,
  results: any[],
): void => {
  const records = normalizeResultArray(raw);
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const processed = processRecord(record as Record<string, unknown>);
    const tableName = processed._tableName as string | undefined;
    delete processed._tableName;
    const thing = entry.thing ?? tableName ?? getThingFromRecord(processed, schema);
    const thingSchema = thing ? schema[thing] : undefined;

    const result: Record<string, unknown> = {
      ...processed,
    };

    if (!noMetadata) {
      result.$id = processed.id;
      result.$thing = thing;
      result.$thingType = thingSchema?.type ?? 'entity';
      result.$op = 'delete';
    }

    results.push(result);
  }
};

/**
 * Process a single SurrealDB record: resolve record IDs, dates, empty arrays.
 */
export const processRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'id' && value instanceof RecordId) {
      result.id = value.id;
      result._tableName = value.table.name;
      continue;
    }

    result[key] = processValue(value);
  }

  return result;
};

const processValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  // RecordId → plain id string
  if (value instanceof RecordId) {
    return value.id;
  }

  // Date objects pass through
  if (value instanceof Date) {
    return value;
  }

  if (isArray(value)) {
    // Empty arrays → undefined (matching existing behavior)
    if (value.length === 0) {
      return undefined;
    }
    // Arrays: process each element
    return value.map(processValue);
  }

  // Objects: process recursively
  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const processed = processValue(v);
      if (processed !== undefined) {
        result[k] = processed;
      }
    }
    return result;
  }

  return value;
};

const getThingFromRecord = (record: Record<string, unknown>, _schema: DRAFT_EnrichedBormSchema): string | undefined => {
  if (record.$thing) {
    return record.$thing as string;
  }

  return undefined;
};

const normalizeResultArray = (raw: unknown): unknown[] => {
  if (raw === null || raw === undefined) {
    return [];
  }
  if (isArray(raw)) {
    // Could be nested arrays from SurrealDB
    if (raw.length > 0 && isArray(raw[0])) {
      return raw.flat();
    }
    return raw;
  }
  return [raw];
};
