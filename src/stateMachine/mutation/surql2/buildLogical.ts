import { RecordId } from 'surrealdb';
import type { BQLFilter } from '../../../types/requests/parser';
import type {
  DRAFT_EnrichedBormDataField,
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormLinkField,
  DRAFT_EnrichedBormLinkFieldTargetRelation,
  DRAFT_EnrichedBormLinkFieldTargetRole,
  DRAFT_EnrichedBormRefField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormRoleField,
  DRAFT_EnrichedBormSchema,
} from '../../../types/schema/enriched.draft';
import { buildFilter } from '../../query/surql2/buildLogical';
import type {
  CreateMut,
  DeleteMut,
  Filter,
  FlexValue,
  LogicalMutation,
  Match,
  Ref,
  SubMatch,
  UpdateMut,
  ValueMut,
} from './logical';
import type { BQLMutation } from './parse';

type BuildContext = {
  schema: DRAFT_EnrichedBormSchema;
  mutation: LogicalMutation;
  nameCounters: Record<string, number>;
  tempIdMap: Map<string, { thing: string; id: string }>;
};

/**
 * Convert parsed and hook-processed BQLMutation into a LogicalMutation.
 */
export const buildLogicalMutation = (
  input: BQLMutation | BQLMutation[],
  schema: DRAFT_EnrichedBormSchema,
): LogicalMutation => {
  const ctx: BuildContext = {
    schema,
    mutation: {
      matches: [],
      subMatches: [],
      creates: [],
      updates: [],
      deletes: [],
    },
    nameCounters: {},
    tempIdMap: new Map(),
  };

  const nodes = Array.isArray(input) ? input : [input];

  // First pass: collect all $tempId declarations
  for (const node of nodes) {
    collectTempIds(node, ctx);
  }

  // Second pass: build logical operations
  for (const node of nodes) {
    buildNode(node, null, null, ctx);
  }

  // Dependency ordering and cycle resolution
  orderMutations(ctx.mutation);

  return ctx.mutation;
};

// --- Name generation ---

const normalizeName = (name: string): string => name.replace(/[\s-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

const genName = (thing: string, ctx: BuildContext): string => {
  const prefix = normalizeName(thing);
  const counter = ctx.nameCounters[prefix] ?? 0;
  ctx.nameCounters[prefix] = counter + 1;
  return `${prefix}_${counter}`;
};

// --- Random ID generation ---

const genRandomId = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
};

// --- TempId collection ---

const collectTempIds = (node: BQLMutation, ctx: BuildContext): void => {
  if (node.$tempId) {
    const tempIdName = node.$tempId.replace(/^_:/, '');
    if (node.$op === 'create') {
      // Check for duplicate tempId declarations
      if (ctx.tempIdMap.has(node.$tempId)) {
        throw new Error(
          `[Wrong format] Wrong operation combination for $tempId/$id "${tempIdName}". Existing: create. Current: create`,
        );
      }
      // Only collect if $thing is known; otherwise it will be collected during buildLogical
      if (node.$thing && ctx.schema[node.$thing]) {
        const thing = ctx.schema[node.$thing];
        const idFieldName = getIdFieldName(thing);
        const id = (node.$id as string) ?? (node[idFieldName] as string | undefined) ?? genRandomId();
        ctx.tempIdMap.set(node.$tempId, { thing: thing.name, id });
        if (node[idFieldName] === undefined && node.$id === undefined) {
          node[idFieldName] = id;
        }
      }
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNestedBlock(item)) {
          collectTempIds(item as BQLMutation, ctx);
        }
      }
    } else if (isNestedBlock(value)) {
      collectTempIds(value as BQLMutation, ctx);
    }
  }
};

// --- Main build logic ---

const buildNode = (
  node: BQLMutation,
  parentMatchOrCreate: string | null,
  parentFieldPath: string | null,
  ctx: BuildContext,
): void => {
  const op = node.$op!;
  const thing = getThing(node, ctx);

  switch (op) {
    case 'create':
      buildCreate(node, thing, parentMatchOrCreate, parentFieldPath, ctx);
      break;
    case 'update':
      buildUpdate(node, thing, parentMatchOrCreate, parentFieldPath, ctx);
      break;
    case 'delete':
      buildDelete(node, thing, parentMatchOrCreate, parentFieldPath, ctx);
      break;
    case 'link':
    case 'unlink':
      // link/unlink are handled at the parent level (as role/ref/link field values)
      break;
  }
};

// --- Create ---

const buildCreate = (
  node: BQLMutation,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  _parentMatch: string | null,
  _parentFieldPath: string | null,
  ctx: BuildContext,
): string => {
  const idFieldName = getIdFieldName(thing);

  // Resolve ID
  const tempEntry = node.$tempId ? ctx.tempIdMap.get(node.$tempId) : undefined;
  const id = tempEntry
    ? tempEntry.id
    : ((node.$id as string) ?? (node[idFieldName] as string | undefined) ?? genRandomId());

  // Register tempId if not already collected (happens when $thing was unknown during first pass)
  if (node.$tempId && !ctx.tempIdMap.has(node.$tempId)) {
    ctx.tempIdMap.set(node.$tempId, { thing: thing.name, id });
  }

  // Validate: no mixed link field targets for the same relation
  validateLinkFieldTargets(node, thing);

  const name = genName(thing.name, ctx);

  // Push the create BEFORE processing fields so that nested link field
  // handlers can find this create's ID via getNodeId/creates list
  const create: CreateMut = {
    name,
    thing: thing.name,
    id,
    tempId: node.$tempId,
    op: 'create',
    values: {},
  };
  ctx.mutation.creates.push(create);

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (key === idFieldName) {
      continue; // Skip id field
    }
    const fieldValue = buildFieldValue(key, value, thing, node, name, ctx);
    if (fieldValue) {
      create.values[key] = fieldValue;
    }
  }

  return name;
};

// --- Update ---

const buildUpdate = (
  node: BQLMutation,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  parentMatch: string | null,
  parentFieldPath: string | null,
  ctx: BuildContext,
  fieldCardinality?: 'ONE' | 'MANY',
  isComputed?: boolean,
): void => {
  const idFieldName = getIdFieldName(thing);
  guardIdFieldOnUpdate(idFieldName, thing.name, node);

  const matchName = buildMatchOrSubMatch(node, thing, parentMatch, parentFieldPath, ctx, fieldCardinality, isComputed);

  const values: Record<string, ValueMut> = {};
  let hasValues = false;

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    const fieldValue = buildFieldValue(key, value, thing, node, matchName, ctx);
    if (fieldValue) {
      values[key] = fieldValue;
      hasValues = true;
    }
  }

  if (hasValues) {
    const update: UpdateMut = {
      name: genName(thing.name, ctx),
      match: matchName,
      op: 'update',
      values,
    };
    ctx.mutation.updates.push(update);
  }
};

// --- Delete ---

const buildDelete = (
  node: BQLMutation,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  parentMatch: string | null,
  parentFieldPath: string | null,
  ctx: BuildContext,
  fieldCardinality?: 'ONE' | 'MANY',
  isComputed?: boolean,
): void => {
  const matchName = buildMatchOrSubMatch(node, thing, parentMatch, parentFieldPath, ctx, fieldCardinality, isComputed);

  // Process nested children (e.g., delete children through role/link fields)
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    const field = thing.fields[key];
    if (!field) {
      continue;
    }
    if (field.type === 'role') {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (isObject(item)) {
          const block = item as Record<string, unknown>;
          const nestedThing = block.$thing ? ctx.schema[block.$thing as string] : ctx.schema[field.opposite.thing];
          if (nestedThing) {
            if (!block.$thing) {
              block.$thing = nestedThing.name;
            }
            if (block.$op === 'delete') {
              buildDelete(block as BQLMutation, nestedThing, matchName, key, ctx, field.cardinality);
            }
          }
        }
      }
    } else if (field.type === 'link') {
      buildLinkFieldValue(key, value, field, thing, node, matchName, ctx);
    }
  }

  const del: DeleteMut = {
    name: genName(thing.name, ctx),
    match: matchName,
    op: 'delete',
  };
  ctx.mutation.deletes.push(del);
};

// --- Match / SubMatch building ---

const buildMatchOrSubMatch = (
  node: BQLMutation,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  parentMatch: string | null,
  parentFieldPath: string | null,
  ctx: BuildContext,
  fieldCardinality?: 'ONE' | 'MANY',
  isComputed?: boolean,
): string => {
  const idFieldName = getIdFieldName(thing);
  const { ids: filterIds, remainingFilter } = extractIdFromBqlFilter(node.$filter, idFieldName);
  const nodeIds = node.$id ? (Array.isArray(node.$id) ? node.$id : [node.$id]) : [];
  const allIds = [...nodeIds, ...filterIds];

  if (parentMatch && parentFieldPath) {
    // SubMatch
    const name = genName(thing.name, ctx);
    const subMatch: SubMatch = {
      name,
      parent: parentMatch,
      path: parentFieldPath,
      cardinality: fieldCardinality ?? 'MANY',
      isComputed,
      ids: allIds.length > 0 ? allIds : undefined,
      filter: remainingFilter ? buildFilter(remainingFilter, thing, ctx.schema) : undefined,
    };
    ctx.mutation.subMatches.push(subMatch);
    return name;
  }

  // Root match
  const name = genName(thing.name, ctx);
  const thingNames: [string, ...string[]] = [thing.name, ...thing.subTypes];
  const filter = remainingFilter ? buildFilter(remainingFilter, thing, ctx.schema) : undefined;

  if (allIds.length > 0) {
    const match: Match = {
      name,
      source: { type: 'record_pointer', thing: thingNames, ids: allIds },
      filter,
    };
    ctx.mutation.matches.push(match);
  } else if (filter) {
    const match: Match = {
      name,
      source: { type: 'table_scan', thing: thingNames },
      filter,
    };
    ctx.mutation.matches.push(match);
  } else {
    const match: Match = {
      name,
      source: { type: 'table_scan', thing: thingNames },
    };
    ctx.mutation.matches.push(match);
  }

  return name;
};

const extractIdFromBqlFilter = (
  filter: BQLFilter | BQLFilter[] | undefined,
  idFieldName: string,
): { ids: string[]; remainingFilter?: BQLFilter | BQLFilter[] } => {
  if (!filter || Array.isArray(filter)) {
    return { ids: [], remainingFilter: filter };
  }

  const idValue = filter[idFieldName];
  if (idValue === undefined) {
    return { ids: [], remainingFilter: filter };
  }

  const remaining = { ...filter };
  delete remaining[idFieldName];
  const hasRemaining =
    Object.keys(remaining).filter((k) => !k.startsWith('$')).length > 0 ||
    remaining.$not !== undefined ||
    remaining.$or !== undefined;
  const remainingFilter = hasRemaining ? remaining : undefined;

  if (typeof idValue === 'string') {
    return { ids: [idValue], remainingFilter };
  }

  if (Array.isArray(idValue) && idValue.every((v) => typeof v === 'string')) {
    return { ids: idValue as string[], remainingFilter };
  }

  // Can't extract (e.g. operator object); keep the filter as-is
  return { ids: [], remainingFilter: filter };
};

// --- Field value building ---

const buildFieldValue = (
  fieldName: string,
  value: unknown,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  node: BQLMutation,
  parentName: string,
  ctx: BuildContext,
): ValueMut | undefined => {
  // Skip %-prefixed temporary transform variables
  if (fieldName.startsWith('%')) {
    return undefined;
  }

  const field = thing.fields[fieldName];
  if (!field) {
    throw new Error(`Unknown field '${fieldName}' on '${thing.name}'`);
  }

  // Field guards
  if (field.type === 'constant') {
    throw new Error(`Virtual fields can't be sent to DB: "${fieldName}"`);
  }
  if (field.type === 'computed') {
    throw new Error(`Virtual fields can't be sent to DB: "${fieldName}"`);
  }
  if (field.type === 'data' && field.isVirtual) {
    throw new Error(`Virtual fields can't be sent to DB: "${fieldName}"`);
  }
  if (field.type === 'link' && field.isVirtual) {
    throw new Error(`Virtual fields can't be sent to DB: "${fieldName}"`);
  }

  // Null handling
  if (value === null) {
    // Link fields are COMPUTED — null means unlink-all, handled through the relation
    if (field.type === 'link') {
      buildLinkFieldValue(fieldName, [{ $op: 'unlink' }], field, thing, node, parentName, ctx);
      return undefined;
    }
    if (field.type === 'role' || field.type === 'ref') {
      if (field.cardinality === 'MANY') {
        return { type: 'empty', path: fieldName };
      }
    }
    return { type: 'null', path: fieldName };
  }

  switch (field.type) {
    case 'data':
      return buildDataFieldValue(fieldName, value, field);
    case 'ref':
      return buildRefFieldValue(fieldName, value, field, node, parentName, ctx);
    case 'role':
      return buildRoleFieldValue(fieldName, value, field, node, parentName, ctx);
    case 'link':
      buildLinkFieldValue(fieldName, value, field, thing, node, parentName, ctx);
      return undefined; // Link field mutations are handled as side effects (creates/updates on relations)
    default:
      throw new Error(`Unsupported field type for '${fieldName}' on '${thing.name}'`);
  }
};

// --- Data field ---

const buildDataFieldValue = (fieldName: string, value: unknown, field: DRAFT_EnrichedBormDataField): ValueMut => {
  // For JSON fields, resolve { $ref: 'Type:id' } syntax to RecordId
  const resolvedValue = field.contentType === 'JSON' ? resolveJsonRefs(value) : value;

  if (field.cardinality === 'MANY') {
    return {
      type: 'data_field',
      cardinality: 'MANY',
      path: fieldName,
      value: Array.isArray(resolvedValue) ? resolvedValue : [resolvedValue],
    };
  }
  return {
    type: 'data_field',
    cardinality: 'ONE',
    path: fieldName,
    value: resolvedValue,
  };
};

/** Recursively resolve { $ref: 'Type:id' } in JSON values to RecordId instances */
const resolveJsonRefs = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(resolveJsonRefs);
  }
  if (isObject(value)) {
    const obj = value as Record<string, unknown>;
    // Check for $ref pattern: { $ref: 'Type:id' }
    const keys = Object.keys(obj);
    if (keys.length === 1 && typeof obj.$ref === 'string') {
      const ref = parsePrefixedRef(obj.$ref as string);
      if (ref) {
        return new RecordId(ref.thing, ref.id);
      }
    }
    // Recurse into object properties
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveJsonRefs(v);
    }
    return result;
  }
  return value;
};

// --- Ref field ---

const buildRefFieldValue = (
  fieldName: string,
  value: unknown,
  field: DRAFT_EnrichedBormRefField,
  node: BQLMutation,
  parentName: string,
  ctx: BuildContext,
): ValueMut | undefined => {
  if (field.contentType === 'FLEX') {
    return buildFlexFieldValue(fieldName, value, field, ctx, parentName);
  }

  // REF content type
  if (field.cardinality === 'ONE') {
    // Handle nested create for ONE cardinality
    if (isObject(value) && (value as Record<string, unknown>).$op === 'create') {
      const nested = value as BQLMutation;
      if (!nested.$thing) {
        throw new Error(`Nested create in ref field '${fieldName}' must have $thing`);
      }
      const nestedThing = ctx.schema[nested.$thing];
      if (!nestedThing) {
        throw new Error(`Thing '${nested.$thing}' not found in schema`);
      }
      const createName = buildCreate(nested, nestedThing, parentName, null, ctx);
      const createMut = ctx.mutation.creates.find((c) => c.name === createName)!;
      return {
        type: 'ref_field',
        cardinality: 'ONE',
        path: fieldName,
        value: `${createMut.thing}:${createMut.id}`,
      };
    }
    // Handle link for ONE cardinality
    if (isObject(value) && (value as Record<string, unknown>).$op === 'link') {
      const ref = resolveRefLink(value as Record<string, unknown>, ctx);
      if (!ref) {
        return undefined;
      }
      return {
        type: 'ref_field',
        cardinality: 'ONE',
        path: fieldName,
        value: `${ref.thing}:${ref.id}`,
      };
    }
    const ref = resolveRefValue(value, node, parentName, ctx);
    if (!ref) {
      return undefined;
    }
    return {
      type: 'ref_field',
      cardinality: 'ONE',
      path: fieldName,
      value: `${ref.thing}:${ref.id}`,
    };
  }

  // MANY
  const items = Array.isArray(value) ? value : [value];
  const refs: string[] = [];
  const links: Ref[] = [];
  const unlinks: Ref[] = [];
  let hasCreate = false;

  for (const item of items) {
    if (isObject(item) && (item as Record<string, unknown>).$op === 'create') {
      // Nested create for ref field
      const nested = item as BQLMutation;
      if (!nested.$thing) {
        throw new Error(`Nested create in ref field '${fieldName}' must have $thing`);
      }
      const nestedThing = ctx.schema[nested.$thing];
      if (!nestedThing) {
        throw new Error(`Thing '${nested.$thing}' not found in schema`);
      }
      const createName = buildCreate(nested, nestedThing, parentName, null, ctx);
      const createMut = ctx.mutation.creates.find((c) => c.name === createName)!;
      refs.push(`${createMut.thing}:${createMut.id}`);
      hasCreate = true;
    } else if (isObject(item) && (item as Record<string, unknown>).$op === 'link') {
      const nested = item as Record<string, unknown>;
      const ref = resolveRefLink(nested, ctx);
      if (ref) {
        links.push(ref);
      }
    } else if (isObject(item) && (item as Record<string, unknown>).$op === 'unlink') {
      const nested = item as Record<string, unknown>;
      const ref = resolveRefLink(nested, ctx);
      if (ref) {
        unlinks.push(ref);
      }
    } else {
      const ref = resolveRefValue(item, node, parentName, ctx);
      if (ref) {
        refs.push(`${ref.thing}:${ref.id}`);
      }
    }
  }

  // If we have links/unlinks, this is a patch operation on the ref field
  // For simplicity, we handle it as a full replace for now
  if (links.length > 0 || unlinks.length > 0 || hasCreate) {
    const allRefs = [...refs, ...links.map((r) => `${r.thing}:${r.id}`)];
    return {
      type: 'ref_field',
      cardinality: 'MANY',
      path: fieldName,
      value: allRefs,
    };
  }

  return {
    type: 'ref_field',
    cardinality: 'MANY',
    path: fieldName,
    value: refs,
  };
};

const resolveRefValue = (
  value: unknown,
  _node: BQLMutation,
  _parentName: string,
  ctx: BuildContext,
): Ref | undefined => {
  if (typeof value === 'string') {
    // Type:id format
    const parsed = parsePrefixedRef(value);
    if (parsed) {
      return parsed;
    }
    // _:tempId format
    if (value.startsWith('_:')) {
      const tempId = value;
      const resolved = ctx.tempIdMap.get(tempId);
      if (!resolved) {
        throw new Error(
          `Can't link a $tempId that has not been created in the current mutation: ${tempId.replace(/^_:/, '')}`,
        );
      }
      return resolved;
    }
    throw new Error(`Invalid ref value: ${value}. Expected 'Type:id' format.`);
  }
  if (isObject(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.$thing && obj.$id) {
      return { thing: obj.$thing as string, id: obj.$id as string };
    }
    if (obj.$tempId) {
      const resolved = ctx.tempIdMap.get(obj.$tempId as string);
      if (!resolved) {
        throw new Error(
          `Can't link a $tempId that has not been created in the current mutation: ${String(obj.$tempId).replace(/^_:/, '')}`,
        );
      }
      return resolved;
    }
  }
  return undefined;
};

const resolveRefLink = (obj: Record<string, unknown>, ctx: BuildContext): Ref | undefined => {
  if (obj.$id) {
    const ids = Array.isArray(obj.$id) ? obj.$id : [obj.$id];
    // Return first ref; for batch $id, caller handles it
    if (obj.$thing) {
      return { thing: obj.$thing as string, id: ids[0] as string };
    }
  }
  if (obj.$tempId) {
    const resolved = ctx.tempIdMap.get(obj.$tempId as string);
    if (!resolved) {
      throw new Error(
        `Can't link a $tempId that has not been created in the current mutation: ${String(obj.$tempId).replace(/^_:/, '')}`,
      );
    }
    return resolved;
  }
  return undefined;
};

// --- Flex field ---

const buildFlexFieldValue = (
  fieldName: string,
  value: unknown,
  field: DRAFT_EnrichedBormRefField,
  ctx: BuildContext,
  parentName?: string,
): ValueMut => {
  if (field.cardinality === 'ONE') {
    return {
      type: 'flex_field',
      cardinality: 'ONE',
      path: fieldName,
      value: resolveFlexValueWithCreate(value, ctx, parentName),
    };
  }

  const items = Array.isArray(value) ? value : [value];
  return {
    type: 'flex_field',
    cardinality: 'MANY',
    path: fieldName,
    value: items.map((item) => resolveFlexValueWithCreate(item, ctx, parentName)),
  };
};

/** Like resolveFlexValue but also handles $op: 'create' by creating the entity */
const resolveFlexValueWithCreate = (value: unknown, ctx: BuildContext, parentName?: string): FlexValue => {
  if (isObject(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.$op === 'create' && obj.$thing) {
      // Create the entity and return a RecordId reference
      const nestedThing = ctx.schema[obj.$thing as string];
      if (!nestedThing) {
        throw new Error(`Thing '${obj.$thing}' not found in schema`);
      }
      const createName = buildCreate(obj as BQLMutation, nestedThing, parentName ?? null, null, ctx);
      const createMut = ctx.mutation.creates.find((c) => c.name === createName)!;
      return new RecordId(createMut.thing, createMut.id);
    }
  }
  return resolveFlexValue(value, ctx);
};

const resolveFlexValue = (value: unknown, ctx: BuildContext): FlexValue => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    // Check Type:_:tempId format
    const tempIdMatch = /^([^:]+):(_:.+)$/.exec(value);
    if (tempIdMatch) {
      const [, thing, tempId] = tempIdMatch;
      const resolved = ctx.tempIdMap.get(tempId);
      if (resolved) {
        return new RecordId(thing, resolved.id);
      }
    }
    // Check Type:id format for implicit link
    const parsed = parsePrefixedRef(value);
    if (parsed && ctx.schema[parsed.thing]) {
      return new RecordId(parsed.thing, parsed.id);
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof RecordId) {
    return value;
  }

  if (isObject(value)) {
    const obj = value as Record<string, unknown>;

    // Check for disallowed operations (allow create and link)
    if (obj.$op && obj.$op !== 'link' && obj.$op !== 'create') {
      throw new Error(`Flex fields do not support '$op: ${obj.$op}' operations. Use link operations instead.`);
    }

    // Explicit link: { $thing, $id } exactly
    const keys = Object.keys(obj);
    if (
      (keys.length === 2 && obj.$thing && obj.$id) ||
      (keys.length === 3 && obj.$thing && obj.$id && obj.$op === 'link')
    ) {
      return new RecordId(obj.$thing as string, obj.$id as string);
    }

    // $ref syntax
    if (keys.length === 1 && obj.$ref && typeof obj.$ref === 'string') {
      const parsed = parsePrefixedRef(obj.$ref as string);
      if (parsed) {
        return new RecordId(parsed.thing, parsed.id);
      }
    }

    // Plain object
    const result: Record<string, FlexValue> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveFlexValue(v, ctx);
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveFlexValue(item, ctx));
  }

  return value as FlexValue;
};

// --- Role field ---

const buildRoleFieldValue = (
  fieldName: string,
  value: unknown,
  field: DRAFT_EnrichedBormRoleField,
  node: BQLMutation,
  parentName: string,
  ctx: BuildContext,
): ValueMut | undefined => {
  // Check for ambiguous ONE-cardinality nested block under update
  if (
    field.cardinality === 'ONE' &&
    node.$op === 'update' &&
    isObject(value) &&
    !Array.isArray(value) &&
    !(value as Record<string, unknown>).$op &&
    !(value as Record<string, unknown>).$id &&
    !(value as Record<string, unknown>).$tempId &&
    hasNonDollarFields(value as Record<string, unknown>)
  ) {
    throw new Error(`Please specify if it is a create or an update. Path: $root.0.${fieldName}`);
  }

  // Plain string or string array = replace
  if (typeof value === 'string') {
    const ref: Ref = { thing: field.opposite.thing, id: value };
    if (field.cardinality === 'ONE') {
      return { type: 'role_field', cardinality: 'ONE', path: fieldName, ref };
    }
    return { type: 'role_field', cardinality: 'MANY', op: 'replace', path: fieldName, refs: [ref] };
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    const refs = (value as string[]).map((id) => ({ thing: field.opposite.thing, id }));
    return { type: 'role_field', cardinality: 'MANY', op: 'replace', path: fieldName, refs };
  }

  // Array of mutation blocks
  const items = Array.isArray(value) ? value : [value];
  const refs: Ref[] = [];
  const links: Ref[] = [];
  const unlinks: Ref[] = [];
  let hasLinkUnlink = false;
  let hasUnlinkAll = false;

  for (const item of items) {
    if (!isObject(item)) {
      // Plain string id in array
      refs.push({ thing: field.opposite.thing, id: item as string });
      continue;
    }

    const block = item as Record<string, unknown>;
    const op = block.$op as string | undefined;

    if (op === 'create' || (!op && hasNonDollarFields(block))) {
      // Nested create
      const nestedThing = block.$thing ? ctx.schema[block.$thing as string] : ctx.schema[field.opposite.thing];
      if (!nestedThing) {
        throw new Error(`Thing '${field.opposite.thing}' not found in schema`);
      }
      if (!block.$thing) {
        block.$thing = nestedThing.name;
      }
      if (!block.$op) {
        block.$op = 'create';
      }
      const createName = buildCreate(block as BQLMutation, nestedThing, parentName, null, ctx);
      const createMut = ctx.mutation.creates.find((c) => c.name === createName)!;
      refs.push({ thing: createMut.thing, id: createMut.id });
    } else if (op === 'link') {
      hasLinkUnlink = true;
      if (block.$id) {
        const ids = Array.isArray(block.$id) ? block.$id : [block.$id];
        for (const id of ids) {
          links.push(resolveRoleRef(id as string, block, field, ctx));
        }
      } else if (block.$tempId) {
        const resolved = ctx.tempIdMap.get(block.$tempId as string);
        if (!resolved) {
          throw new Error(
            `Can't link a $tempId that has not been created in the current mutation: ${String(block.$tempId).replace(/^_:/, '')}`,
          );
        }
        links.push(resolved);
      }
    } else if (op === 'unlink') {
      hasLinkUnlink = true;
      if (block.$id) {
        const ids = Array.isArray(block.$id) ? block.$id : [block.$id];
        for (const id of ids) {
          unlinks.push(resolveRoleRef(id as string, block, field, ctx));
        }
      } else {
        hasUnlinkAll = true;
      }
    } else if (op === 'update') {
      // Nested update: creates SubMatch + UpdateMut
      const nestedThing = block.$thing ? ctx.schema[block.$thing as string] : ctx.schema[field.opposite.thing];
      if (!nestedThing) {
        throw new Error(`Thing '${field.opposite.thing}' not found`);
      }
      if (!block.$thing) {
        block.$thing = nestedThing.name;
      }
      buildUpdate(block as BQLMutation, nestedThing, parentName, fieldName, ctx, field.cardinality);
    } else if (op === 'delete') {
      // Nested delete: creates SubMatch + DeleteMut
      const nestedThing = block.$thing ? ctx.schema[block.$thing as string] : ctx.schema[field.opposite.thing];
      if (!nestedThing) {
        throw new Error(`Thing '${field.opposite.thing}' not found`);
      }
      if (!block.$thing) {
        block.$thing = nestedThing.name;
      }
      buildDelete(block as BQLMutation, nestedThing, parentName, fieldName, ctx, field.cardinality);
    }
  }

  // Determine the role field value mutation
  if (field.cardinality === 'ONE') {
    if (refs.length > 0) {
      return { type: 'role_field', cardinality: 'ONE', path: fieldName, ref: refs[0] };
    }
    if (links.length > 0) {
      return { type: 'role_field', cardinality: 'ONE', path: fieldName, ref: links[0] };
    }
    return undefined;
  }

  // MANY cardinality
  if (hasLinkUnlink) {
    if (hasUnlinkAll && links.length > 0) {
      // Unlink all then link new = replace
      return { type: 'role_field', cardinality: 'MANY', op: 'replace', path: fieldName, refs: links };
    }
    if (hasUnlinkAll) {
      return { type: 'role_field', cardinality: 'MANY', op: 'replace', path: fieldName, refs: [] };
    }
    return {
      type: 'role_field',
      cardinality: 'MANY',
      op: 'patch',
      path: fieldName,
      links: [...links],
      unlinks: [...unlinks],
    };
  }

  if (refs.length > 0) {
    return { type: 'role_field', cardinality: 'MANY', op: 'replace', path: fieldName, refs };
  }

  return undefined;
};

const resolveRoleRef = (
  id: string,
  block: Record<string, unknown>,
  field: DRAFT_EnrichedBormRoleField,
  ctx: BuildContext,
): Ref => {
  const thing = (block.$thing as string) ?? field.opposite.thing;
  const thingSchema = ctx.schema[thing];
  const subTypes = thingSchema?.subTypes?.length ? thingSchema.subTypes : undefined;
  // Check if id is a tempId reference
  if (id.startsWith('_:')) {
    const resolved = ctx.tempIdMap.get(id);
    if (!resolved) {
      throw new Error(
        `Can't link a $tempId that has not been created in the current mutation: ${id.replace(/^_:/, '')}`,
      );
    }
    return resolved;
  }
  return { thing, subTypes, id };
};

// --- Link field ---

const buildLinkFieldValue = (
  fieldName: string,
  value: unknown,
  field: DRAFT_EnrichedBormLinkField,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  node: BQLMutation,
  parentName: string,
  ctx: BuildContext,
): void => {
  if (field.target === 'relation') {
    buildLinkFieldTargetRelation(
      fieldName,
      value,
      field as DRAFT_EnrichedBormLinkFieldTargetRelation,
      thing,
      node,
      parentName,
      ctx,
    );
  } else {
    buildLinkFieldTargetRole(
      fieldName,
      value,
      field as DRAFT_EnrichedBormLinkFieldTargetRole,
      thing,
      node,
      parentName,
      ctx,
    );
  }
};

const buildLinkFieldTargetRelation = (
  fieldName: string,
  value: unknown,
  field: DRAFT_EnrichedBormLinkFieldTargetRelation,
  _thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  node: BQLMutation,
  parentName: string,
  ctx: BuildContext,
): void => {
  const relation = ctx.schema[field.relation];
  if (!relation) {
    throw new Error(`Relation '${field.relation}' not found`);
  }

  // Get parent IDs for linking (may be multiple with $id: ['a', 'b'])
  const parentThing = getThing(node, ctx);
  const parentIdFieldName = getIdFieldName(parentThing);
  const parentId = getNodeId(node, parentIdFieldName, ctx);
  const allParentIds = node.$id && Array.isArray(node.$id) ? (node.$id as string[]) : [parentId];

  const items = Array.isArray(value) ? value : [value];

  // For link operations, process each item for each parent ID
  for (const item of items) {
    if (typeof item === 'string') {
      // Plain string = replace with link; parse prefix format if present
      const parsedItem = parsePrefixedRef(item);
      linkToRelation(field, parentId, parentThing.name, parsedItem?.id ?? item, ctx);
      continue;
    }

    if (!isObject(item)) {
      continue;
    }
    const block = item as Record<string, unknown>;
    const op = block.$op as string | undefined;

    if (op === 'link') {
      const ids = block.$id ? ((Array.isArray(block.$id) ? block.$id : [block.$id]) as string[]) : [];
      if (block.$tempId) {
        const resolved = ctx.tempIdMap.get(block.$tempId as string);
        if (!resolved) {
          throw new Error(
            `Can't link a $tempId that has not been created in the current mutation: ${String(block.$tempId).replace(/^_:/, '')}`,
          );
        }
        ids.push(resolved.id);
      }
      for (const id of ids) {
        for (const pid of allParentIds) {
          linkToRelation(field, pid, parentThing.name, id, ctx);
        }
      }
    } else if (op === 'unlink') {
      if (block.$id) {
        const ids = (Array.isArray(block.$id) ? block.$id : [block.$id]) as string[];
        for (const id of ids) {
          for (const pid of allParentIds) {
            unlinkFromRelation(field, pid, parentThing.name, id, ctx);
          }
        }
      } else {
        unlinkAllFromRelation(field, parentId, parentThing.name, parentName, ctx);
      }
    } else if (op === 'update') {
      // SubMatch on relation through computed field, then UpdateMut
      if (!block.$thing) {
        block.$thing = field.relation;
      }
      const relThing = ctx.schema[block.$thing as string];
      if (!relThing) {
        throw new Error(`Thing '${block.$thing}' not found`);
      }
      buildUpdate(block as BQLMutation, relThing, parentName, fieldName, ctx, field.cardinality, true);
    } else if (op === 'delete') {
      if (!block.$thing) {
        block.$thing = field.relation;
      }
      const relThing = ctx.schema[block.$thing as string];
      if (!relThing) {
        throw new Error(`Thing '${block.$thing}' not found`);
      }
      buildDelete(block as BQLMutation, relThing, parentName, fieldName, ctx, field.cardinality, true);
    } else {
      // Create: new relation record with parent linked
      if (!block.$thing) {
        block.$thing = field.relation;
      }
      block.$op = block.$op ?? 'create';
      const relThing = ctx.schema[block.$thing as string];
      if (!relThing) {
        throw new Error(`Thing '${block.$thing}' not found`);
      }

      // Set/append the plays role to include parent
      {
        const relSchema = ctx.schema[field.relation];
        const playsField = relSchema?.type === 'relation' ? relSchema.fields[field.plays] : undefined;
        if (playsField?.type === 'role' && playsField.cardinality === 'ONE') {
          block[field.plays] = parentId;
        } else if (block[field.plays] === undefined) {
          block[field.plays] = [parentId];
        } else {
          // Append parent to existing role array
          const existing = Array.isArray(block[field.plays]) ? (block[field.plays] as unknown[]) : [block[field.plays]];
          existing.push(parentId);
          block[field.plays] = existing;
        }
      }

      buildCreate(block as BQLMutation, relThing, parentName, null, ctx);
    }
  }
};

const buildLinkFieldTargetRole = (
  fieldName: string,
  value: unknown,
  field: DRAFT_EnrichedBormLinkFieldTargetRole,
  _thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  node: BQLMutation,
  parentName: string,
  ctx: BuildContext,
): void => {
  // Ambiguity check for ONE-cardinality link fields under update
  if (
    field.cardinality === 'ONE' &&
    node.$op === 'update' &&
    isObject(value) &&
    !Array.isArray(value) &&
    !(value as Record<string, unknown>).$op &&
    !(value as Record<string, unknown>).$id &&
    !(value as Record<string, unknown>).$tempId &&
    hasNonDollarFields(value as Record<string, unknown>)
  ) {
    throw new Error(`Please specify if it is a create or an update. Path: $root.0.${fieldName}`);
  }

  const relation = ctx.schema[field.relation];
  if (!relation) {
    throw new Error(`Relation '${field.relation}' not found`);
  }

  const parentThing = getThing(node, ctx);
  const parentIdFieldName = getIdFieldName(parentThing);
  const parentId = getNodeId(node, parentIdFieldName, ctx);

  const items = Array.isArray(value) ? value : [value];

  for (const item of items) {
    if (typeof item === 'string') {
      // Check for Type:_:tempId format (e.g., 'God:_:tempUser')
      const typeTempIdMatch = /^([^:]+):(_:.+)$/.exec(item);
      if (typeTempIdMatch) {
        const [, thingName, tempId] = typeTempIdMatch;
        const resolved = ctx.tempIdMap.get(tempId);
        if (resolved) {
          createIntermediaryWithThing(field, parentId, parentThing.name, thingName, resolved.id, ctx);
        } else {
          throw new Error(
            `Can't link a $tempId that has not been created in the current mutation: ${tempId.replace(/^_:/, '')}`,
          );
        }
        continue;
      }
      // Parse prefix format (e.g., 'God:god1')
      const parsed = parsePrefixedRef(item);
      if (parsed) {
        createIntermediaryWithThing(field, parentId, parentThing.name, parsed.thing, parsed.id, ctx);
      } else if (item.startsWith('_:')) {
        // Plain tempId reference
        const resolved = ctx.tempIdMap.get(item);
        if (resolved) {
          createIntermediary(field, parentId, parentThing.name, resolved.id, ctx);
        } else {
          throw new Error(
            `Can't link a $tempId that has not been created in the current mutation: ${item.replace(/^_:/, '')}`,
          );
        }
      } else {
        createIntermediary(field, parentId, parentThing.name, item, ctx);
      }
      continue;
    }

    if (!isObject(item)) {
      continue;
    }
    const block = item as Record<string, unknown>;
    const op = block.$op as string | undefined;

    if (op === 'link') {
      const ids = block.$id ? ((Array.isArray(block.$id) ? block.$id : [block.$id]) as string[]) : [];
      if (block.$tempId) {
        const resolved = ctx.tempIdMap.get(block.$tempId as string);
        if (!resolved) {
          throw new Error(
            `Can't link a $tempId that has not been created in the current mutation: ${String(block.$tempId).replace(/^_:/, '')}`,
          );
        }
        ids.push(resolved.id);
      }
      if (ids.length === 0 && !block.$tempId) {
        // For ONE-cardinality link fields under update, "link all" is not allowed
        // because it would create multiple intermediaries for a ONE-cardinality role
        if (node.$op === 'update' && field.cardinality === 'ONE') {
          throw new Error('The query was not executed due to a failed transaction');
        }
        // "Link ALL" — link to all existing entities of the opposite type
        const oppositeThings = [field.opposite.thing, ...(ctx.schema[field.opposite.thing]?.subTypes ?? [])];
        const relationSchema = ctx.schema[field.relation];
        const playsRoleSchema = relationSchema?.type === 'relation' ? relationSchema.fields[field.plays] : undefined;
        const targetRoleSchema =
          relationSchema?.type === 'relation' ? relationSchema.fields[field.targetRole] : undefined;
        const playsCard = playsRoleSchema?.type === 'role' ? playsRoleSchema.cardinality : 'MANY';
        const targetCard = targetRoleSchema?.type === 'role' ? targetRoleSchema.cardinality : 'MANY';
        if (!ctx.mutation.linkAlls) {
          ctx.mutation.linkAlls = [];
        }
        ctx.mutation.linkAlls.push({
          oppositeThings,
          relation: field.relation,
          playsField: field.plays,
          targetRoleField: field.targetRole,
          playsCardinality: playsCard,
          targetCardinality: targetCard,
          parentThing: parentThing.name,
          parentId,
        });
      } else {
        for (const id of ids) {
          createIntermediary(field, parentId, parentThing.name, id, ctx);
        }
      }
    } else if (op === 'unlink') {
      if (block.$id) {
        const ids = (Array.isArray(block.$id) ? block.$id : [block.$id]) as string[];
        for (const id of ids) {
          unlinkThroughIntermediary(field, parentId, parentThing.name, id, parentName, ctx);
        }
      } else {
        unlinkAllThroughIntermediary(field, parentId, parentThing.name, parentName, ctx);
      }
    } else if (op === 'update') {
      // SubMatch target entities through link path, then UpdateMut
      const targetThing = block.$thing ? ctx.schema[block.$thing as string] : ctx.schema[field.opposite.thing];
      if (!targetThing) {
        throw new Error(`Thing '${field.opposite.thing}' not found`);
      }
      if (!block.$thing) {
        block.$thing = targetThing.name;
      }
      buildUpdate(block as BQLMutation, targetThing, parentName, fieldName, ctx, field.cardinality, true);
    } else if (op === 'delete') {
      const targetThing = block.$thing ? ctx.schema[block.$thing as string] : ctx.schema[field.opposite.thing];
      if (!targetThing) {
        throw new Error(`Thing '${field.opposite.thing}' not found`);
      }
      if (!block.$thing) {
        block.$thing = targetThing.name;
      }
      buildDelete(block as BQLMutation, targetThing, parentName, fieldName, ctx, field.cardinality, true);
    } else {
      // Create: new target entity + new intermediary
      const targetThingName = block.$thing ?? field.opposite.thing;
      const targetThing = ctx.schema[targetThingName as string];
      if (!targetThing) {
        throw new Error(`Thing '${targetThingName}' not found`);
      }
      if (!block.$thing) {
        block.$thing = targetThing.name;
      }
      block.$op = block.$op ?? 'create';

      const createName = buildCreate(block as BQLMutation, targetThing, parentName, null, ctx);
      const createMut = ctx.mutation.creates.find((c) => c.name === createName)!;
      createIntermediary(field, parentId, parentThing.name, createMut.id, ctx);
    }
  }
};

// --- Intermediary helpers ---

const linkToRelation = (
  field: DRAFT_EnrichedBormLinkFieldTargetRelation,
  parentId: string,
  parentThing: string,
  targetId: string,
  ctx: BuildContext,
): void => {
  // Update existing relation: add parent to the plays role
  const name = genName(field.relation, ctx);
  const relationThingSchema = ctx.schema[field.relation];
  if (!relationThingSchema) {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const thingNames: [string, ...string[]] = [field.relation, ...relationThingSchema.subTypes];

  const match: Match = {
    name,
    source: { type: 'record_pointer', thing: thingNames, ids: [targetId] },
  };
  ctx.mutation.matches.push(match);

  const updateName = genName(field.relation, ctx);
  const update: UpdateMut = {
    name: updateName,
    match: name,
    op: 'update',
    values: {
      [field.plays]: {
        type: 'role_field',
        cardinality: 'MANY',
        op: 'patch',
        path: field.plays,
        links: [
          {
            thing: parentThing,
            subTypes: ctx.schema[parentThing]?.subTypes?.length ? ctx.schema[parentThing].subTypes : undefined,
            id: parentId,
          },
        ],
        unlinks: [],
      },
    },
  };
  ctx.mutation.updates.push(update);
};

const unlinkFromRelation = (
  field: DRAFT_EnrichedBormLinkFieldTargetRelation,
  parentId: string,
  parentThing: string,
  targetId: string,
  ctx: BuildContext,
): void => {
  const name = genName(field.relation, ctx);
  const relationThingSchema = ctx.schema[field.relation];
  if (!relationThingSchema) {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const thingNames: [string, ...string[]] = [field.relation, ...relationThingSchema.subTypes];

  const match: Match = {
    name,
    source: { type: 'record_pointer', thing: thingNames, ids: [targetId] },
  };
  ctx.mutation.matches.push(match);

  const updateName = genName(field.relation, ctx);
  const update: UpdateMut = {
    name: updateName,
    match: name,
    op: 'update',
    values: {
      [field.plays]: buildUnlinkRoleValue(
        field.plays,
        parentThing,
        parentId,
        getPlaysRoleCardinality(field.relation, field.plays, ctx),
      ),
    },
  };
  ctx.mutation.updates.push(update);
};

const getPlaysRoleCardinality = (relation: string, plays: string, ctx: BuildContext): 'ONE' | 'MANY' => {
  const relSchema = ctx.schema[relation];
  if (relSchema?.type === 'relation') {
    const roleField = relSchema.fields[plays];
    if (roleField?.type === 'role') {
      return roleField.cardinality;
    }
  }
  return 'MANY';
};

const buildUnlinkRoleValue = (
  path: string,
  parentThing: string,
  parentId: string,
  cardinality: 'ONE' | 'MANY',
): ValueMut => {
  if (cardinality === 'ONE') {
    return { type: 'null', path };
  }
  return {
    type: 'role_field',
    cardinality: 'MANY',
    op: 'patch',
    path,
    links: [],
    unlinks: [{ thing: parentThing, id: parentId }],
  };
};

/**
 * Strategy 1: Find a sibling link field on the parent entity that plays the same role
 * in the same relation and has target === 'relation'. If found, use its COMPUTED field
 * path for traversal (faster than table scan).
 */
const findSiblingRelationLinkField = (
  parentThing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  relation: string,
  plays: string,
): DRAFT_EnrichedBormLinkFieldTargetRelation | undefined => {
  for (const f of Object.values(parentThing.fields)) {
    if (f.type === 'link' && f.target === 'relation' && f.relation === relation && f.plays === plays) {
      return f as DRAFT_EnrichedBormLinkFieldTargetRelation;
    }
  }
  return undefined;
};

const unlinkAllFromRelation = (
  field: DRAFT_EnrichedBormLinkFieldTargetRelation,
  _parentId: string,
  _parentThing: string,
  parentMatchName: string,
  ctx: BuildContext,
): void => {
  const name = genName(field.relation, ctx);

  const relationThingSchema = ctx.schema[field.relation];
  if (!relationThingSchema) {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const thingNames: [string, ...string[]] = [field.relation, ...relationThingSchema.subTypes];

  // Strategy 1: Use sibling link field's COMPUTED path if available
  const parentThingSchema = ctx.schema[_parentThing];
  const siblingField = parentThingSchema
    ? findSiblingRelationLinkField(parentThingSchema, field.relation, field.plays)
    : undefined;

  if (siblingField) {
    // Use SubMatch traversal through the COMPUTED field path
    const subMatch: SubMatch = {
      name,
      parent: parentMatchName,
      path: siblingField.name,
      cardinality: siblingField.cardinality,
      isComputed: true,
    };
    ctx.mutation.subMatches.push(subMatch);
  } else {
    // Strategy 2: Filter the relation table directly
    buildUnlinkAllFromRelationTableScan(name, field, _parentId, _parentThing, thingNames, ctx);
  }

  const playsCardinality = getPlaysRoleCardinality(field.relation, field.plays, ctx);
  const updateName = genName(field.relation, ctx);
  const update: UpdateMut = {
    name: updateName,
    match: name,
    op: 'update',
    values: {
      [field.plays]: buildUnlinkRoleValue(field.plays, _parentThing, _parentId, playsCardinality),
    },
  };
  ctx.mutation.updates.push(update);
};

const buildUnlinkAllFromRelationTableScan = (
  name: string,
  field: DRAFT_EnrichedBormLinkFieldTargetRelation,
  parentId: string,
  parentThing: string,
  thingNames: [string, ...string[]],
  ctx: BuildContext,
): void => {
  const playsCardForRelation = getPlaysRoleCardinality(field.relation, field.plays, ctx);
  const playsFilterForRelation: Filter =
    playsCardForRelation === 'ONE'
      ? { type: 'ref', op: 'IN', left: field.plays, right: [parentId], thing: [parentThing], cardinality: 'ONE' }
      : {
          type: 'ref',
          op: 'CONTAINSANY',
          left: field.plays,
          right: [parentId],
          thing: [parentThing],
          cardinality: 'MANY',
        };

  const match: Match = {
    name,
    source: { type: 'table_scan', thing: thingNames },
    filter: playsFilterForRelation,
  };
  ctx.mutation.matches.push(match);
};

/** Like createIntermediary but uses an explicit thing for the target role ref */
const createIntermediaryWithThing = (
  field: DRAFT_EnrichedBormLinkFieldTargetRole,
  parentId: string,
  parentThing: string,
  targetThing: string,
  targetId: string,
  ctx: BuildContext,
): void => {
  const intermediaryId = genRandomId();
  const name = genName(field.relation, ctx);
  const relationSchema = ctx.schema[field.relation];
  if (!relationSchema || relationSchema.type !== 'relation') {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const playsRoleField = relationSchema.fields[field.plays];
  const playsCardinality = playsRoleField?.type === 'role' ? playsRoleField.cardinality : 'MANY';
  const parentSchema = ctx.schema[parentThing];
  const parentSubTypes = parentSchema?.subTypes?.length ? parentSchema.subTypes : undefined;
  const targetSchema = ctx.schema[targetThing];
  const targetSubTypes = targetSchema?.subTypes?.length ? targetSchema.subTypes : undefined;
  const parentRef: Ref = { thing: parentThing, subTypes: parentSubTypes, id: parentId };
  const targetRef: Ref = { thing: targetThing, subTypes: targetSubTypes, id: targetId };

  const create: CreateMut = {
    name,
    thing: field.relation,
    id: intermediaryId,
    op: 'create',
    values: {
      [field.plays]:
        playsCardinality === 'ONE'
          ? { type: 'role_field' as const, cardinality: 'ONE' as const, path: field.plays, ref: parentRef }
          : {
              type: 'role_field' as const,
              cardinality: 'MANY' as const,
              op: 'replace' as const,
              path: field.plays,
              refs: [parentRef],
            },
      [field.targetRole]:
        field.targetRoleCardinality === 'ONE'
          ? { type: 'role_field' as const, cardinality: 'ONE' as const, path: field.targetRole, ref: targetRef }
          : {
              type: 'role_field' as const,
              cardinality: 'MANY' as const,
              op: 'replace' as const,
              path: field.targetRole,
              refs: [targetRef],
            },
    },
  };
  create.isIntermediary = true;
  ctx.mutation.creates.push(create);
};

const createIntermediary = (
  field: DRAFT_EnrichedBormLinkFieldTargetRole,
  parentId: string,
  parentThing: string,
  targetId: string,
  ctx: BuildContext,
): void => {
  const intermediaryId = genRandomId();
  const name = genName(field.relation, ctx);

  // Look up the target role's thing from the schema
  const relationSchema = ctx.schema[field.relation];
  if (!relationSchema || relationSchema.type !== 'relation') {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const targetRoleField = relationSchema.fields[field.targetRole];
  if (!targetRoleField || targetRoleField.type !== 'role') {
    throw new Error(`Role '${field.targetRole}' not found in relation '${field.relation}'`);
  }
  const targetRefThing = targetRoleField.opposite.thing;
  const targetRefSchema = ctx.schema[targetRefThing];
  const targetSubTypes = targetRefSchema?.subTypes?.length ? targetRefSchema.subTypes : undefined;
  const parentSchema = ctx.schema[parentThing];
  const parentSubTypes = parentSchema?.subTypes?.length ? parentSchema.subTypes : undefined;

  // Check plays role cardinality
  const playsRoleField = relationSchema.fields[field.plays];
  const playsCardinality = playsRoleField?.type === 'role' ? playsRoleField.cardinality : 'MANY';

  const parentRef: Ref = { thing: parentThing, subTypes: parentSubTypes, id: parentId };
  const targetRef: Ref = { thing: targetRefThing, subTypes: targetSubTypes, id: targetId };

  const create: CreateMut = {
    name,
    thing: field.relation,
    id: intermediaryId,
    op: 'create',
    values: {
      [field.plays]:
        playsCardinality === 'ONE'
          ? {
              type: 'role_field' as const,
              cardinality: 'ONE' as const,
              path: field.plays,
              ref: parentRef,
            }
          : {
              type: 'role_field' as const,
              cardinality: 'MANY' as const,
              op: 'replace' as const,
              path: field.plays,
              refs: [parentRef],
            },
      [field.targetRole]:
        field.targetRoleCardinality === 'ONE'
          ? {
              type: 'role_field' as const,
              cardinality: 'ONE' as const,
              path: field.targetRole,
              ref: targetRef,
            }
          : {
              type: 'role_field' as const,
              cardinality: 'MANY' as const,
              op: 'replace' as const,
              path: field.targetRole,
              refs: [targetRef],
            },
    },
  };
  create.isIntermediary = true;
  ctx.mutation.creates.push(create);
};

const unlinkThroughIntermediary = (
  field: DRAFT_EnrichedBormLinkFieldTargetRole,
  parentId: string,
  parentThing: string,
  _targetId: string,
  _parentMatchName: string,
  ctx: BuildContext,
): void => {
  // Find intermediary records and remove parent from plays role
  const name = genName(field.relation, ctx);
  const relationThingSchema = ctx.schema[field.relation];
  if (!relationThingSchema) {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const thingNames: [string, ...string[]] = [field.relation, ...relationThingSchema.subTypes];

  // Build filter: WHERE <plays> CONTAINSANY [$parentId] AND <targetRole> CONTAINSANY [$targetId]
  const targetRoleField =
    relationThingSchema.type === 'relation' ? relationThingSchema.fields[field.targetRole] : undefined;
  const targetRefThing = targetRoleField?.type === 'role' ? targetRoleField.opposite.thing : field.opposite.thing;

  const playsCardForUnlink = getPlaysRoleCardinality(field.relation, field.plays, ctx);
  const playsFilter: Filter =
    playsCardForUnlink === 'ONE'
      ? { type: 'ref', op: 'IN', left: field.plays, right: [parentId], thing: [parentThing], cardinality: 'ONE' }
      : {
          type: 'ref',
          op: 'CONTAINSANY',
          left: field.plays,
          right: [parentId],
          thing: [parentThing],
          cardinality: 'MANY',
        };
  const targetCardForUnlink = targetRoleField?.type === 'role' ? targetRoleField.cardinality : 'MANY';
  const targetFilter: Filter =
    targetCardForUnlink === 'ONE'
      ? {
          type: 'ref' as const,
          op: 'IN' as const,
          left: field.targetRole,
          right: [_targetId],
          thing: [targetRefThing],
          cardinality: 'ONE' as const,
        }
      : {
          type: 'ref' as const,
          op: 'CONTAINSANY' as const,
          left: field.targetRole,
          right: [_targetId],
          thing: [targetRefThing],
          cardinality: 'MANY' as const,
        };

  const match: Match = {
    name,
    source: { type: 'table_scan', thing: thingNames },
    filter: { type: 'and', filters: [playsFilter, targetFilter] },
  };
  ctx.mutation.matches.push(match);

  const playsCardinality = getPlaysRoleCardinality(field.relation, field.plays, ctx);
  const updateName = genName(field.relation, ctx);
  const update: UpdateMut = {
    name: updateName,
    match: name,
    op: 'update',
    values: {
      [field.plays]: buildUnlinkRoleValue(field.plays, parentThing, parentId, playsCardinality),
    },
  };
  ctx.mutation.updates.push(update);
};

const unlinkAllThroughIntermediary = (
  field: DRAFT_EnrichedBormLinkFieldTargetRole,
  parentId: string,
  parentThing: string,
  parentMatchName: string,
  ctx: BuildContext,
): void => {
  const name = genName(field.relation, ctx);
  const relationThingSchema = ctx.schema[field.relation];
  if (!relationThingSchema) {
    throw new Error(`Relation '${field.relation}' not found`);
  }
  const thingNames: [string, ...string[]] = [field.relation, ...relationThingSchema.subTypes];

  // Strategy 1: Use sibling link field's COMPUTED path if available
  const parentThingSchema = ctx.schema[parentThing];
  const siblingField = parentThingSchema
    ? findSiblingRelationLinkField(parentThingSchema, field.relation, field.plays)
    : undefined;

  if (siblingField) {
    const subMatch: SubMatch = {
      name,
      parent: parentMatchName,
      path: siblingField.name,
      cardinality: siblingField.cardinality,
      isComputed: true,
    };
    ctx.mutation.subMatches.push(subMatch);
  } else {
    // Strategy 2: Filter the intermediary table directly
    const playsCardinality2 = getPlaysRoleCardinality(field.relation, field.plays, ctx);
    const playsFilter: Filter =
      playsCardinality2 === 'ONE'
        ? { type: 'ref', op: 'IN', left: field.plays, right: [parentId], thing: [parentThing], cardinality: 'ONE' }
        : {
            type: 'ref',
            op: 'CONTAINSANY',
            left: field.plays,
            right: [parentId],
            thing: [parentThing],
            cardinality: 'MANY',
          };

    const match: Match = {
      name,
      source: { type: 'table_scan', thing: thingNames },
      filter: playsFilter,
    };
    ctx.mutation.matches.push(match);
  }

  const updateName = genName(field.relation, ctx);
  const update: UpdateMut = {
    name: updateName,
    match: name,
    op: 'update',
    values: {
      [field.plays]: buildUnlinkRoleValue(
        field.plays,
        parentThing,
        parentId,
        getPlaysRoleCardinality(field.relation, field.plays, ctx),
      ),
    },
  };
  ctx.mutation.updates.push(update);
};

// --- Value validation ---

export const validateValues = (mutation: LogicalMutation, schema: DRAFT_EnrichedBormSchema): void => {
  for (const create of mutation.creates) {
    const thing = schema[create.thing];
    if (!thing) {
      continue;
    }
    validateFieldsForThing(create.values, thing, 'create');
  }

  for (const update of mutation.updates) {
    const match =
      mutation.matches.find((m) => m.name === update.match) ?? mutation.subMatches.find((m) => m.name === update.match);
    if (!match) {
      continue;
    }
    let thingName: string | undefined;
    if ('source' in match) {
      const source = (match as Match).source;
      if (source.type !== 'subquery') {
        thingName = source.thing[0];
      }
    }
    if (!thingName) {
      continue;
    }
    const thing = schema[thingName];
    if (!thing) {
      continue;
    }
    validateFieldsForThing(update.values, thing, 'update');
  }
};

/** Validate all data fields for a thing: required → enum → fn per field. */
const validateFieldsForThing = (
  values: Record<string, ValueMut>,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
  op: 'create' | 'update',
): void => {
  const idFieldName = thing.idFields[0];

  for (const field of Object.values(thing.fields)) {
    if (field.type !== 'data' || field.isVirtual) {
      continue;
    }
    if (!field.validations) {
      continue;
    }

    const valueMut = values[field.name];

    // 1. Required check (create only, skip id field)
    if (op === 'create' && field.validations.required && field.name !== idFieldName && valueMut === undefined) {
      throw new Error(`[Validations] Required field "${field.name}" is missing.`);
    }

    // If the field has no value in the mutation, skip enum/fn checks
    if (!valueMut || valueMut.type !== 'data_field') {
      continue;
    }

    const vals = valueMut.cardinality === 'MANY' ? valueMut.value : [valueMut.value];
    for (const val of vals) {
      if (val === null) {
        continue;
      }

      // 2. Enum check
      if (field.validations.enum) {
        if (!field.validations.enum.includes(val as never)) {
          throw new Error(`[Validations] Option "${val}" is not a valid option for field "${field.name}".`);
        }
      }

      // 3. Function check
      if (field.validations.fn) {
        try {
          const result = (field.validations.fn as (v: unknown) => boolean)(val);
          if (!result) {
            throw new Error(`[Validations:attribute:${field.name}] Failed validation function.`);
          }
        } catch (fnErr) {
          if (fnErr instanceof Error && fnErr.message.startsWith('[Validations:attribute:')) {
            throw fnErr;
          }
          const msg = fnErr instanceof Error ? fnErr.message : String(fnErr);
          throw new Error(`[Validations:attribute:${field.name}] ${msg}`);
        }
      }
    }
  }
};

// --- Dependency ordering ---

const orderMutations = (mutation: LogicalMutation): void => {
  // Build dependency graph among creates
  const createMap = new Map<string, CreateMut>();
  for (const create of mutation.creates) {
    createMap.set(create.name, create);
  }

  const deps = new Map<string, Set<string>>();
  for (const create of mutation.creates) {
    const createDeps = new Set<string>();
    for (const valueMut of Object.values(create.values)) {
      collectRefDeps(valueMut, createMap, createDeps);
    }
    deps.set(create.name, createDeps);
  }

  // Topological sort with cycle detection
  const sorted: CreateMut[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string) => {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      // Cycle detected — break it
      resolveCycle(name, deps, mutation);
      return;
    }
    visiting.add(name);
    const createDeps = deps.get(name);
    if (createDeps) {
      for (const dep of createDeps) {
        if (createMap.has(dep)) {
          visit(dep);
        }
      }
    }
    visiting.delete(name);
    visited.add(name);
    const create = createMap.get(name);
    if (create) {
      sorted.push(create);
    }
  };

  for (const create of mutation.creates) {
    visit(create.name);
  }

  mutation.creates = sorted;
};

const collectRefDeps = (valueMut: ValueMut, createMap: Map<string, CreateMut>, deps: Set<string>): void => {
  if (valueMut.type === 'role_field') {
    if (valueMut.cardinality === 'ONE') {
      const _refKey = `${valueMut.ref.thing}:${valueMut.ref.id}`;
      for (const [name, create] of createMap) {
        if (create.thing === valueMut.ref.thing && create.id === valueMut.ref.id) {
          deps.add(name);
        }
      }
    } else if ('refs' in valueMut) {
      for (const ref of valueMut.refs) {
        for (const [name, create] of createMap) {
          if (create.thing === ref.thing && create.id === ref.id) {
            deps.add(name);
          }
        }
      }
    } else if ('links' in valueMut) {
      for (const ref of valueMut.links) {
        for (const [name, create] of createMap) {
          if (create.thing === ref.thing && create.id === ref.id) {
            deps.add(name);
          }
        }
      }
    }
  } else if (valueMut.type === 'ref_field') {
    // REF fields also create dependencies
    const refs = valueMut.cardinality === 'ONE' ? [valueMut.value] : valueMut.value;
    for (const refStr of refs) {
      const parsed = parsePrefixedRef(refStr);
      if (parsed) {
        for (const [name, create] of createMap) {
          if (create.thing === parsed.thing && create.id === parsed.id) {
            deps.add(name);
          }
        }
      }
    }
  }
};

const resolveCycle = (cycleName: string, deps: Map<string, Set<string>>, mutation: LogicalMutation): void => {
  // Find the cycle edge and break it by deferring one reference to an update
  const createDeps = deps.get(cycleName);
  if (!createDeps) {
    return;
  }

  // Pick first cyclic dep to break
  for (const dep of createDeps) {
    const depDeps = deps.get(dep);
    if (depDeps?.has(cycleName)) {
      // Break: remove the reference from cycleName's create and emit an update
      const create = mutation.creates.find((c) => c.name === cycleName);
      if (!create) {
        return;
      }

      for (const [fieldName, valueMut] of Object.entries(create.values)) {
        if (referencesCreate(valueMut, dep, mutation)) {
          // Move this field to a deferred update
          const update: UpdateMut = {
            name: genDeferredName(cycleName),
            match: cycleName,
            op: 'update',
            values: { [fieldName]: valueMut },
          };
          mutation.updates.push(update);
          delete create.values[fieldName];
          createDeps.delete(dep);
          return;
        }
      }
    }
  }
};

const referencesCreate = (valueMut: ValueMut, createName: string, mutation: LogicalMutation): boolean => {
  const create = mutation.creates.find((c) => c.name === createName);
  if (!create) {
    return false;
  }

  if (valueMut.type === 'role_field') {
    if (valueMut.cardinality === 'ONE') {
      return valueMut.ref.thing === create.thing && valueMut.ref.id === create.id;
    }
    if ('refs' in valueMut) {
      return valueMut.refs.some((r) => r.thing === create.thing && r.id === create.id);
    }
    if ('links' in valueMut) {
      return valueMut.links.some((r) => r.thing === create.thing && r.id === create.id);
    }
  }
  return false;
};

const genDeferredName = (baseName: string): string => `${baseName}_deferred`;

// --- Helpers ---

const getThing = (node: BQLMutation, ctx: BuildContext): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation => {
  const thing = ctx.schema[node.$thing];
  if (!thing) {
    throw new Error(`Thing '${node.$thing}' not found in schema`);
  }
  return thing;
};

const getIdFieldName = (thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation): string => {
  if (thing.idFields.length > 1) {
    throw new Error(`Composite id fields are not supported for '${thing.name}'`);
  }
  return thing.idFields[0];
};

const getNodeId = (node: BQLMutation, idFieldName: string, ctx: BuildContext): string => {
  if (node.$id) {
    return Array.isArray(node.$id) ? node.$id[0] : node.$id;
  }
  if (node[idFieldName]) {
    return node[idFieldName] as string;
  }
  if (node.$tempId) {
    const resolved = ctx.tempIdMap.get(node.$tempId);
    if (resolved) {
      return resolved.id;
    }
  }
  // Check if the node was recently created — find its ID from the creates list
  if (node.$thing) {
    const latestCreate = [...ctx.mutation.creates].reverse().find((c) => c.thing === node.$thing);
    if (latestCreate) {
      return latestCreate.id;
    }
  }
  // For nodes without deterministic IDs (e.g., SubMatch traversals), return empty
  return '';
};

const guardIdFieldOnUpdate = (idFieldName: string, thingName: string, node: BQLMutation): void => {
  if (node[idFieldName] !== undefined) {
    // Allow if the id field matches $id (common pattern: { ...obj, $id: obj.id })
    const nodeId = Array.isArray(node.$id) ? node.$id[0] : node.$id;
    if (nodeId !== undefined && node[idFieldName] === nodeId) {
      // Silently remove the redundant id field from the mutation
      delete node[idFieldName];
      return;
    }
    throw new Error(
      `Cannot mutate id field '${idFieldName}' on '${thingName}'. Use '$id' to identify the record instead.`,
    );
  }
};

const hasNonDollarFields = (obj: Record<string, unknown>): boolean => Object.keys(obj).some((k) => !k.startsWith('$'));

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const isNestedBlock = (value: unknown): boolean => isObject(value) && Object.keys(value).some((k) => k.startsWith('$'));

const parsePrefixedRef = (value: string): Ref | undefined => {
  if (/\s/.test(value)) {
    return undefined;
  }
  const match = /^([^:]+):([^:]+)$/.exec(value);
  if (!match) {
    return undefined;
  }
  const [, thing, id] = match;
  if (!thing || !id) {
    return undefined;
  }
  // Check for _:tempId format
  if (thing === '_') {
    return undefined;
  }
  return { thing, id };
};

/** Validate that no two link fields in the same mutation target the same relation with different targets */
const validateLinkFieldTargets = (
  node: BQLMutation,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
): void => {
  const relationTargets = new Map<string, 'role' | 'relation'>();
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || value === null || value === undefined) {
      continue;
    }
    const field = thing.fields[key];
    if (field?.type === 'link') {
      const existing = relationTargets.get(field.relation);
      if (existing && existing !== field.target) {
        throw new Error(
          "[Wrong format]: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.",
        );
      }
      relationTargets.set(field.relation, field.target);
    }
  }
};
