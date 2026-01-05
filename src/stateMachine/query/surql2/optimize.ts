import z from 'zod/v4';
import type {
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormSchema,
  Index,
} from '../../../types/schema/enriched.draft';
import type {
  DataSource,
  Filter,
  ListFilter,
  LogicalQuery,
  NestedFilter,
  Projection,
  ProjectionField,
  RecordPointer,
  RefFilter,
  ScalarFilter,
  SubQuery,
  TableScan,
} from './logical';

export const optimizeLogicalQuery = (query: LogicalQuery, schema: DRAFT_EnrichedBormSchema): LogicalQuery => {
  const thing = getSourceThing(query.source, schema);
  const filter = query.filter ? optimizeLocalFilter(query.filter) : undefined;
  const { source, filter: optimizedFilter } = optimizeSource({ source: query.source, filter, schema, thing });

  return {
    source,
    projection: query.projection,
    filter: optimizedFilter,
    cardinality: query.cardinality,
    limit: query.limit,
    offset: query.offset,
    sort: query.sort,
  };
};

/**
 * If the source is a table scan and the filter is a nested filter, convert the filter to a relationship traversal.
 */
const optimizeSource = (params: {
  source: DataSource;
  filter?: Filter;
  schema: DRAFT_EnrichedBormSchema;
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation;
}): { source: DataSource; filter?: Filter } => {
  const { source, filter, schema, thing } = params;

  if (source.type !== 'table_scan') {
    return { source, filter };
  }

  // TODO: If we use SurrealDB(v3) REFERENCE, convert computed reference filter into relationship traversal.

  const [firstFilter, ...restFilters] = filter?.type === 'and' ? filter.filters : filter ? [filter] : [];

  const traversal =
    firstFilter?.type === 'scalar' || firstFilter?.type === 'list'
      ? convertIdFilterToRecordPointer(firstFilter, source)
      : firstFilter?.type === 'nested'
        ? convertNestedFilterToRelationshipTraversal(firstFilter, schema, thing)
        : firstFilter?.type === 'ref'
          ? convertRefFilterToRelationshipTraversal(firstFilter, schema, thing)
          : undefined;

  if (traversal) {
    return {
      source: traversal,
      filter:
        restFilters.length === 0
          ? undefined
          : restFilters.length === 1
            ? restFilters[0]
            : { type: 'and', filters: restFilters },
    };
  }

  return {
    source,
    filter: filter ? pushDownIndexedFilter(filter, thing) : undefined,
  };
};

const convertIdFilterToRecordPointer = (
  filter: ScalarFilter | ListFilter,
  source: TableScan,
): RecordPointer | undefined => {
  if (filter.left !== 'id') {
    return undefined;
  }
  if (filter.op === '=' && typeof filter.right === 'string') {
    return {
      type: 'record_pointer',
      thing: [source.thing[0], ...source.thing.slice(1)],
      ids: [filter.right],
    };
  }
  if (filter.op === 'IN' && z.array(z.string()).safeParse(filter.right).success) {
    return {
      type: 'record_pointer',
      thing: [source.thing[0], ...source.thing.slice(1)],
      ids: filter.right as string[],
    };
  }
  return undefined;
};

/**
 * Return sub query if the filter can be converted to a relationship traversal.
 */
const convertRefFilterToRelationshipTraversal = (
  filter: RefFilter,
  schema: DRAFT_EnrichedBormSchema,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
): SubQuery | undefined => {
  const field = thing.fields[filter.left];
  if (!field) {
    throw new Error(`Field ${filter.left} not found in ${thing.name}`);
  }
  if ((field.type !== 'role' && field.type !== 'link') || (filter.op !== 'IN' && filter.op !== 'CONTAINSANY')) {
    return undefined;
  }
  if (field.type === 'role') {
    // We can't do this optimization for role fields that has no player with target 'relation'.
    // This relation is only used as intermediary relation.
    const oppositeLinkField = schema[field.opposite.thing]?.fields?.[field.opposite.path];
    if (oppositeLinkField?.type !== 'link') {
      throw new Error(`Role field ${field.name} in relation ${thing.name} is not played by a link field`);
    }
    if (oppositeLinkField.target !== 'relation') {
      return undefined;
    }
  }
  const { thing: oppositeThing, path: oppositePath, cardinality } = field.opposite;
  const oppositeThingSchema = getThingSchema(oppositeThing, schema);
  const source: RecordPointer = {
    type: 'record_pointer',
    thing: [oppositeThing, ...oppositeThingSchema.subTypes],
    ids: filter.right,
  };
  const traversal: SubQuery = {
    type: 'subquery',
    source,
    oppositePath,
    cardinality,
  };
  return traversal;
};

const convertNestedFilterToRelationshipTraversal = (
  filter: NestedFilter,
  schema: DRAFT_EnrichedBormSchema,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
): SubQuery | undefined => {
  const field = thing.fields[filter.path];
  if (!field) {
    throw new Error(`Field ${filter.path} not found in ${thing.name}`);
  }
  if (field.type !== 'link' && field.type !== 'role') {
    return undefined;
  }
  if (field.type === 'role') {
    // We can't do this optimization for role fields that are not played by a link field with target 'relation'.
    // This relation is only used as intermediary relation.
    const oppositeLinkField = schema[field.opposite.thing]?.fields?.[field.opposite.path];
    if (oppositeLinkField?.type !== 'link') {
      throw new Error(`Role field ${field.name} in relation ${thing.name} is not played by a link field`);
    }
    if (oppositeLinkField.target !== 'relation') {
      return undefined;
    }
  }
  const { thing: oppositeThing, path: oppositePath, cardinality } = field.opposite;
  const oppositeThingSchema = getThingSchema(oppositeThing, schema);
  const source: TableScan = { type: 'table_scan', thing: [oppositeThing, ...oppositeThingSchema.subTypes] };
  const optimized = optimizeSource({ source, filter: filter.filter, schema, thing: oppositeThingSchema });
  const traversal: SubQuery = {
    type: 'subquery',
    source: optimized.source,
    oppositePath,
    cardinality,
    filter: optimized.filter,
  };
  return traversal;
};

const optimizeProjection = (
  projection: Projection,
  schema: DRAFT_EnrichedBormSchema,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
): Projection => {
  return {
    fields: projection.fields.map((field) => optimizeProjectionField(field, schema, thing)),
  };
};

const optimizeProjectionField = (
  field: ProjectionField,
  schema: DRAFT_EnrichedBormSchema,
  thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation,
): ProjectionField => {
  if (field.type === 'metadata' || field.type === 'data' || field.type === 'flex' || field.type === 'reference') {
    return field;
  }
  return {
    type: 'nested_reference',
    path: field.path,
    projection: optimizeProjection(field.projection, schema, thing),
    filter: field.filter ? optimizeLocalFilter(field.filter) : undefined,
    cardinality: field.cardinality,
    limit: field.limit,
    offset: field.offset,
    sort: field.sort,
  };
};

/**
 * Flatten "and" and "or" filters into a single filter. Order the filters by cost.
 * This optimization doesn't consider indexes.
 */
const optimizeLocalFilter = (filter: Filter): Filter | undefined => {
  if (filter.type === 'list') {
    if (filter.right.length === 0) {
      if (filter.op === 'IN' || filter.op === 'CONTAINSALL' || filter.op === 'CONTAINSANY') {
        return { type: 'falsy' };
      }
      return undefined;
    }
    if (filter.right.length === 1) {
      switch (filter.op) {
        case 'IN':
          return {
            type: 'scalar',
            op: '=',
            left: filter.left,
            right: filter.right[0],
          };
        case 'NOT IN':
          return {
            type: 'scalar',
            op: '!=',
            left: filter.left,
            right: filter.right[0],
          };
        case 'CONTAINSALL':
        case 'CONTAINSANY':
          return {
            type: 'scalar',
            op: 'CONTAINS',
            left: filter.left,
            right: filter.right[0],
          };
        case 'CONTAINSNONE':
          return {
            type: 'scalar',
            op: 'CONTAINSNOT',
            left: filter.left,
            right: filter.right[0],
          };
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
      // TODO: Combine multiple "=" of the same field inside "or" filter into "in" filter.
    }
    if (filters.length === 0) {
      return undefined;
    }
    if (filters.length === 1) {
      return filters[0];
    }
    // TODO: Improve the scoring.
    const scored = filters.map((i): { filter: Filter; score: number } => {
      if (i.type === 'scalar') {
        return { filter: i, score: filterOpScoreMap[i.op] ?? 0 };
      }
      if (i.type === 'list') {
        const baseScore = filterOpScoreMap[i.op] ?? 0;
        return { filter: i, score: baseScore ** i.right.length };
      }
      if (i.type === 'ref') {
        const baseScore = filterOpScoreMap[i.op] ?? 0;
        if (i.thing) {
          return { filter: i, score: baseScore ** (i.right.length * i.thing.length) };
        }
        // Without thing the filter is a bit slower because we need to call record::id(<left>)
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
    if (inner.type === 'not') {
      return inner.filter;
    }
    if (inner.type === 'scalar') {
      if (inner.op === '=') {
        return {
          type: 'scalar',
          op: '!=',
          left: inner.left,
          right: inner.right,
        };
      }
      if (inner.op === '!=') {
        return {
          type: 'scalar',
          op: '=',
          left: inner.left,
          right: inner.right,
        };
      }
    }
    return {
      type: 'not',
      filter: inner,
    };
  }

  if (filter.type === 'nested') {
    const optimizedSubFilter = optimizeLocalFilter(filter.filter);
    if (!optimizedSubFilter) {
      return undefined;
    }
    return {
      type: 'nested',
      filter: optimizedSubFilter,
      path: filter.path,
      cardinality: filter.cardinality,
    };
  }

  return filter;
};

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
    // Longest composite indexes first.
    const compositeIndexes = thing.indexes
      .filter((index) => index.type !== 'single')
      .sort((a, b) => b.fields.length - a.fields.length);
    if (compositeIndexes.length > 0) {
      const compositeFilters: { filters: { index: number; filter: Filter }[]; score: number }[] = [];
      for (const index of compositeIndexes) {
        const fs: { index: number; filter: Filter; score: number }[] = [];
        for (const field of index.fields) {
          const filter = filterMap[field];
          if (!filter || fs.some((f) => f.index === filter.index)) {
            // Avoid duplicate filters.
            break;
          }
          fs.push(filter);
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
    // Convert indexed filter with IN operator to an OR filter of "=" scalar filters.
    const optimized: Filter | undefined =
      indexed?.type === 'list' && indexed.op === 'IN'
        ? {
            type: 'or',
            filters: indexed.right.map((r) => ({ type: 'scalar', op: '=', left: indexed.left, right: r })),
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
  // SurrealDB reference fields are assumed to be indexed.
  return (
    field.type === 'role' ||
    field.type === 'link' ||
    indexes.some(
      (i) =>
        (i.type === 'single' && i.field === field.name) || (i.type === 'composite' && i.fields.includes(field.name)),
    )
  );
};

const getThingSchema = (
  thing: string,
  schema: DRAFT_EnrichedBormSchema,
): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation => {
  const thingSchema = schema[thing];
  if (!thingSchema) {
    throw new Error(`Thing ${thing} not found in schema`);
  }
  return thingSchema;
};

const getSourceThing = (
  source: DataSource,
  schema: DRAFT_EnrichedBormSchema,
): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation => {
  if (source.type === 'table_scan' || source.type === 'record_pointer') {
    const thingSchema = getThingSchema(source.thing[0], schema);
    return thingSchema;
  }

  const subThing = getSourceThing(source.source, schema);
  const field = subThing.fields[source.oppositePath];
  if (!field) {
    throw new Error(`Field ${source.oppositePath} not found in ${subThing.name}`);
  }
  if (field.type === 'constant' || field.type === 'computed' || field.type === 'data' || field.type === 'ref') {
    throw new Error(`Invalid source: ${JSON.stringify(source)}`);
  }
  const thing = schema[field.opposite.thing];
  if (!thing) {
    throw new Error(`Thing ${field.opposite.thing} not found in schema`);
  }
  return thing;
};
