import { computedFieldNameSurrealDB, sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { genAlphaId } from '../../../helpers';
import type { BormConfig } from '../../../types';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import type {
  CreateMut,
  DeleteMut,
  Filter,
  LinkAllOp,
  LogicalMutation,
  Match,
  Ref,
  SubMatch,
  UpdateMut,
  ValueMut,
} from './logical';

export type SurqlParams = Record<string, unknown>;

export type StmtMapEntry = {
  type: 'match' | 'submatch' | 'create' | 'update' | 'delete' | 'assertion' | 'filter_submatch';
  name: string;
  op?: 'create' | 'update' | 'delete';
  thing?: string;
  tempId?: string;
  /** True for auto-generated intermediary relation creates */
  isIntermediary?: boolean;
  /** Index of the RETURN statement in the raw results array */
  resultIndex?: number;
};

export type StmtMap = StmtMapEntry[];

/**
 * Build SurQL string from the optimized LogicalMutation.
 * Returns the SurQL string, statement map, and params.
 */
export const buildMutationSurql = (
  mutation: LogicalMutation,
  params: SurqlParams,
  config: BormConfig,
  schema?: DRAFT_EnrichedBormSchema,
): { surql: string; stmtMap: StmtMap } => {
  const lines: string[] = [];
  const stmtMap: StmtMap = [];
  const ignoreNonexisting = config.mutation?.ignoreNonexistingThings ?? false;

  // 1. Matches
  for (const match of mutation.matches) {
    buildMatch(match, lines, stmtMap, params, ignoreNonexisting);
  }

  // 2. SubMatches (after their parent matches)
  for (const subMatch of mutation.subMatches) {
    buildSubMatch(subMatch, lines, stmtMap, params);
  }

  // 3. Creates (in dependency order)
  for (const create of mutation.creates) {
    buildCreateStmt(create, lines, stmtMap, params, mutation, schema);
  }

  // 4. Updates
  for (const update of mutation.updates) {
    buildUpdateStmt(update, lines, stmtMap, params, mutation, schema);
  }

  // 5. Deletes (reverse order)
  for (let i = mutation.deletes.length - 1; i >= 0; i--) {
    buildDeleteStmt(mutation.deletes[i], lines, stmtMap, params, mutation, schema);
  }

  // 6. Link-all operations (parameterized)
  if (mutation.linkAlls) {
    for (const linkAll of mutation.linkAlls) {
      buildLinkAllStmt(linkAll, lines, params);
    }
  }

  // Add RETURN statements for each mutation result variable.
  // Each RETURN produces a result at its statement index in tx.query() output.
  for (const entry of stmtMap) {
    if (entry.type === 'create') {
      entry.resultIndex = lines.length;
      lines.push(`RETURN $${entry.name};`);
    } else if (entry.type === 'update') {
      entry.resultIndex = lines.length;
      lines.push(`RETURN $${entry.name}_result;`);
    } else if (entry.type === 'delete') {
      entry.resultIndex = lines.length;
      lines.push(`RETURN $${entry.name}_result;`);
    }
  }

  return { surql: lines.join('\n'), stmtMap };
};

// --- Match → SurQL ---

const buildMatch = (
  match: Match,
  lines: string[],
  stmtMap: StmtMap,
  params: SurqlParams,
  ignoreNonexisting: boolean,
): void => {
  const source = match.source;
  const hasFilter = match.filter && !Array.isArray(match.filter);

  if (source.type === 'record_pointer') {
    if (!ignoreNonexisting && !hasFilter) {
      // Emit pointer array, then assert
      const recordRefs = buildRecordPointers(source.thing, source.ids, params);
      lines.push(`LET $${match.name} = [${recordRefs.join(', ')}];`);
      stmtMap.push({ type: 'match', name: match.name });

      lines.push(
        `IF array::len($${match.name}) != ${source.ids.length * source.thing.length} { THROW "Record not found" };`,
      );
      stmtMap.push({ type: 'assertion', name: match.name });
    } else if (!ignoreNonexisting && hasFilter) {
      // Two-step: pointer assertion, then filter
      const ptrName = `${match.name}_ptr`;
      const recordRefs = buildRecordPointers(source.thing, source.ids, params);
      lines.push(`LET $${ptrName} = SELECT VALUE id FROM [${recordRefs.join(', ')}];`);
      stmtMap.push({ type: 'match', name: ptrName });

      lines.push(
        `IF array::len($${ptrName}) != ${source.ids.length * source.thing.length} { THROW "Record not found" };`,
      );
      stmtMap.push({ type: 'assertion', name: ptrName });

      const filterStr = buildFilterStr(match.filter as Filter, params);
      lines.push(`LET $${match.name} = SELECT VALUE id FROM $${ptrName}${filterStr ? ` WHERE ${filterStr}` : ''};`);
      stmtMap.push({ type: 'filter_submatch', name: match.name });
    } else {
      // ignoreNonexisting: combine pointer + filter
      if (hasFilter) {
        const recordRefs = buildRecordPointers(source.thing, source.ids, params);
        const filterStr = buildFilterStr(match.filter as Filter, params);
        lines.push(
          `LET $${match.name} = SELECT VALUE id FROM [${recordRefs.join(', ')}]${filterStr ? ` WHERE ${filterStr}` : ''};`,
        );
      } else {
        const recordRefs = buildRecordPointers(source.thing, source.ids, params);
        lines.push(`LET $${match.name} = [${recordRefs.join(', ')}];`);
      }
      stmtMap.push({ type: 'match', name: match.name });
    }
  } else if (source.type === 'table_scan') {
    const tables = source.thing.map((t) => sanitizeNameSurrealDB(t)).join(', ');
    const filterStr = hasFilter ? buildFilterStr(match.filter as Filter, params) : undefined;
    lines.push(`LET $${match.name} = SELECT VALUE id FROM ${tables}${filterStr ? ` WHERE ${filterStr}` : ''};`);
    stmtMap.push({ type: 'match', name: match.name });
  } else if (source.type === 'subquery') {
    // SubQuery source
    const innerSource = buildSourceExpr(source.source, params);
    const path = source.oppositePath;
    const filterStr = hasFilter ? buildFilterStr(match.filter as Filter, params) : undefined;
    lines.push(
      `LET $${match.name} = SELECT VALUE id FROM ${innerSource}.${sanitizeNameSurrealDB(path)}${filterStr ? ` WHERE ${filterStr}` : ''};`,
    );
    stmtMap.push({ type: 'match', name: match.name });
  }
};

// --- SubMatch → SurQL ---

const buildSubMatch = (subMatch: SubMatch, lines: string[], stmtMap: StmtMap, params: SurqlParams): void => {
  const path = subMatch.isComputed ? computedFieldNameSurrealDB(subMatch.path) : sanitizeNameSurrealDB(subMatch.path);

  // Build WHERE conditions
  const conditions: string[] = [];
  if (subMatch.ids && subMatch.ids.length > 0) {
    if (subMatch.ids.length === 1) {
      const idKey = insertParam(params, subMatch.ids[0]);
      conditions.push(`record::id(id) = $${idKey}`);
    } else {
      const idKeys = subMatch.ids.map((id) => `$${insertParam(params, id)}`);
      conditions.push(`record::id(id) IN [${idKeys.join(', ')}]`);
    }
  }
  if (subMatch.filter) {
    const filters = Array.isArray(subMatch.filter) ? subMatch.filter : [subMatch.filter];
    for (const f of filters) {
      const filterStr = buildFilterStr(f, params);
      if (filterStr) {
        conditions.push(filterStr);
      }
    }
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const arrayTraversal = subMatch.cardinality === 'MANY' ? '[*]' : '';
  // Use array::flatten to handle nested arrays from parent array traversal
  lines.push(
    `LET $${subMatch.name} = SELECT VALUE id FROM array::flatten($${subMatch.parent}.${path}${arrayTraversal})${whereClause};`,
  );
  stmtMap.push({ type: 'submatch', name: subMatch.name });
};

/**
 * Emit pre-UPDATE statements for cardinality ONE inverse constraint enforcement.
 * When a role field value is linked to a new record, and the opposite link field
 * has cardinality ONE, the value must be unlinked from any other record first.
 */
const emitCardinalityOnePreUpdates = (
  thingName: string,
  values: Record<string, ValueMut>,
  tableName: string,
  lines: string[],
  params: SurqlParams,
  mutation: LogicalMutation,
  schema: DRAFT_EnrichedBormSchema,
  isIntermediary?: boolean,
): void => {
  const thingSchema = schema[thingName];
  if (!thingSchema || thingSchema.type !== 'relation') {
    return;
  }
  for (const [fieldName, valueMut] of Object.entries(values)) {
    if (valueMut.type !== 'role_field') {
      continue;
    }
    const roleField = thingSchema.fields[fieldName];
    if (roleField?.type !== 'role') {
      continue;
    }
    // Check if the opposite link field has cardinality ONE
    const oppositeSchema = schema[roleField.opposite.thing];
    const oppositeLinkField = oppositeSchema?.fields[roleField.opposite.path];
    if (oppositeLinkField?.type !== 'link' || oppositeLinkField.cardinality !== 'ONE') {
      continue;
    }
    // For intermediary creates: always enforce.
    // For direct creates: enforce for ONE cardinality roles, PATCH (explicit link), or REPLACE.
    const isPatchOrReplace = valueMut.cardinality === 'MANY' && ('links' in valueMut || 'refs' in valueMut);
    if (!isIntermediary && roleField.cardinality !== 'ONE' && !isPatchOrReplace) {
      continue;
    }
    // Get the ref values being linked
    const refs: Ref[] =
      valueMut.cardinality === 'ONE'
        ? [valueMut.ref]
        : 'refs' in valueMut
          ? valueMut.refs
          : 'links' in valueMut
            ? valueMut.links
            : [];
    // Only enforce for refs that are NOT being created in this mutation
    // (newly created records can't have existing links to unlink)
    const existingRefs = refs.filter((ref) => !mutation.creates.some((c) => c.thing === ref.thing && c.id === ref.id));
    if (existingRefs.length === 0) {
      continue;
    }
    const escapedField = sanitizeNameSurrealDB(fieldName);
    for (const ref of existingRefs) {
      const refExpr = buildRefExpr(ref, params, mutation);
      if (roleField.cardinality === 'ONE') {
        lines.push(`UPDATE ${tableName} SET ${escapedField} = NONE WHERE ${escapedField} = ${refExpr};`);
      } else {
        lines.push(
          `UPDATE ${tableName} SET ${escapedField} -= [${refExpr}] WHERE ${escapedField} CONTAINSANY [${refExpr}];`,
        );
      }
    }
  }
};

// --- Create → SurQL ---

const buildCreateStmt = (
  create: CreateMut,
  lines: string[],
  stmtMap: StmtMap,
  params: SurqlParams,
  mutation: LogicalMutation,
  schema?: DRAFT_EnrichedBormSchema,
): void => {
  const tableName = sanitizeNameSurrealDB(create.thing);

  // Cardinality ONE enforcement
  if (schema) {
    emitCardinalityOnePreUpdates(
      create.thing,
      create.values,
      tableName,
      lines,
      params,
      mutation,
      schema,
      create.isIntermediary,
    );
  }

  const setClauses: string[] = [];

  for (const [fieldName, valueMut] of Object.entries(create.values)) {
    const clauses = buildUpdateValueExpr(fieldName, valueMut, params, mutation);
    setClauses.push(...clauses);
  }

  const tableKey = insertParam(params, create.thing);
  const idKey = insertParam(params, create.id);
  const setStr = setClauses.length > 0 ? ` SET ${setClauses.join(', ')}` : '';
  lines.push(`LET $${create.name} = CREATE ONLY type::record($${tableKey}, $${idKey})${setStr} RETURN AFTER;`);
  stmtMap.push({
    type: 'create',
    name: create.name,
    op: 'create',
    thing: create.thing,
    tempId: create.tempId,
    isIntermediary: create.isIntermediary,
  });
};

// --- Update → SurQL ---

const buildUpdateStmt = (
  update: UpdateMut,
  lines: string[],
  stmtMap: StmtMap,
  params: SurqlParams,
  mutation: LogicalMutation,
  _schema?: DRAFT_EnrichedBormSchema,
): void => {
  const setClauses: string[] = [];

  for (const [fieldName, valueMut] of Object.entries(update.values)) {
    const clauses = buildUpdateValueExpr(fieldName, valueMut, params, mutation);
    setClauses.push(...clauses);
  }

  if (setClauses.length === 0) {
    return;
  }

  const resultName = `${update.name}_result`;
  // Check if match refers to a CREATE (single record) or MATCH/SUBMATCH (array of IDs)
  const isCreateRef = mutation.creates.some((c) => c.name === update.match);
  if (isCreateRef) {
    // CREATE ONLY returns a single record — update it directly via its id
    lines.push(`LET $${resultName} = UPDATE $${update.match}.id SET ${setClauses.join(', ')} RETURN AFTER;`);
  } else {
    // MATCH/SUBMATCH returns an array of IDs — UPDATE accepts an array directly
    lines.push(`LET $${resultName} = UPDATE $${update.match} SET ${setClauses.join(', ')} RETURN AFTER;`);
  }
  // Determine the thing name from the match
  const matchedThing = findThingForMatch(update.match, mutation);
  stmtMap.push({
    type: 'update',
    name: update.name,
    op: 'update',
    thing: matchedThing,
  });
};

// --- Delete → SurQL ---

const findThingForMatch = (matchName: string, mutation: LogicalMutation): string | undefined => {
  const create = mutation.creates.find((c) => c.name === matchName);
  if (create) {
    return create.thing;
  }
  const match = mutation.matches.find((m) => m.name === matchName);
  if (match && match.source.type !== 'subquery') {
    return match.source.thing[0];
  }
  return undefined;
};

const buildDeleteStmt = (
  del: DeleteMut,
  lines: string[],
  stmtMap: StmtMap,
  _params: SurqlParams,
  mutation: LogicalMutation,
  schema?: DRAFT_EnrichedBormSchema,
): void => {
  const resultName = `${del.name}_result`;
  lines.push(`LET $${resultName} = DELETE $${del.match} RETURN BEFORE;`);
  const matchedThing = findThingForMatch(del.match, mutation);

  // After deleting an entity, clean up orphaned relation records.
  // SurrealDB REFERENCE ON DELETE UNSET sets the field to NONE, but the record persists.
  // We need to delete relation records where all role fields are NONE.
  if (schema && matchedThing) {
    const thingSchema = schema[matchedThing];
    if (thingSchema?.type === 'entity') {
      // Find link fields that go through relations
      for (const field of Object.values(thingSchema.fields)) {
        if (field.type === 'link' && field.target === 'role') {
          const relTable = sanitizeNameSurrealDB(field.relation);
          const roleName = sanitizeNameSurrealDB(field.plays);
          // Delete relation records where this role is NONE (orphaned)
          lines.push(`DELETE FROM ${relTable} WHERE ${roleName} IS NONE;`);
        }
      }
    }
  }

  stmtMap.push({
    type: 'delete',
    name: del.name,
    op: 'delete',
    thing: matchedThing,
  });
};

// --- Value expression building ---

const buildUpdateValueExpr = (
  fieldName: string,
  valueMut: ValueMut,
  params: SurqlParams,
  mutation: LogicalMutation,
): string[] => {
  const escapedName = sanitizeNameSurrealDB(fieldName);

  switch (valueMut.type) {
    case 'null':
      return [`${escapedName} = NONE`];
    case 'empty':
      return [`${escapedName} = []`];
    case 'data_field':
      if (valueMut.cardinality === 'MANY') {
        const items = (valueMut.value as unknown[]).map((v) => `$${insertParam(params, v)}`);
        return [`${escapedName} = [${items.join(', ')}]`];
      }
      return [`${escapedName} = $${insertParam(params, valueMut.value)}`];
    case 'ref_field': {
      if (valueMut.cardinality === 'ONE') {
        return [`${escapedName} = ${buildRecordRef(valueMut.value, params)}`];
      }
      const refs = valueMut.value.map((r) => buildRecordRef(r, params));
      return [`${escapedName} = [${refs.join(', ')}]`];
    }
    case 'flex_field':
      return [
        `${escapedName} = $${insertParam(params, valueMut.cardinality === 'ONE' ? valueMut.value : valueMut.value)}`,
      ];
    case 'role_field':
      return buildRoleFieldUpdateExprs(fieldName, valueMut, params, mutation);
    default:
      return [];
  }
};

const buildRoleFieldUpdateExprs = (
  fieldName: string,
  valueMut: ValueMut & { type: 'role_field' },
  params: SurqlParams,
  mutation: LogicalMutation,
): string[] => {
  const escapedName = sanitizeNameSurrealDB(fieldName);
  const result: string[] = [];

  if (valueMut.cardinality === 'ONE') {
    const ref = buildRefExpr(valueMut.ref, params, mutation);
    result.push(`${escapedName} = ${ref}`);
    return result;
  }

  if ('refs' in valueMut) {
    // Replace
    if (valueMut.refs.length === 0) {
      result.push(`${escapedName} = []`);
    } else {
      const refs = valueMut.refs.map((r) => buildRefExpr(r, params, mutation));
      result.push(`${escapedName} = [${refs.join(', ')}]`);
    }
    return result;
  }

  if ('links' in valueMut) {
    // Patch
    if (valueMut.links.length > 0) {
      const linkRefs = valueMut.links.map((r) => buildRefExpr(r, params, mutation));
      result.push(`${escapedName} += [${linkRefs.join(', ')}]`);
    }
    if (valueMut.unlinks.length > 0) {
      const unlinkRefs = valueMut.unlinks.map((r) => buildRefExpr(r, params, mutation));
      result.push(`${escapedName} -= [${unlinkRefs.join(', ')}]`);
    }
    return result;
  }

  return result;
};

const buildRefExpr = (ref: Ref, params: SurqlParams, mutation: LogicalMutation): string => {
  // Check if this ref corresponds to a create in the mutation (use LET variable)
  const allThingsForMatch = ref.subTypes ? [ref.thing, ...ref.subTypes] : [ref.thing];
  const create = mutation.creates.find((c) => allThingsForMatch.includes(c.thing) && c.id === ref.id);
  if (create) {
    return `$${create.name}.id`;
  }

  // If the thing has subtypes, generate a multi-table lookup
  if (ref.subTypes && ref.subTypes.length > 0) {
    const allThings = [ref.thing, ...ref.subTypes];
    const idKey = insertParam(params, ref.id);
    const refs = allThings.map((t) => {
      const tKey = insertParam(params, t);
      return `type::record($${tKey}, $${idKey})`;
    });
    // Use array::first to pick the first existing record
    return `array::first(SELECT VALUE id FROM [${refs.join(', ')}])`;
  }

  const tableKey = insertParam(params, ref.thing);
  const idKey = insertParam(params, ref.id);
  return `type::record($${tableKey}, $${idKey})`;
};

// --- Record reference helpers ---

const buildRecordPointers = (things: string[], ids: string[], params: SurqlParams): string[] => {
  const refs: string[] = [];
  for (const thing of things) {
    for (const id of ids) {
      const tableKey = insertParam(params, thing);
      const idKey = insertParam(params, id);
      refs.push(`type::record($${tableKey}, $${idKey})`);
    }
  }
  return refs;
};

const buildRecordRef = (ref: string, params: SurqlParams): string => {
  const parsed = ref.split(':');
  if (parsed.length !== 2) {
    throw new Error(`Invalid record reference: ${ref}`);
  }
  const [thing, id] = parsed;
  const tableKey = insertParam(params, thing);
  const idKey = insertParam(params, id);
  return `type::record($${tableKey}, $${idKey})`;
};

const buildSourceExpr = (source: Match['source'], params: SurqlParams): string => {
  if (source.type === 'record_pointer') {
    const refs = buildRecordPointers(source.thing, source.ids, params);
    return refs.join(', ');
  }
  if (source.type === 'table_scan') {
    return source.thing.map((t) => sanitizeNameSurrealDB(t)).join(', ');
  }
  throw new Error('Unsupported source type for expression');
};

// --- Filter building ---

const buildFilterStr = (filter: Filter, params: SurqlParams): string | undefined => {
  switch (filter.type) {
    case 'scalar': {
      const path = filter.left === 'id' ? 'record::id(id)' : sanitizeNameSurrealDB(filter.left);
      const key = insertParam(params, filter.right);
      return `${path} ${filter.op} $${key}`;
    }
    case 'list': {
      const items = filter.right.map((i) => `$${insertParam(params, i)}`).join(', ');
      const path = sanitizeNameSurrealDB(filter.left);
      return `${path} ${filter.op} [${items}]`;
    }
    case 'and': {
      const conditions = filter.filters
        .map((f) => buildFilterStr(f, params))
        .filter((c): c is string => !!c)
        .map((c) => `(${c})`);
      return conditions.length > 0 ? conditions.join(' AND ') : undefined;
    }
    case 'or': {
      const conditions = filter.filters
        .map((f) => buildFilterStr(f, params))
        .filter((c): c is string => !!c)
        .map((c) => `(${c})`);
      return conditions.length > 0 ? conditions.join(' OR ') : undefined;
    }
    case 'not': {
      const sub = buildFilterStr(filter.filter, params);
      return sub ? `NOT(${sub})` : undefined;
    }
    case 'null':
      if (filter.emptyIsArray) {
        return filter.op === 'IS'
          ? `array::len(${sanitizeNameSurrealDB(filter.left)}) = 0`
          : `array::len(${sanitizeNameSurrealDB(filter.left)}) > 0`;
      }
      return `${sanitizeNameSurrealDB(filter.left)} ${filter.op} NONE`;
    case 'ref':
    case 'biref':
    case 'computed_biref': {
      const escapedLeft =
        filter.type === 'computed_biref' ? computedFieldNameSurrealDB(filter.left) : sanitizeNameSurrealDB(filter.left);
      const path = filter.left === 'id' ? 'record::id(id)' : escapedLeft;
      if (filter.thing) {
        const right = filter.thing.flatMap((t) =>
          filter.right.map((i) => {
            const tableKey = insertParam(params, t);
            const idKey = insertParam(params, i);
            return `type::record($${tableKey}, $${idKey})`;
          }),
        );
        if (right.length === 1) {
          if (filter.op === 'IN') {
            return `${path} = ${right[0]}`;
          }
          if (filter.op === 'NOT IN') {
            return `${path} != ${right[0]}`;
          }
          if (filter.op === 'CONTAINSANY') {
            return `${right[0]} IN ${path}`;
          }
          if (filter.op === 'CONTAINSNONE') {
            return `${right[0]} NOT IN ${path}`;
          }
        }
        return `${path} ${filter.op} [${right.join(', ')}]`;
      }
      if (filter.right.length === 1) {
        if (filter.op === 'IN') {
          return `${path} && record::id(${path}) = $${insertParam(params, filter.right[0])}`;
        }
        if (filter.op === 'NOT IN') {
          return `${path} && record::id(${path}) != $${insertParam(params, filter.right[0])}`;
        }
      }
      return `(${path} ?: []).map(|$i| record::id($i)) ${filter.op} [${filter.right.map((i) => `$${insertParam(params, i)}`).join(', ')}]`;
    }
    case 'falsy':
      return 'false';
    default:
      return undefined;
  }
};

// --- Link-all → SurQL ---

const buildLinkAllStmt = (linkAll: LinkAllOp, lines: string[], params: SurqlParams): void => {
  const tables = linkAll.oppositeThings.map((t) => sanitizeNameSurrealDB(t)).join(', ');
  const relationTable = sanitizeNameSurrealDB(linkAll.relation);
  const parentThingKey = insertParam(params, linkAll.parentThing);
  const parentIdKey = insertParam(params, linkAll.parentId);
  const parentRefExpr = `type::record($${parentThingKey}, $${parentIdKey})`;
  const playsExpr = linkAll.playsCardinality === 'ONE' ? parentRefExpr : `[${parentRefExpr}]`;
  const targetExpr = linkAll.targetCardinality === 'ONE' ? '$item' : '[$item]';
  const playsField = sanitizeNameSurrealDB(linkAll.playsField);
  const targetRoleField = sanitizeNameSurrealDB(linkAll.targetRoleField);
  lines.push(
    `FOR $item IN (SELECT VALUE id FROM ${tables}) { CREATE ${relationTable} SET ${playsField} = ${playsExpr}, ${targetRoleField} = ${targetExpr}; };`,
  );
};

// --- Param helpers ---

const insertParam = (params: SurqlParams, value: unknown): string => {
  let key = genAlphaId();
  while (params[key] !== undefined) {
    key = genAlphaId();
  }
  params[key] = value;
  return key;
};
