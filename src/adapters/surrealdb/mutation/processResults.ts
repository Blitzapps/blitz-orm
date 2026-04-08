import { isArray, isObject } from 'radash';
import { RecordId } from 'surrealdb';
import type { BormConfig } from '../../../types';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type { StmtMap, StmtMapEntry } from './buildSurql';
import type { LogicalMutation } from './logical';

/**
 * Process raw SurrealDB results into a flat mutation result array.
 */
export const processResults = (
  rawResults: unknown[],
  stmtMap: StmtMap,
  mutation: LogicalMutation,
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
    const raw = entry.resultIndex! < rawResults.length ? rawResults[entry.resultIndex!] : null;

    // Skip auto-generated intermediary creates from user-visible results
    if (entry.isIntermediary) {
      continue;
    }

    if (entry.type === 'create') {
      processCreateResult(raw, entry, schema, noMetadata, results);
    } else if (entry.type === 'update') {
      processUpdateResult(raw, entry, mutation, schema, noMetadata, results);
    } else if (entry.type === 'delete') {
      processDeleteResult(raw, entry, mutation, schema, noMetadata, results);
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
    const processed = processRecord(record as Record<string, unknown>, schema);
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
  _mutation: LogicalMutation,
  schema: DRAFT_EnrichedBormSchema,
  noMetadata: boolean,
  results: any[],
): void => {
  const records = normalizeResultArray(raw);
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const processed = processRecord(record as Record<string, unknown>, schema);
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
  _mutation: LogicalMutation,
  schema: DRAFT_EnrichedBormSchema,
  noMetadata: boolean,
  results: any[],
): void => {
  const records = normalizeResultArray(raw);
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const processed = processRecord(record as Record<string, unknown>, schema);
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
export const processRecord = (
  record: Record<string, unknown>,
  _schema: DRAFT_EnrichedBormSchema,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'id') {
      // Extract record ID: SurrealDB returns { tb: 'User', id: 'u1' } or a RecordId object
      result.id = extractRecordId(value);
      // Also extract the table name for metadata
      result._tableName = extractTableName(value);
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

  // Empty arrays → undefined (matching existing behavior)
  if (isArray(value) && value.length === 0) {
    return undefined;
  }

  // RecordId → plain id string
  if (isRecordId(value)) {
    return extractRecordId(value);
  }

  // String record reference "Table:⟨id⟩" → plain id (only with angle brackets to avoid false positives)
  if (typeof value === 'string') {
    const match = /^[A-Za-z][A-Za-z0-9_-]*:⟨(.+?)⟩$/.exec(value);
    if (match) {
      return match[1];
    }
  }

  // Date objects pass through
  if (value instanceof Date) {
    return value;
  }

  // Arrays: process each element
  if (isArray(value)) {
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

const extractRecordId = (value: unknown): string => {
  if (typeof value === 'string') {
    // Could be "User:u1" or "User:⟨u1⟩" format
    const colonIdx = value.indexOf(':');
    if (colonIdx > 0) {
      return stripAngleBrackets(value.slice(colonIdx + 1));
    }
    return stripAngleBrackets(value);
  }
  if (isRecordId(value)) {
    const rid = value as { tb?: string; id?: unknown; toJSON?: () => string };
    if (rid.id !== undefined) {
      return stripAngleBrackets(String(rid.id));
    }
    // Fallback: parse the string representation
    const str = String(value);
    const colonIdx = str.indexOf(':');
    if (colonIdx > 0) {
      return stripAngleBrackets(str.slice(colonIdx + 1));
    }
    return stripAngleBrackets(str);
  }
  return stripAngleBrackets(String(value));
};

const stripAngleBrackets = (s: string): string => {
  if (s.startsWith('⟨') && s.endsWith('⟩')) {
    return s.slice(1, -1);
  }
  return s;
};

const extractTableName = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const colonIdx = value.indexOf(':');
    if (colonIdx > 0) {
      return stripAngleBrackets(value.slice(0, colonIdx));
    }
    return undefined;
  }
  if (isRecordId(value)) {
    const rid = value as { tb?: string };
    if (rid.tb) {
      return stripAngleBrackets(rid.tb);
    }
    // Fallback: parse the string representation
    const str = String(value);
    const colonIdx = str.indexOf(':');
    if (colonIdx > 0) {
      return stripAngleBrackets(str.slice(0, colonIdx));
    }
  }
  return undefined;
};

const isRecordId = (value: unknown): boolean => {
  return value instanceof RecordId;
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
