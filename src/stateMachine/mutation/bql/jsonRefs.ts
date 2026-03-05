import { RecordId } from 'surrealdb';
import type { EnrichedBormSchema } from '../../../types';

/**
 * Serializes a value to JSON with record reference support for SurrealDB mutation
 */
export const serializeJson = (value: unknown, schema: EnrichedBormSchema): string => {
  return serializeWithRefs(value, schema);
};

const serializeWithRefs = (value: unknown, schema: EnrichedBormSchema): string => {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => serializeWithRefs(item, schema));
    return `[${items.join(', ')}]`;
  }
  if (typeof value === 'object') {
    const ref = isValidRef(value as Record<string, unknown>, schema);
    if (ref) {
      return `${ref.thing}:⟨${ref.id}⟩`;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    const pairs = entries.map(([k, v]) => `${JSON.stringify(k)}: ${serializeWithRefs(v, schema)}`);
    return `{${pairs.join(', ')}}`;
  }
  return JSON.stringify(value);
};

const isValidRef = (obj: Record<string, unknown>, schema: EnrichedBormSchema): { thing: string; id: string } | null => {
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== '$ref') {
    return null;
  }
  const ref = obj.$ref;
  if (typeof ref !== 'string') {
    return null;
  }
  const colonIndex = ref.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }
  const thing = ref.slice(0, colonIndex);
  const id = ref.slice(colonIndex + 1);
  if (!thing || !id) {
    return null;
  }
  if (!schema.entities[thing] && !schema.relations[thing]) {
    return null;
  }
  return { thing, id };
};

/**
 * Recursively resolve SurrealDB RecordId objects to plain IDs within a JSON structure.
 */
export const resolveJsonRecordLinks = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(resolveJsonRecordLinks);
  }
  if (value instanceof RecordId) {
    return value.id;
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = resolveJsonRecordLinks(v);
    }
    return result;
  }
  return value;
};
