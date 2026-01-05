import type {
  DataField,
  DataSource,
  Filter,
  FlexField,
  LogicalQuery,
  MetadataField,
  NestedReferenceField,
  Projection,
  ReferenceField,
  Sort,
} from './logical';

export type SurqlParams = Record<string, unknown>;

/**
 * NOTE: Mutate `params`.
 */
export const buildSurql = (query: LogicalQuery, params: SurqlParams): string => {
  const lines: string[] = [];
  const level = query.cardinality === 'MANY' ? 0 : 1;

  if (query.cardinality === 'ONE') {
    lines.push('array::first(');
  }
  lines.push(buildProjection(query.projection, level, params));
  lines.push(buildFrom(query.source, level, params));
  const filter = query.filter && buildFilter(query.filter, params);
  if (filter) {
    lines.push(indent(`WHERE ${filter}`, level));
  }
  if (query.sort && query.sort.length > 0) {
    lines.push(buildOrderBy(query.sort, level));
  }
  if (query.limit !== undefined) {
    lines.push(indent(`LIMIT ${query.limit}`, level));
  }
  if (query.offset !== undefined) {
    lines.push(indent(`START ${query.offset}`, level));
  }
  if (query.cardinality === 'ONE') {
    lines.push(')');
  }

  return lines.join('\n');
};

/**
 * NOTE: Mutate `params`.
 */
const buildProjection = (projection: Projection, level: number, params: SurqlParams): string => {
  const fieldLines: string[] = [];
  const fieldLevel = level + 1;
  for (const field of projection.fields) {
    if (field.type === 'metadata') {
      fieldLines.push(buildMetadataFieldProjection(field, fieldLevel));
    } else if (field.type === 'data') {
      fieldLines.push(buildDataFieldProjection(field, fieldLevel));
    } else if (field.type === 'reference') {
      fieldLines.push(buildReferenceFieldProjection(field, fieldLevel));
    } else if (field.type === 'nested_reference') {
      fieldLines.push(buildNestedFieldProjection(field, fieldLevel, params));
    } else if (field.type === 'flex') {
      fieldLines.push(buildFlexFieldProjection(field, fieldLevel));
    }
  }

  const lines: string[] = [];
  lines.push(indent('SELECT', level));
  lines.push(fieldLines.join(',\n'));

  return lines.join('\n');
};

const buildMetadataFieldProjection = (field: MetadataField, level: number) => {
  if (field.path === '$id') {
    return indent(`record::id(id) AS ${esc(field.alias ?? '$id')}`, level);
  } else if (field.path === '$thing') {
    return indent(`record::tb(id) AS ${esc(field.alias ?? '$thing')}`, level);
  }
  throw new Error(`Unsupported metadata field: ${field.path}`);
};

const buildDataFieldProjection = (field: DataField, level: number) => {
  if (field.path === 'id') {
    return indent(`record::id(id) AS ${esc(field.alias ?? 'id')}`, level);
  }
  const escapedPath = esc(field.path);
  if (field.alias) {
    return indent(`${escapedPath} AS ${esc(field.alias)}`, level);
  }
  return indent(escapedPath, level);
};

const buildReferenceFieldProjection = (field: ReferenceField, level: number) => {
  const { path, alias, cardinality } = field;
  const escapedPath = esc(path);
  const escapedAlias = esc(alias || path);
  if (cardinality === 'ONE') {
    return indent(`array::first(SELECT VALUE record::id(id) FROM $this.${escapedPath}[*]) AS ${escapedAlias}`, level);
  }
  return indent(`(SELECT VALUE record::id(id) FROM $this.${escapedPath}[*]) AS ${escapedAlias}`, level);
};

const buildNestedFieldProjection = (field: NestedReferenceField, level: number, params: SurqlParams) => {
  // SELECT
  //   (
  //       SELECT * FROM $this.ref_one
  //   ) as ref_one
  // FROM t_a
  const lines: string[] = [];
  if (field.cardinality === 'MANY') {
    lines.push(indent('(', level));
  } else {
    lines.push(indent('array::first(', level));
  }
  lines.push(buildProjection(field.projection, level + 1, params));
  const filter = field.filter ? buildFilter(field.filter, params) : undefined;
  lines.push(indent(`FROM $this.${esc(field.path)}[*]`, level + 1));
  const conditions: string[] = [];
  if (field.ids && field.ids.length > 0) {
    const ids = field.ids.map((i) => `$${insertParam(params, i)}`);
    if (ids.length === 1) {
      conditions.push(`record::id(id) = ${ids[0]}`);
    } else {
      conditions.push(`record::id(id) IN [${ids.join(', ')}]`);
    }
  }
  if (filter) {
    conditions.push(filter);
  }
  if (conditions.length > 0) {
    lines.push(indent(`WHERE ${conditions.join(' AND ')}`, level + 1));
  }
  if (field.sort && field.sort.length > 0) {
    lines.push(buildOrderBy(field.sort, level + 1));
  }
  if (field.limit !== undefined) {
    lines.push(indent(`LIMIT ${field.limit}`, level + 1));
  }
  if (field.offset !== undefined) {
    lines.push(indent(`START ${field.offset}`, level + 1));
  }
  lines.push(indent(`) AS ${esc(field.alias || field.path)}`, level));
  return lines.join('\n');
};

const buildFlexFieldProjection = (field: FlexField, level: number) => {
  const { path, alias, cardinality } = field;
  const escapedPath = esc(path);
  const escapedAlias = esc(alias || path);
  if (cardinality === 'ONE') {
    return indent(
      `${escapedPath} && IF type::is::record(${escapedPath}) { record::id(${escapedPath}) } ELSE { ${escapedPath} } AS ${escapedAlias}`,
      level,
    );
  }
  return indent(
    `${escapedPath} && ${escapedPath}.map(|$i| IF type::is::record($i) { record::id($i)} ELSE { $i }) AS ${escapedAlias}`,
    level,
  );
};

const buildFrom = (source: DataSource, level: number, params: SurqlParams): string => {
  const lines: string[] = [];
  switch (source.type) {
    case 'table_scan': {
      lines.push(indent(`FROM ${source.thing.map(esc)}`, level));
      break;
    }
    case 'record_pointer': {
      const pointers = source.thing
        .flatMap((t) => source.ids.map((i) => `${esc(t)}:${esc(i)}`))
        .map((p) => `type::record($${insertParam(params, p)})`)
        .join(', ');
      lines.push(indent(`FROM ${pointers}`, level));
      break;
    }
    case 'subquery': {
      lines.push(indent(source.cardinality === 'MANY' ? 'FROM array::distinct(array::flatten(' : 'FROM (', level));
      source.oppositePath;
      lines.push(indent(`SELECT VALUE ${esc(source.oppositePath)}`, level + 1));
      lines.push(buildFrom(source.source, level + 1, params));
      const filter = source.filter ? buildFilter(source.filter, params) : undefined;
      if (filter) {
        lines.push(indent(`WHERE ${filter}`, level + 1));
      }
      lines.push(indent(source.cardinality === 'MANY' ? '))' : ')', level));
      break;
    }
  }
  return lines.join('\n');
};

/**
 * Mutate `params`.
 */
const buildFilter = (filter: Filter, params: Record<string, unknown>, prefix?: string): string | undefined => {
  const _prefix = prefix ?? '';
  switch (filter.type) {
    case 'scalar': {
      const path = filter.left === 'id' ? `record::id(${_prefix}id)` : `${_prefix}${esc(filter.left)}`;
      const key = insertParam(params, filter.right);
      return `${path} ${filter.op} $${key}`;
    }
    case 'list': {
      const items = filter.right.map((i) => `$${insertParam(params, i)}`).join(', ');
      const path = `${_prefix}${esc(filter.left)}`;
      return `${path} ${filter.op} [${items}]`;
    }
    case 'ref': {
      const path = filter.left === 'id' ? `record::id(${_prefix}id)` : `${_prefix}${esc(filter.left)}`;
      if (filter.thing) {
        const right = filter.thing.flatMap((t) =>
          filter.right.map((i) => {
            const pointer = `${esc(t)}:${esc(i)}`;
            const key = insertParam(params, pointer);
            return `type::record($${key})`;
          }),
        );
        if (right.length === 1) {
          const key = insertParam(params, right[0]);
          if (filter.op === 'IN') {
            return `${path} = $${key}`;
          }
          if (filter.op === 'NOT IN') {
            return `${path} != $${key}`;
          }
          if (filter.op === 'CONTAINSANY') {
            return `$${key} IN ${path}`;
          }
          if (filter.op === 'CONTAINSNONE') {
            return `$${key} NOT IN ${path}`;
          }
        }
        return `${path} ${filter.op} [${right.join(', ')}]`;
      }
      if (filter.right.length === 1) {
        if (filter.op === 'IN') {
          if (filter.tunnel) {
            return `(array::first(${path}) && record::id(array::first(${path})) = $${insertParam(params, filter.right[0])})`;
          }
          return `${path} && record::id(${path}) = $${insertParam(params, filter.right[0])}`;
        }
        if (filter.op === 'NOT IN') {
          if (filter.tunnel) {
            return `(!array::first(${path}) || record::id(array::first(${path})) != $${insertParam(params, filter.right[0])})`;
          }
          return `${path} && record::id(${path}) != $${insertParam(params, filter.right[0])}`;
        }
        if (filter.op === 'CONTAINSANY') {
          if (filter.tunnel) {
            return `$${insertParam(params, filter.right[0])} IN ${path}.map(|$i| record::id($i))`;
          }
          return `$${insertParam(params, filter.right[0])} IN (${path} ?: []).map(|$i| record::id($i))`;
        }
        if (filter.op === 'CONTAINSNONE') {
          if (filter.tunnel) {
            return `$${insertParam(params, filter.right[0])} NOT IN ${path}.map(|$i| record::id($i))`;
          }
          return `$${insertParam(params, filter.right[0])} NOT IN (${path} ?: []).map(|$i| record::id($i))`;
        }
      }
      if (filter.tunnel) {
        return `${path}.map(|$i| record::id($i)) ${filter.op} [${filter.right.map((i) => `$${insertParam(params, i)}`).join(', ')}]`;
      }
      return `(${path} ?: []).map(|$i| record::id($i)) ${filter.op} [${filter.right.map((i) => `$${insertParam(params, i)}`).join(', ')}]`;
    }
    case 'null': {
      if (filter.tunnel) {
        return `array::len(${_prefix}${esc(filter.left)}) = 0`;
      }
      return `${_prefix}${esc(filter.left)} ${filter.op} NONE`;
    }
    case 'and': {
      const conditions = filter.filters
        .map((f) => {
          const condition = buildFilter(f, params, prefix);
          return condition ? `(${condition})` : undefined;
        })
        .filter((i) => !!i);
      return conditions.length > 0 ? conditions.join(' AND ') : undefined;
    }
    case 'or': {
      const conditions = filter.filters
        .map((f) => {
          const condition = buildFilter(f, params, prefix);
          return condition ? `(${condition})` : undefined;
        })
        .filter((i) => !!i);
      return conditions.length > 0 ? conditions.join(' OR ') : undefined;
    }
    case 'not': {
      return `NOT(${buildFilter(filter.filter, params, prefix)})`;
    }
    case 'nested': {
      const path = `${_prefix}${esc(filter.path)}`;
      if (filter.cardinality === 'ONE') {
        return buildFilter(filter.filter, params, `${path}.`);
      }
      const subFilter = buildFilter(filter.filter, params);
      if (!subFilter) {
        return undefined;
      }
      return `${path}[WHERE ${subFilter}]`;
    }
  }
};

const buildOrderBy = (sort: Sort[], level: number): string => {
  const sorters = sort.map((s) => `${esc(s.field)} ${s.desc ? 'DESC' : 'ASC'}`).join(', ');
  return indent(`ORDER BY ${sorters}`, level);
};

const indent = (text: string, level: number) => {
  const spaces = ' '.repeat(level * 2);
  return `${spaces}${text}`;
};

/**
 * Insert `value` into `params` and return the param key.
 */
const insertParam = (params: Record<string, unknown>, value: unknown): string => {
  let key = generateAlphaKey(5);
  while (params[key] !== undefined) {
    key = generateAlphaKey(5);
  }
  params[key] = value;
  return key;
};

const generateAlphaKey = (length: number): string => {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += letters[Math.floor(Math.random() * letters.length)];
  }
  return result;
};

/**
 * Escape identifier with  for SurrealDB
 * Only escapes when identifier contains non-alphanumeric characters or starts with a number
 */
const esc = (identifier: string): string => {
  // Check if identifier starts with a number or contains non-alphanumeric characters (excluding underscore)
  const needsEscaping = /^[0-9]/.test(identifier) || /[^a-zA-Z0-9_]/.test(identifier);
  return needsEscaping ? `⟨${identifier}⟩` : identifier;
};
