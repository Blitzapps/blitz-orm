import type {
	EnrichedAttributeQuery,
	EnrichedBQLQuery,
	EnrichedBormSchema,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
} from '../../../types';
import { indent } from '../../../helpers';
import { FieldSchema, QueryPath, SuqlMetadata } from '../../../types/symbols';
import { isArray } from 'radash';
import { sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { parseFilter, buildSuqlFilter, buildSorter } from '../../../adapters/surrealDB/filters/filters';

export const build = (props: { queries: EnrichedBQLQuery[]; schema: EnrichedBormSchema }) => {
	const { queries, schema } = props;
	//console.log('queries!', queries);
	return queries.map((query) => buildQuery({ query, schema }));
};

const buildQuery = (props: { query: EnrichedBQLQuery; schema: EnrichedBormSchema }): string | null => {
	const { query, schema } = props;
	const { $thing, $fields, $filter, $offset, $limit, $sort } = query;

	if ($fields.length === 0) {
		return null;
	}

	const lines: string[] = [];

	lines.push('SELECT');

	const fieldLines = buildFieldsQuery({ parentQuery: query, queries: $fields, level: 1, schema });
	if (fieldLines) {
		lines.push(fieldLines);
	}

	const currentSchema = schema.entities[$thing] || schema.relations[$thing];
	if (!currentSchema) {
		throw new Error(`Schema for ${$thing} not found`);
	}
	const allTypes = currentSchema.subTypes ? [$thing, ...currentSchema.subTypes] : [$thing];
	const allTypesNormed = allTypes.map((t) => sanitizeNameSurrealDB(t));

	if (query.$id) {
		if (typeof query.$id === 'string') {
			lines.push(`FROM ${allTypesNormed.map((t) => `${t}:⟨${query.$id}⟩`).join(',')}`);
		} else if (isArray(query.$id)) {
			const $ids = query.$id;
			const allCombinations = allTypesNormed.flatMap((t) => $ids?.map((id) => `${t}:⟨${id}⟩`));
			lines.push(`FROM ${allCombinations.join(',')}`);
			//throw new Error('Multiple ids not supported');
		} else {
			throw new Error('Invalid $id');
		}
	} else {
		lines.push(`FROM ${allTypesNormed.join(',')}`);
	}

	if ($filter) {
		const parsed = parseFilter($filter, $thing, schema);
		const filter = buildSuqlFilter(parsed);
		lines.push(`WHERE ${filter}`);
	}

	if ($sort) {
		lines.push(buildSorter($sort));
	}

	if (typeof $limit === 'number') {
		lines.push(`LIMIT ${$limit}`);
	}

	if (typeof $offset === 'number') {
		lines.push(`START ${$offset}`);
	}

	return lines.join('\n');
};

const buildFieldsQuery = (props: {
	queries: EnrichedFieldQuery[];
	schema: EnrichedBormSchema;
	level: number;
	parentQuery: EnrichedBQLQuery | EnrichedRoleQuery | EnrichedLinkQuery;
}) => {
	const { queries, schema, level, parentQuery } = props;
	const lines: string[] = [];

	const queryPath = parentQuery[QueryPath];
	//Metadata
	lines.push(indent(`"${queryPath}" as \`$$queryPath\``, level));
	lines.push(indent('record::id(id) as `$id`', level));
	lines.push(indent('record::tb(id) as `$thing`', level));

	queries.forEach((i) => {
		const line = buildFieldQuery({ query: i, level, schema });
		if (line) {
			lines.push(line);
		}
	});
	if (lines.length === 0) {
		return null;
	}
	return lines.join(',\n');
};

const buildFieldQuery = (props: {
	query: EnrichedFieldQuery;
	schema: EnrichedBormSchema;
	level: number;
}): string | null => {
	const { query, schema, level } = props;

	if (query.$fieldType === 'data') {
		return buildAttributeQuery({ query, level });
	}
	if (query.$fieldType === 'link') {
		return buildLinkQuery({ query, level, schema });
	}
	if (query.$fieldType === 'role') {
		return buildRoleQuery({ query, level, schema });
	}
	return null;
};

const buildAttributeQuery = (props: { query: EnrichedAttributeQuery; level: number }): string | null => {
	const { query, level } = props;
	if (query.$isVirtual) {
		return null;
	}
	// TODO: Get the field id from the schema.
	if (query.$path === 'id') {
		return indent(`record::id(${query.$path}) AS ${query.$as}`, level);
	}
	if (query.$path === query.$as) {
		return indent(`\`${query.$path}\``, level);
	}
	return indent(`\`${query.$path}\` AS \`${query.$as}\``, level);
};

const buildLinkQuery = (props: {
	query: EnrichedLinkQuery;
	schema: EnrichedBormSchema;
	level: number;
}): string | null => {
	const { query, schema, level } = props;
	const { $fields, $filter, $offset, $limit, $sort } = query;

	if ($fields.length === 0) {
		return null;
	}

	const lines: string[] = [];

	lines.push(indent('(', level));

	const queryLevel = level + 1;
	lines.push(indent('SELECT', queryLevel));

	const fieldLines = buildFieldsQuery({ parentQuery: query, queries: $fields, level: queryLevel + 1, schema });
	if (fieldLines) {
		lines.push(fieldLines);
	}

	/// FROM
	const from = query[FieldSchema][SuqlMetadata].queryPath;
	lines.push(indent(`FROM ${from}`, queryLevel));

	/// FILTER WHERE
	if ($filter) {
		const parsed = parseFilter($filter, query.$thing, schema);
		const built = buildSuqlFilter(parsed);
		lines.push(`WHERE ${built}`);
	}

	/// SORT AND PAGINATION
	if ($sort) {
		lines.push(indent(buildSorter($sort), queryLevel));
	}

	if (typeof $limit === 'number') {
		lines.push(indent(`LIMIT ${$limit}`, queryLevel));
	}

	if (typeof $offset === 'number') {
		lines.push(indent(`START ${$offset}`, queryLevel));
	}

	lines.push(indent(`) AS \`${query.$as}\``, level));

	return lines.join('\n');
};

const buildRoleQuery = (props: {
	query: EnrichedRoleQuery;
	schema: EnrichedBormSchema;
	level: number;
}): string | null => {
	const { query, schema, level } = props;

	if (query.$fields.length === 0) {
		return null;
	}

	const lines: string[] = [];

	lines.push(indent('(', level));

	const queryLevel = level + 1;
	lines.push(indent('SELECT', queryLevel));

	const fieldLevel = queryLevel + 1;
	const fieldLines = buildFieldsQuery({ parentQuery: query, queries: query.$fields, level: fieldLevel, schema });
	if (fieldLines) {
		lines.push(fieldLines);
	}

	const from = query[FieldSchema][SuqlMetadata].queryPath;
	lines.push(indent(`FROM ${from}`, queryLevel));

	if (query.$filter) {
		const parsed = parseFilter(query.$filter, query.$playedBy.thing, schema);
		const built = buildSuqlFilter(parsed);
		lines.push(`WHERE ${built}`);
	}

	lines.push(indent(`) AS \`${query.$as}\``, level));

	return lines.join('\n');
};
