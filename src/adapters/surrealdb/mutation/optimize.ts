import type { DRAFT_EnrichedBormSchema } from '../../../types/schema/enriched.draft';
import { optimizeLocalFilter, optimizeSource } from '../query/optimize';
import type { LogicalMutation, Match, SubMatch } from './logical';

/**
 * Optimize the logical mutation: filter optimization, source optimization, subMatch optimization.
 */
export const optimizeLogicalMutation = (
  mutation: LogicalMutation,
  schema: DRAFT_EnrichedBormSchema,
): LogicalMutation => {
  return {
    matches: mutation.matches.map((m) => optimizeMatch(m, schema)),
    subMatches: mutation.subMatches.map((sm) => optimizeSubMatch(sm)),
    creates: mutation.creates,
    updates: mutation.updates,
    deletes: mutation.deletes,
    linkAlls: mutation.linkAlls,
  };
};

const optimizeMatch = (match: Match, schema: DRAFT_EnrichedBormSchema): Match => {
  const filter = match.filter ? optimizeLocalFilter(match.filter) : undefined;

  const source = match.source;
  const thingName = source.type === 'table_scan' || source.type === 'record_pointer' ? source.thing[0] : match.name;
  const thingSchema = schema[thingName];

  if (thingSchema) {
    const result = optimizeSource({ source, filter, schema, thing: thingSchema });
    return { ...match, source: result.source, filter: result.filter };
  }

  return { ...match, source, filter };
};

const optimizeSubMatch = (subMatch: SubMatch): SubMatch => {
  const filter = subMatch.filter ? optimizeLocalFilter(subMatch.filter) : undefined;
  return { ...subMatch, filter };
};
