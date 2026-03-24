import { computedFieldNameSurrealDB, sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { genAlphaId } from '../../../helpers';
import type { BormConfig } from '../../../types';
import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import { buildFilter, buildFrom, indent } from '../../query/surql2/buildSurql';
import type {
  CreateMut,
  DeleteMut,
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

  // Determine which matches require existence assertions.
  // Only matches referenced by updates (not just deletes) need to assert.
  // For sub-matches, propagate to the parent only if the sub-match itself
  // is used by a non-delete operation.
  const matchUsedByNonDelete = new Set<string>();
  for (const update of mutation.updates) {
    matchUsedByNonDelete.add(update.match);
  }
  for (const subMatch of mutation.subMatches) {
    if (matchUsedByNonDelete.has(subMatch.name)) {
      matchUsedByNonDelete.add(subMatch.parent);
    }
  }

  // Collect IDs being created in this mutation so we can detect matches that
  // reference not-yet-created records (matches run before creates).
  const createdIds = new Set<string>();
  for (const create of mutation.creates) {
    createdIds.add(`${create.thing}:${create.id}`);
  }

  // 1. Matches
  for (const match of mutation.matches) {
    const assertExistence = !ignoreNonexisting && matchUsedByNonDelete.has(match.name);
    buildMatch(match, lines, stmtMap, params, assertExistence, createdIds);
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
  assertExistence: boolean,
  createdIds: Set<string>,
): void => {
  const source = match.source;
  const filterStr = match.filter ? buildFilter(match.filter, params) : undefined;

  // When all matched IDs are being created in the same mutation, the SELECT
  // would run before the CREATE and find nothing.  Use a reference array so
  // the UPDATE that runs after CREATE can still resolve the record.
  const allCreatedInSameMutation =
    source.type === 'record_pointer' &&
    source.ids.every((id) => source.thing.some((t) => createdIds.has(`${t}:${id}`)));

  if (allCreatedInSameMutation && source.type === 'record_pointer') {
    // Records are created later in the same mutation. Use a reference array
    // instead of SELECT so the subsequent UPDATE resolves them after CREATE.
    const refs = source.thing.flatMap((t) =>
      source.ids.map((id) => {
        const tableKey = insertParam(params, t);
        const idKey = insertParam(params, id);
        return `type::record($${tableKey}, $${idKey})`;
      }),
    );
    lines.push(`LET $${match.name} = [${refs.join(', ')}];`);
    stmtMap.push({ type: 'match', name: match.name });
  } else if (source.type === 'record_pointer' && assertExistence) {
    // Assert records exist, then optionally filter.
    const ptrName = filterStr ? `${match.name}_ptr` : match.name;
    const subLines: string[] = [];
    subLines.push('SELECT VALUE id');
    subLines.push(buildFrom(source, 1, params));
    lines.push(`LET $${ptrName} = ${subLines.join('\n')};`);
    stmtMap.push({ type: 'match', name: ptrName });

    lines.push(`IF array::len($${ptrName}) != ${source.ids.length} { THROW "Record not found" };`);
    stmtMap.push({ type: 'assertion', name: ptrName });

    if (filterStr) {
      const filterLines: string[] = [];
      filterLines.push('SELECT VALUE id');
      filterLines.push(indent(`FROM $${ptrName}`, 1));
      filterLines.push(indent(`WHERE ${filterStr}`, 1));
      lines.push(`LET $${match.name} = ${filterLines.join('\n')};`);
      stmtMap.push({ type: 'filter_submatch', name: match.name });
    }
  } else {
    // Single SELECT with optional filter.
    const subLines: string[] = [];
    subLines.push('SELECT VALUE id');
    subLines.push(buildFrom(source, 1, params));
    if (filterStr) {
      subLines.push(indent(`WHERE ${filterStr}`, 1));
    }
    lines.push(`LET $${match.name} = ${subLines.join('\n')};`);
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
      const filterStr = buildFilter(f, params);
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
