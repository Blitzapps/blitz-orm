import { z } from 'zod/v4';
import { type BQLFilter, BQLFilterParser } from '../../../types/requests/parser';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';

export type BQLMutationOp = 'create' | 'update' | 'delete' | 'link' | 'unlink';

export type BQLMutation = {
  $thing: string;
  $id?: string | string[];
  $filter?: BQLFilter | BQLFilter[];
  $op?: BQLMutationOp;
  $tempId?: string;
  [key: string]: unknown;
};

const DRAFT_BQLMutationParser = z
  .object({
    $thing: z.string().optional(),
    $entity: z.string().optional(),
    $relation: z.string().optional(),
    $id: z.union([z.string(), z.array(z.string())]).optional(),
    $filter: z.union([BQLFilterParser, z.array(BQLFilterParser)]).optional(),
    $op: z.enum(['create', 'update', 'delete', 'link', 'unlink']).optional(),
    $tempId: z.string().optional(),
  })
  .catchall(z.any())
  .superRefine((data, ctx) => {
    if (!data.$thing && !data.$entity && !data.$relation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of $thing, $entity, or $relation must be provided',
      });
    }
  })
  .transform((data) => {
    const $thing = data.$thing ?? data.$entity ?? data.$relation;
    const { $entity: _e, $relation: _r, ...rest } = data;
    return { ...rest, $thing: $thing! } as BQLMutation;
  });

const NestedBQLMutationParser = z
  .object({
    $thing: z.string().optional(),
    $entity: z.string().optional(),
    $relation: z.string().optional(),
    $id: z.union([z.string(), z.array(z.string())]).optional(),
    $filter: z.union([BQLFilterParser, z.array(BQLFilterParser)]).optional(),
    $op: z.enum(['create', 'update', 'delete', 'link', 'unlink']).optional(),
    $tempId: z.string().optional(),
  })
  .catchall(z.any())
  .transform((data) => {
    // Normalize $entity/$relation → $thing
    if (data.$entity || data.$relation) {
      const $thing = data.$thing ?? data.$entity ?? data.$relation;
      const { $entity: _e, $relation: _r, ...rest } = data;
      return { ...rest, $thing } as Record<string, unknown>;
    }
    return data as Record<string, unknown>;
  });

export const parseBQLMutation = (raw: unknown, schema: DRAFT_EnrichedBormSchema): BQLMutation | BQLMutation[] => {
  // Deep clone to avoid mutating the caller's input (which may be frozen/readonly)
  const cloned = deepClone(raw);
  if (Array.isArray(cloned)) {
    return cloned.map((item: unknown) => parseSingleMutation(item, schema));
  }
  return parseSingleMutation(cloned, schema);
};

const parseSingleMutation = (raw: unknown, schema: DRAFT_EnrichedBormSchema): BQLMutation => {
  const parsed = DRAFT_BQLMutationParser.parse(raw);
  if (!schema[parsed.$thing]) {
    throw new Error(`Thing '${parsed.$thing}' not found in schema`);
  }
  parseNestedMutations(parsed, schema);
  return parsed;
};

const parseNestedMutations = (node: Record<string, unknown>, schema: DRAFT_EnrichedBormSchema): void => {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (isObject(value[i])) {
          value[i] = parseNestedBlock(value[i], schema);
        }
      }
    } else if (isObject(value)) {
      node[key] = parseNestedBlock(value, schema);
    }
  }
};

const parseNestedBlock = (raw: unknown, schema: DRAFT_EnrichedBormSchema): unknown => {
  const result = NestedBQLMutationParser.safeParse(raw);
  if (!result.success) {
    return raw; // Not a mutation block, keep as-is (could be a JSON value)
  }
  const parsed = result.data as Record<string, unknown>;
  // Validate $thing exists in schema if specified
  if (parsed.$thing && !schema[parsed.$thing as string]) {
    throw new Error(`Thing '${parsed.$thing}' not found in schema`);
  }
  parseNestedMutations(parsed, schema);
  return parsed;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const deepClone = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deepClone(v);
    }
    return result;
  }
  return value;
};
