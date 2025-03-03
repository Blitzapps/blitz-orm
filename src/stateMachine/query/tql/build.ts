import { v4 as uuidv4 } from 'uuid';
import { getIdFieldKey, getSchemaByThing, indent } from '../../../helpers';
import type {
  EnrichedAttributeQuery,
  EnrichedBQLQuery,
  EnrichedBormSchema,
  EnrichedLinkQuery,
  EnrichedRoleQuery,
} from '../../../types';
import { FieldSchema, QueryPath } from '../../../types/symbols';
import { buildFilter } from './filters';

const separator = '___';

export const buildTQLQuery = async (props: { queries: EnrichedBQLQuery[]; schema: EnrichedBormSchema }) => {
  const { queries: batches, schema } = props;
  return batches.map((query) => buildQuery({ query, schema }));
};

const buildQuery = (props: { query: EnrichedBQLQuery; schema: EnrichedBormSchema }) => {
  const { query, schema } = props;
  const { $path, $thing, $filter, $fields, $sort, $offset, $limit, $id } = query;

  if (!$path) {
    throw new Error('Path is not defined');
  }

  const lines: string[] = [];
  const queryPath = query[QueryPath];
  lines.push('match');
  lines.push(`$${$path} isa ${$thing};`);

  if ($filter || $id) {
    const idField = getIdFieldKey(schema, query);
    const $WithIdFilter = { ...$filter, ...($id ? { [idField]: $id } : {}) };
    const filter = buildFilter({ $filter: $WithIdFilter, $var: $path, $thing, schema, depth: 0 });
    lines.push(`\n${filter}`);
  }

  const sorter = buildSorter({ schema, $thing, $var: $path, $sort, depth: 0 });

  if (sorter) {
    lines.push(sorter.match);
  }

  const randomId = `M_${uuidv4()}`;

  lines.push(`?queryPath${randomId} = "${queryPath}";`);
  lines.push('fetch');
  lines.push(`?queryPath${randomId} as "queryPath";`);

  if ($fields) {
    const dataFields = $fields.filter((f) => f.$fieldType === 'data') as EnrichedAttributeQuery[];
    if (dataFields && dataFields.length > 0) {
      lines.push(...processDataFields(dataFields, $path, 0));
    }

    const linkFields = $fields.filter((f) => f.$fieldType === 'link') as EnrichedLinkQuery[];
    if (linkFields && linkFields.length > 0) {
      lines.push(...processLinkFields(linkFields, $path, $path, 0, schema));
    }

    const roleFields = $fields.filter((f) => f.$fieldType === 'role') as EnrichedRoleQuery[];
    if (roleFields && roleFields.length > 0) {
      lines.push(...processRoleFields(roleFields, $path, $path, 0, schema));
    }
  }

  if (sorter) {
    lines.push(sorter.sort);
  }

  if (typeof $offset === 'number') {
    lines.push(`\noffset ${$offset};`);
  }

  if (typeof $limit === 'number') {
    lines.push(`\nlimit ${$limit};`);
  }

  return lines.join('\n');
};

const processDataFields = (dataFields: EnrichedAttributeQuery[], $path: string, depth: number) => {
  const postStrParts: string[] = [];
  const asMetaDataParts: string[] = [];
  const multiVals: { path: string }[] = [];

  for (let i = 0; i < dataFields.length; i++) {
    if (!dataFields[i].$isVirtual) {
      postStrParts.push(dataFields[i].$dbPath);
    }
    if (dataFields[i][FieldSchema].contentType === 'FLEX') {
      multiVals.push({ path: dataFields[i][FieldSchema].dbPath });
    }
    asMetaDataParts.push(`{${dataFields[i].$dbPath}:${dataFields[i].$as}}`);
  }

  const postStr = postStrParts.join(', ');
  const $asMetaData = asMetaDataParts.join(',');
  const $metaData = `$metadata:{as:[${$asMetaData}]}`;
  const lines = [indent(`$${$path} as "${$path}.${$metaData}.$dataFields": ${postStr};`, depth)];

  if (multiVals.length > 0) {
    multiVals.forEach((multiVal) => {
      lines.push(
        indent(
          `"${multiVal.path}.$multiVal": {match $${$path} has ${multiVal.path} $${multiVal.path}; fetch $${multiVal.path}: attribute;};`,
          depth,
        ),
      );
    });
  }
  return lines;
};

const processRoleFields = (
  roleFields: EnrichedRoleQuery[],
  $path: string,
  dotPath: string,
  depth: number,
  schema: EnrichedBormSchema,
) => {
  const nextDepth = depth + 1;
  const lines: string[] = [];

  for (const roleField of roleFields) {
    const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $thing, $sort, $offset, $limit } = roleField;
    const queryPath = roleField[QueryPath];

    const $metaData = `$metadata:{as:${$as},justId:${
      $justId ? 'T' : 'F'
    },idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
    lines.push(indent(`"${dotPath}.${$metaData}.${roleField.$var}": {`, depth));
    lines.push(indent('match', nextDepth));
    const $roleVar = `${$path}${separator}${roleField.$var}`;
    lines.push(indent(`$${$roleVar} isa ${roleField.$thing};`, nextDepth));
    lines.push(
      indent(
        // TODO: The parent node already declare $path
        `$${$path} (${roleField.$var}: $${$path}${separator}${roleField.$var}) isa ${roleField.$intermediary};`,
        nextDepth,
      ),
    );

    if (roleField.$filter || roleField.$id) {
      const idField = getIdFieldKey(schema, roleField);
      const withId = roleField.$id ? { [idField]: roleField.$id } : {};
      const withIdFilter = { ...roleField.$filter, ...withId };

      lines.push(
        buildFilter({
          $filter: withIdFilter,
          $var: $roleVar,
          $thing: roleField.$thing,
          schema,
          depth: nextDepth,
        }),
      );
    }

    const sorter = buildSorter({ schema, $thing, $var: $roleVar, $sort, depth: nextDepth });

    if (sorter) {
      lines.push(sorter.match);
    }

    if ($fields) {
      const randomId = `M_${uuidv4()}`;
      lines.push(indent(`\n?queryPath${randomId} = "${queryPath}";`, nextDepth)); ///rawPaths => to inject metadata in the response, in this case only the path
      lines.push(indent('fetch', nextDepth));
      lines.push(indent(`?queryPath${randomId} as "queryPath";`, nextDepth)); ///rawPaths => to recover metadata in the response

      const dataFields = $fields?.filter((f) => f.$fieldType === 'data') as EnrichedAttributeQuery[];
      if (dataFields && dataFields.length > 0) {
        lines.push(...processDataFields(dataFields, $roleVar, nextDepth));
      }

      const linkFields = $fields?.filter((f) => f.$fieldType === 'link') as EnrichedLinkQuery[];
      if (linkFields && linkFields.length > 0) {
        lines.push(...processLinkFields(linkFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth, schema));
      }
      const roleFields = $fields?.filter((f) => f.$fieldType === 'role') as EnrichedRoleQuery[];
      if (roleFields && roleFields.length > 0) {
        lines.push(...processRoleFields(roleFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth, schema));
      }
    }

    if (sorter) {
      lines.push(sorter.sort);
    }

    if (typeof $offset === 'number') {
      lines.push(indent(`offset ${$offset};`, nextDepth));
    }

    if (typeof $limit === 'number') {
      lines.push(indent(`limit ${$limit};`, nextDepth));
    }

    lines.push(indent('};', depth));
  }

  return lines;
};

const processLinkFields = (
  linkFields: EnrichedLinkQuery[],
  $path: string,
  dotPath: string,
  depth: number,
  schema: EnrichedBormSchema,
) => {
  const nextDepth = depth + 1;
  const lines: string[] = [];

  for (const linkField of linkFields) {
    const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $playedBy, $thing, $sort, $offset, $limit } =
      linkField;
    const queryPath = linkField[QueryPath];
    const $metaData = `$metadata:{as:${$as},justId:${
      $justId ? 'T' : 'F'
    },idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
    lines.push(indent(`"${dotPath}.${$metaData}.${linkField.$var}": {`, depth));
    lines.push(indent('match', nextDepth));
    const $linkVar = `${$path}${separator}${linkField.$var}`;
    lines.push(indent(`$${$linkVar} isa ${linkField.$thing};`, nextDepth));

    if (linkField.$filter || linkField.$id) {
      const idField = getIdFieldKey(schema, linkField);
      const withId = linkField.$id ? { [idField]: linkField.$id } : {};
      const withIdFilter = { ...linkField.$filter, ...withId };
      lines.push(
        buildFilter({
          $filter: withIdFilter,
          $var: $linkVar,
          $thing: linkField.$thing,
          schema,
          depth: nextDepth,
        }),
      );
    }

    const sorter = buildSorter({ schema, $thing, $var: $linkVar, $sort, depth: nextDepth });

    if (sorter) {
      lines.push(sorter.match);
    }

    if (linkField.$target === 'role') {
      // a. intermediary
      lines.push(
        indent(
          `$${$path}_intermediary (${linkField.$plays}: $${$path}, ${$playedBy.plays}: $${$linkVar}) isa ${linkField.$intermediary};`,
          nextDepth,
        ),
      );
    } else {
      // b. no intermediary
      lines.push(
        indent(
          // TODO: There can't be multiple "isa" for the same variable
          // TODO: There can't be multiple relation constraints for the same variable. The filter may contain multiple relation constraints.
          `$${$linkVar} (${linkField.$plays}: $${$path});`,
          nextDepth,
        ),
      );
    }

    if ($fields) {
      const randomId = `M_${uuidv4()}`;
      lines.push(indent(`?queryPath${randomId} = "${queryPath}";`, nextDepth)); ///queryPath => to inject metadata in the response, in this case only the path
      lines.push(indent('fetch', nextDepth));
      lines.push(indent(`?queryPath${randomId} as "queryPath";`, nextDepth)); ///queryPath => to recover metadata in the response

      const dataFields = $fields?.filter((f) => f.$fieldType === 'data') as EnrichedAttributeQuery[];
      if (dataFields && dataFields.length > 0) {
        lines.push(...processDataFields(dataFields, $linkVar, nextDepth));
      }

      const linkFields = $fields?.filter((f) => f.$fieldType === 'link') as EnrichedLinkQuery[];
      if (linkFields && linkFields.length > 0) {
        lines.push(...processLinkFields(linkFields, $linkVar, `${$path}.${linkField.$var}`, nextDepth, schema));
      }

      const roleFields = $fields?.filter((f) => f.$fieldType === 'role') as EnrichedRoleQuery[];
      if (roleFields && roleFields.length > 0) {
        lines.push(...processRoleFields(roleFields, $linkVar, `${$path}.${linkField.$var}`, nextDepth, schema));
      }
    }

    if (sorter) {
      lines.push(sorter.sort);
    }

    if (typeof $offset === 'number') {
      lines.push(indent(`offset ${$offset};`, nextDepth));
    }

    if (typeof $limit === 'number') {
      lines.push(indent(`limit ${$limit};`, nextDepth));
    }

    lines.push(indent('};', depth));
  }

  return lines;
};

const normalizeSorter = (sort: { field: string; desc?: boolean } | string) => {
  if (typeof sort === 'string') {
    return {
      field: sort,
      desc: false,
    };
  }
  return { ...sort, desc: sort.desc ?? false };
};

const buildSorter = (props: {
  $var: string;
  $thing: string;
  schema: EnrichedBormSchema;
  $sort?: ({ field: string; desc?: boolean } | string)[];
  depth: number;
}) => {
  const { $var, $thing, schema, $sort, depth } = props;

  const thing = getSchemaByThing(schema, $thing);
  const sortMatch: string[] = [];
  const sorter: string[] = [];

  $sort?.forEach((sort) => {
    const s = normalizeSorter(sort);
    const df = thing.dataFields?.find((df) => df.path === s.field);
    if (!df) {
      throw new Error(`"${$thing}" does not have data field "${s.field}"`);
    }
    const attrVar = `${s.field}_${uuidv4()}`;
    sortMatch.push(indent('{', depth));
    sortMatch.push(indent(`$${$var} has ${df.dbPath} $${attrVar}_1;`, depth + 1));
    sortMatch.push(indent('not {', depth + 1));
    sortMatch.push(indent(`$${$var} has ${df.dbPath} $${attrVar}_2;`, depth + 2));
    sortMatch.push(indent(`$${attrVar}_2 < $${attrVar}_1;`, depth + 2));
    sortMatch.push(indent('};', depth + 1));
    sortMatch.push(indent(`?${attrVar}_ = $${attrVar}_1;`, depth + 1));
    sortMatch.push(indent('} or {', depth));
    sortMatch.push(indent(`not { $${$var} has ${df.dbPath} $${attrVar}_1; };`, depth + 1));
    // TODO: This is a workaround to put things with undefined attribute at the end.
    // "~" is the last non-control char (DEC 126) in ASCII.
    sortMatch.push(indent(`?${attrVar}_ = "~";`, depth + 1));
    sortMatch.push(indent('};', depth));
    sortMatch.push(indent(`?${attrVar} = ?${attrVar}_;`, depth));
    const order = s.desc ? 'desc' : 'asc';
    sorter.push(`?${attrVar} ${order}`);
  });

  if (sortMatch.length === 0) {
    return;
  }

  return {
    match: sortMatch.join(''),
    sort: indent(`sort ${sorter.join(', ')};`, depth),
  };
};
