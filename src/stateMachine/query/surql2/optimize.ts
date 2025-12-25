import type { DRAFT_EnrichedBormEntity, DRAFT_EnrichedBormField, DRAFT_EnrichedBormRelation, DRAFT_EnrichedBormSchema, Index } from "../../../types/schema/enriched.draft";
import type { DataSource, Filter, LogicalQuery, NestedFilter, Projection, ProjectionField, RecordPointer, RefFilter, SubQuery, TableScan } from "./logical";

export const optimizeLogicalQuery = (query: LogicalQuery, schema: DRAFT_EnrichedBormSchema): LogicalQuery => {
  const thing = getSourceThing(query.source, schema);
  const filter = query.filter ? optimizeLocalFilter(query.filter, schema, thing) : undefined;
  const { source, filter: optimizedFilter } = optimizeSource({ source: query.source, filter, schema, thing });

  return {
    source,
    projection: query.projection,
    filter: optimizedFilter,
    cardinality: query.cardinality,
  }
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
  if ((field.type !== 'role' && field.type !== 'link') || filter.op !== 'IN') {
    return undefined;
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

/**
 * If the source is a table scan and the filter is a nested filter, convert the filter to a relationship traversal.
 */
const optimizeSource = (params: { source: DataSource, filter?: Filter, schema: DRAFT_EnrichedBormSchema, thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation }): { source: DataSource, filter?: Filter } => {
  const { source, filter, schema, thing } = params;

  // TODO: If we use SurrealDB(v3) REFERENCE, convert computed reference filter into relationship traversal.

  // Convert a ref filter to a relationship traversal.
  if (source.type === 'table_scan' && filter?.type === 'ref') {
    const traversal = convertRefFilterToRelationshipTraversal(filter, schema, thing);
    if (traversal) {
      return { source: traversal };
    }
  }

  // Convert source into relationship traversal if the filter is a nested filter
  if (source.type === 'table_scan' && filter?.type === 'nested') {
    const traversal = convertNestedFilterToRelationshipTraversal(filter, schema, thing);
    if (traversal) {
      return { source: traversal };
    }
  }

  // Convert source into relationship traversal if the first filter is a nested filter
  if (source.type === 'table_scan' && filter?.type === 'and') {
    const [firstFilter, ...restFilters] = filter.filters ?? [];
    if (firstFilter?.type === 'nested') {
      const traversal = convertNestedFilterToRelationshipTraversal(firstFilter, schema, thing);
      if (traversal) {
        return {
          source: traversal,
          filter: restFilters.length === 0
            ? undefined
            : restFilters.length === 1
            ? restFilters[0]
            : { type: 'and', filters: restFilters },
        }
      }
    }
  }

  return {
    source,
    filter: filter ? pushDownIndexedFilter(filter, thing) : undefined,
  }
}

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
}

const optimizeProjection = (projection: Projection, schema: DRAFT_EnrichedBormSchema, thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation): Projection => {
  return {
    fields: projection.fields.map((field) => optimizeProjectionField(field, schema, thing)),
  };
}

const optimizeProjectionField = (field: ProjectionField, schema: DRAFT_EnrichedBormSchema, thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation): ProjectionField => {
  if (field.type === 'metadata' || field.type === 'data' || field.type === 'flex' || field.type === 'reference') {
    return field;
  }
  return {
    type: 'nested_reference',
    path: field.path,
    projection: optimizeProjection(field.projection, schema, thing),
    filter: field.filter ? optimizeLocalFilter(field.filter, schema, thing) : undefined,
    cardinality: field.cardinality,
  }
}

/**
 * Flatten "and" and "or" filters into a single filter. Order the filters by cost.
 * This optimization doesn't consider indexes.
 */
const optimizeLocalFilter = (filter: Filter, schema: DRAFT_EnrichedBormSchema, thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation): Filter | undefined => {
  if (filter.type === 'list' && filter.right.length === 1) {
    // TODO: Convert into simpler form if possible. Example: `<left> IN [<right>]` into `<left> = <right>`
  }

  if (filter.type === 'ref' && filter.right.length === 0) {
    // TODO: Convert into simpler form if possible. Example: `<left> IN []` into `<left> IS NULL`
  }


  if (filter.type === 'and' || filter.type === 'or') {
    const filters = filter.filters.flatMap((f) => {
      const optimized = optimizeLocalFilter(f, schema, thing);
      if (optimized === undefined) {
        return [];
      }
      // Flatten nested "and" and nested "or" filters.
      if (optimized.type === filter.type) {
        return optimized.filters;
      }
      return [optimized];
    });
    if (filters.length === 0) {
      return undefined;
    }
    if (filters.length === 1) {
      return filters[0];
    }
    // TODO: Combine multiple "=" of the same field inside "or" filter into "in" filter.
    // TODO: Improve the scoring.
    const scored = filters.map((i): { filter: Filter; score: number} => {
      if (i.type === 'scalar') {
        return { filter: i, score: filterOpScoreMap[i.op] ?? 0 };
      }
      if (i.type === 'list') {
        return { filter: i, score: 0.5 ** (i.right.length - 1) };
      }
      if (i.type === 'ref') {
        if (i.thing) {
          return { filter: i, score: 0.5 ** ((i.right.length - 1) * i.thing.length) };
        }
        // Without thing the filter is a bit slower because we need to call record::id(<left>)
        return { filter: i, score: 0.5 ** (i.right.length - 1) * 0.9 };
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
    const inner = optimizeLocalFilter(filter.filter, schema, thing);
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
    const optimizedSubFilter = optimizeLocalFilter(filter.filter, schema, thing);
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
}

const filterOpScoreMap: Record<string, number> = {
  '=': 1,
  '>': 0.5,
  '<': 0.5,
  '>=': 0.5,
  '<=': 0.5,
};

/**
 * Put indexed filters first. Only one set of indexed filter is pushed down.
 * This function assumes all link/role fields are indexed.
 */
const pushDownIndexedFilter = (filter: Filter, thing: DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation): Filter => {
  if (filter.type === 'and') {
    const filterMap = Object.fromEntries(filter.filters.map((f, i): [string, { index: number, filter: Filter, score: number }] | undefined => {
      if (f.type !== 'scalar') {
        return undefined;
      }
      const score = filterOpScoreMap[f.op];
      if (!score) {
        return undefined;
      }
      return [f.left, { filter: f, index: i, score }];
    }).filter((i) => i !== undefined));
    // Longest composite indexes first.
    const compositeIndexes = thing.indexes.filter((index) => index.type !== 'single').sort((a, b) => b.fields.length - a.fields.length);
    if (compositeIndexes.length > 0) {
      const compositeFilters: { filters: { index: number, filter: Filter }[], score: number }[] = [];
      for (const index of compositeIndexes) {
        const fs: { index: number, filter: Filter, score: number }[] = [];
        for (const field of index.fields) {
          const filter = filterMap[field];
          if (!filter || fs.some((f) => f.index === filter.index)) { // Avoid duplicate filters.
            break;
          }
          fs.push(filter);
        }
        if (fs.length > 0) {
          compositeFilters.push({ filters: fs, score: fs.reduce((a, b) => a + (a * b.score), 1) });
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
        }
      }
    }
  }

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
    })
    const sorted = scored.sort((a, b) => b.score - a.score);
    const [first] = sorted;
    const indexed = first && first.score !== 0 ? first.filter : undefined;
    // Convert indexed filter with IN operator to an OR filter with scalar filters.
    const optimized: Filter | undefined = indexed?.type === 'list' && indexed.op === 'IN' ? {
      type: 'or',
      filters: indexed.right.map((r) => ({ type: 'scalar', op: '=', left: indexed.left, right: r })),
    } : indexed;
    return {
      type: filter.type,
      filters: optimized ? [optimized, ...filter.filters.filter((_, i) => i !== first.index)] : filter.filters,
    };
  }
  return filter;
};

const isIndexed = (field: DRAFT_EnrichedBormField, indexes: Index[]): boolean => {
  // SurrealDB reference fields are assumed to be indexed.
  return field.type === 'role' || field.type === 'link' || indexes.some((i) => (i.type === 'single' && i.field === field.name) || (i.type === 'composite' && i.fields.includes(field.name)));
};

const getThingSchema = (thing: string, schema: DRAFT_EnrichedBormSchema): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation => {
  const thingSchema = schema[thing];
  if (!thingSchema) {
    throw new Error(`Thing ${thing} not found in schema`);
  }
  return thingSchema;
}

const getSourceThing = (source: DataSource, schema: DRAFT_EnrichedBormSchema): DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation => {
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
}
