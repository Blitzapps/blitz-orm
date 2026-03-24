import type {
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormSchema,
  Index,
} from '../../../types/schema/enriched.draft';
import type { Filter, LogicalMutation, Match, SubMatch } from './logical';

/**
 * Optimize the logical mutation: filter optimization, source optimization, subMatch optimization.
 */
export const optimizeLogicalMutation = (
  mutation: LogicalMutation,
  schema: DRAFT_EnrichedBormSchema,
): LogicalMutation => {
  return {
    matches: mutation.matches.map((m) => optimizeMatch(m, schema)),
    subMatches: mutation.subMatches.map((sm) => optimizeSubMatch(sm, schema)),
    creates: mutation.creates,
    updates: mutation.updates,
    deletes: mutation.deletes,
    linkAlls: mutation.linkAlls,
  };
};

const optimizeMatch = (match: Match, schema: DRAFT_EnrichedBormSchema): Match => {
  let filter = match.filter
    ? Array.isArray(match.filter)
      ? match.filter.map(optimizeLocalFilter).filter((f): f is Filter => f !== undefined)
      : optimizeLocalFilter(match.filter as Filter)
    : undefined;
  filter = Array.isArray(filter) ? (filter.length > 0 ? filter : undefined) : filter;

  let source = match.source;
  const thing = getThingSchema(
    source.type === 'table_scan' || source.type === 'record_pointer' ? source.thing[0] : match.name,
    schema,
  );

  // Source optimization: ID filter → RecordPointer
  if (source.type === 'table_scan' && filter && !Array.isArray(filter)) {
    const result = extractIdFilter(filter, source.thing);
    if (result) {
      source = { type: 'record_pointer', thing: source.thing, ids: result.ids };
      filter = result.remainingFilter;
    }
  }

  // Note: Ref filter → SubQuery optimization is NOT applied for mutations.
  // The query adapter converts ref filters to relationship traversals (SubQuery sources),
  // but the mutation buildSurql only handles RecordPointer and TableScan sources for matches.
  // Applying this optimization would produce invalid SurQL.

  // Index push-down (when no source conversion applied and thing is available)
  if (source.type === 'table_scan' && filter && !Array.isArray(filter) && thing) {
    filter = pushDownIndexedFilter(filter, thing);
  }

  return { ...match, source, filter };
};

const optimizeSubMatch = (subMatch: SubMatch, schema: DRAFT_EnrichedBormSchema): SubMatch => {
  let filter = subMatch.filter
    ? Array.isArray(subMatch.filter)
      ? subMatch.filter.map(optimizeLocalFilter).filter((f): f is Filter => f !== undefined)
      : optimizeLocalFilter(subMatch.filter as Filter)
    : undefined;
  filter = Array.isArray(filter) ? (filter.length > 0 ? filter : undefined) : filter;

  // SubMatch optimization: extract id from filter into ids (schema-aware)
  if (filter && !Array.isArray(filter)) {
    const idFieldName = getIdFieldForSubMatch(subMatch, schema);
    const result = extractIdFromSubMatchFilter(filter, idFieldName);
    if (result) {
      const existingIds = subMatch.ids ?? [];
      return {
        ...subMatch,
        ids: [...existingIds, ...result.ids],
        filter: result.remainingFilter,
      };
    }
  }

  return { ...subMatch, filter };
};

/** Get the id field name for a SubMatch by looking up the thing schema. */
const getIdFieldForSubMatch = (_subMatch: SubMatch, _schema: DRAFT_EnrichedBormSchema): string => {
  // SubMatches don't directly store the thing name. Without walking the full
  // parent chain, we default to 'id' which is the standard id field name.
  // TODO: Walk the parent chain to resolve the actual thing and use idFields[0].
  return 'id';
};

// --- Filter extraction helpers ---

/** Extract id equality/IN filter from a filter tree and convert to record pointer IDs. */
const extractIdFilter = (
  filter: Filter,
  _things: string[],
): { ids: string[]; remainingFilter?: Filter } | undefined => {
  if (filter.type === 'scalar' && filter.left === 'id' && filter.op === '=' && typeof filter.right === 'string') {
    return { ids: [filter.right as string] };
  }
  if (filter.type === 'list' && filter.left === 'id' && filter.op === 'IN') {
    return { ids: filter.right as string[] };
  }
  if (filter.type === 'and') {
    for (let i = 0; i < filter.filters.length; i++) {
      const f = filter.filters[i];
      const result = extractIdFilter(f, _things);
      if (result) {
        const remaining = filter.filters.filter((_, j) => j !== i);
        return {
          ids: result.ids,
          remainingFilter:
            remaining.length === 0
              ? undefined
              : remaining.length === 1
                ? remaining[0]
                : { type: 'and', filters: remaining },
        };
      }
    }
  }
  return undefined;
};

/** Extract id field filter from SubMatch filter into ids array (schema-aware). */
const extractIdFromSubMatchFilter = (
  filter: Filter,
  idFieldName: string,
): { ids: string[]; remainingFilter?: Filter } | undefined => {
  if (
    filter.type === 'scalar' &&
    filter.left === idFieldName &&
    filter.op === '=' &&
    typeof filter.right === 'string'
  ) {
    return { ids: [filter.right as string] };
  }
  if (filter.type === 'list' && filter.left === idFieldName && filter.op === 'IN') {
    return { ids: filter.right as string[] };
  }
  if (filter.type === 'and') {
    for (let i = 0; i < filter.filters.length; i++) {
      const result = extractIdFromSubMatchFilter(filter.filters[i], idFieldName);
      if (result) {
        const remaining = filter.filters.filter((_, j) => j !== i);
        return {
          ids: result.ids,
          remainingFilter:
            remaining.length === 0
              ? undefined
              : remaining.length === 1
                ? remaining[0]
                : { type: 'and', filters: remaining },
        };
      }
    }
  }
  return undefined;
};

// --- Filter optimization ---

const filterOpScoreMap: Record<string, number> = {
  '=': 0.9,
  '>': 0.5,
  '<': 0.5,
  '>=': 0.5,
  '<=': 0.5,
  IN: 0.5,
  'NOT IN': 0.5,
  CONTAINSALL: 0.3,
  CONTAINSANY: 0.4,
  CONTAINSNONE: 0.3,
};

/**
 * Optimizes a single filter: flattens nested AND/OR, collapses empty lists,
 * De Morgan's laws, double negation elimination, scoring.
 */
const optimizeLocalFilter = (filter: Filter): Filter | undefined => {
  if (filter.type === 'list') {
    if (filter.right.length === 0) {
      if (filter.op === 'IN' || filter.op === 'CONTAINSANY') {
        return { type: 'falsy' };
      }
      return undefined;
    }
    if (filter.right.length === 1) {
      switch (filter.op) {
        case 'IN':
          return { type: 'scalar', op: '=', left: filter.left, right: filter.right[0] };
        case 'NOT IN':
          return { type: 'scalar', op: '!=', left: filter.left, right: filter.right[0] };
        case 'CONTAINSALL':
        case 'CONTAINSANY':
          return { type: 'scalar', op: 'CONTAINS', left: filter.left, right: filter.right[0] };
        case 'CONTAINSNONE':
          return { type: 'scalar', op: 'CONTAINSNOT', left: filter.left, right: filter.right[0] };
      }
    }
  }

  if (filter.type === 'ref' && filter.right.length === 0) {
    if (filter.op === 'IN' || filter.op === 'CONTAINSALL' || filter.op === 'CONTAINSANY') {
      return { type: 'falsy' };
    }
    return undefined;
  }

  if (filter.type === 'and' || filter.type === 'or') {
    let filters = filter.filters.flatMap((f) => {
      const optimized = optimizeLocalFilter(f);
      if (optimized === undefined) {
        return [];
      }
      // Flatten nested "and" and "or" filters.
      if (optimized.type === filter.type) {
        return optimized.filters;
      }
      return [optimized];
    });

    if (filter.type === 'and' && filters.some((f) => f.type === 'falsy')) {
      return { type: 'falsy' };
    }
    if (filter.type === 'or') {
      filters = filters.filter((f) => f.type !== 'falsy');
    }
    if (filters.length === 0) {
      return undefined;
    }
    if (filters.length === 1) {
      return filters[0];
    }
    // Score and sort filters for optimal evaluation order
    const scored = filters.map((i): { filter: Filter; score: number } => {
      if (i.type === 'scalar') {
        return { filter: i, score: filterOpScoreMap[i.op] ?? 0 };
      }
      if (i.type === 'list') {
        const baseScore = filterOpScoreMap[i.op] ?? 0;
        return { filter: i, score: baseScore ** i.right.length };
      }
      if (i.type === 'biref') {
        const baseScore = filterOpScoreMap[i.op] ?? 0;
        const cardinalityFactor = i.cardinality === 'ONE' ? 1 : 0.5;
        if (i.thing) {
          return { filter: i, score: baseScore ** (i.right.length * i.thing.length) * cardinalityFactor };
        }
        return { filter: i, score: baseScore ** i.right.length * 0.9 };
      }
      return { filter: i, score: 0 };
    });
    const sorted = scored.sort((a, b) => b.score - a.score);
    return {
      type: filter.type,
      filters: sorted.map((i) => i.filter),
    };
  }

  if (filter.type === 'not') {
    const inner = optimizeLocalFilter(filter.filter);
    if (inner === undefined) {
      return undefined;
    }
    // Double negation elimination
    if (inner.type === 'not') {
      return inner.filter;
    }
    // De Morgan's laws: NOT (a AND b) → (NOT a) OR (NOT b)
    if (inner.type === 'and') {
      return optimizeLocalFilter({
        type: 'or',
        filters: inner.filters.map((f) => ({ type: 'not', filter: f })),
      });
    }
    // De Morgan's laws: NOT (a OR b) → (NOT a) AND (NOT b)
    if (inner.type === 'or') {
      return optimizeLocalFilter({
        type: 'and',
        filters: inner.filters.map((f) => ({ type: 'not', filter: f })),
      });
    }
    // Scalar negation simplification
    if (inner.type === 'scalar') {
      if (inner.op === '=') {
        return { type: 'scalar', op: '!=', left: inner.left, right: inner.right };
      }
      if (inner.op === '!=') {
        return { type: 'scalar', op: '=', left: inner.left, right: inner.right };
      }
    }
    return { type: 'not', filter: inner };
  }

  if (filter.type === 'nested_ref' || filter.type === 'nested_computed_ref') {
    const optimizedSubFilter = optimizeLocalFilter(filter.filter);
    if (!optimizedSubFilter) {
      return undefined;
    }
    return {
      type: filter.type,
      filter: optimizedSubFilter,
      path: filter.path,
      cardinality: filter.cardinality,
      oppositeCardinality: filter.oppositeCardinality,
    };
  }

  return filter;
};

// --- Index push-down ---

/**
 * Put indexed filters first. Only one set of indexed filter is pushed down.
 * This function assumes all link/role fields are indexed.
 */
const pushDownIndexedFilter = (
  filter: Filter,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
): Filter => {
  // Push down indexed filters from "and" filter with composite indexes.
  if (filter.type === 'and') {
    const filterMap = Object.fromEntries(
      filter.filters
        .map((f, i): [string, { index: number; filter: Filter; score: number }] | undefined => {
          if (f.type !== 'scalar') {
            return undefined;
          }
          const score = filterOpScoreMap[f.op];
          if (!score) {
            return undefined;
          }
          return [f.left, { filter: f, index: i, score }];
        })
        .filter((i) => i !== undefined),
    );
    const compositeIndexes = thing.indexes
      .filter((index) => index.type !== 'single')
      .sort((a, b) => b.fields.length - a.fields.length);
    if (compositeIndexes.length > 0) {
      const compositeFilters: { filters: { index: number; filter: Filter }[]; score: number }[] = [];
      for (const index of compositeIndexes) {
        const fs: { index: number; filter: Filter; score: number }[] = [];
        for (const field of index.fields) {
          const f = filterMap[field];
          if (!f || fs.some((existing) => existing.index === f.index)) {
            break;
          }
          fs.push(f);
        }
        if (fs.length > 0) {
          compositeFilters.push({ filters: fs, score: fs.reduce((a, b) => a + a * b.score, 1) });
        }
      }
      compositeFilters.sort((a, b) => b.score - a.score);
      const [longestCompositeFilter] = compositeFilters;
      if (longestCompositeFilter && longestCompositeFilter.score > 1) {
        return {
          type: 'and',
          filters: [
            ...longestCompositeFilter.filters.map((f) => f.filter),
            ...filter.filters.filter((_, i) => !longestCompositeFilter.filters.some((f) => f.index === i)),
          ],
        };
      }
    }
  }

  // Push down indexed filters from "and" or "or" filter with single indexes.
  if (filter.type === 'and' || filter.type === 'or') {
    const scored = filter.filters.map((f, index) => {
      if (f.type === 'scalar' && f.op === '=') {
        const field = thing.fields[f.left];
        if (isIndexed(field, thing.indexes)) {
          return { filter: f, score: 1, index };
        }
      } else if (f.type === 'list' && f.op === 'IN') {
        const field = thing.fields[f.left];
        if (isIndexed(field, thing.indexes)) {
          const score = 0.5 ** (f.right.length - 1);
          return { filter: f, score, index };
        }
      }
      return { filter: f, score: 0, index };
    });
    const sorted = scored.sort((a, b) => b.score - a.score);
    const [first] = sorted;
    const indexed = first && first.score !== 0 ? first.filter : undefined;
    const optimized: Filter | undefined =
      indexed?.type === 'list' && indexed.op === 'IN'
        ? {
            type: 'or',
            filters: indexed.right.map((r) => ({
              type: 'scalar' as const,
              op: '=' as const,
              left: indexed.left,
              right: r,
            })),
          }
        : indexed;
    return {
      type: filter.type,
      filters: optimized ? [optimized, ...filter.filters.filter((_, i) => i !== first.index)] : filter.filters,
    };
  }

  return filter;
};

const isIndexed = (field: DRAFT_EnrichedBormField, indexes: Index[]): boolean => {
  return (
    field.type === 'role' ||
    field.type === 'link' ||
    indexes.some(
      (i) =>
        (i.type === 'single' && i.field === field.name) || (i.type === 'composite' && i.fields.includes(field.name)),
    )
  );
};

// --- Helpers ---

const getThingSchema = (
  thing: string,
  schema: DRAFT_EnrichedBormSchema,
): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation | undefined => {
  return schema[thing];
};
