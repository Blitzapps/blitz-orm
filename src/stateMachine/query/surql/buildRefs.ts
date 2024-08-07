import type {
	EnrichedAttributeQuery,
	EnrichedBQLQuery,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
} from '../../../types';
import { FieldSchema, QueryPath } from '../../../types/symbols';
import { sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { buildSuqlFilter, parseFilter, buildSorter } from '../../../adapters/surrealDB/filters/filters';

export const buildRefs = (props: { queries: EnrichedBQLQuery[]; schema: EnrichedBormSchema }) => {
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

	const currentSchema = schema.entities[$thing] || schema.relations[$thing];
	if (!currentSchema) {
		throw new Error(`Schema for ${$thing} not found`);
	}

	const queryPath = query[QueryPath];

	const META = createMetaFields(queryPath);
	const DATA_FIELDS = createDataFields($fields.filter((f) => f.$fieldType === 'data'));
	const EDGE_FIELDS = createEdgeFields(
		$fields.filter((f) => f.$fieldType === 'link' || f.$fieldType === 'role') as (
			| EnrichedLinkQuery
			| EnrichedRoleQuery
		)[],
		schema,
	);
	const FIELDS = [...META, ...DATA_FIELDS, ...EDGE_FIELDS].join(',\n');
	const FROM = createRootFromClause(query, currentSchema);
	const WHERE = $filter ? `WHERE ${buildSuqlFilter(parseFilter($filter, $thing, schema))}` : 'WHERE id';

	const SORT = $sort ? buildSorter($sort) : '';
	const LIMIT = typeof $limit === 'number' ? `LIMIT ${$limit}` : '';
	const OFFSET = typeof $offset === 'number' ? `START ${$offset}` : '';

	return `SELECT ${FIELDS} ${FROM} ${WHERE} ${SORT} ${LIMIT} ${OFFSET}`;
};

const createRootFromClause = (query: EnrichedBQLQuery, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const allTypes = currentSchema.subTypes ? [query.$thing, ...currentSchema.subTypes] : [query.$thing];
	const allTypesNormed = allTypes.map((t) => sanitizeNameSurrealDB(t));

	const formatId = (type: string, id: string) => `${type}:\`${id}\``;
	const joinTypes = (ids: string[]) => allTypesNormed.flatMap((type) => ids.map((id) => formatId(type, id))).join(',');

	if (!query.$id) {
		return `FROM ${allTypesNormed.join(',')}`;
	}

	if (typeof query.$id === 'string') {
		return `FROM ${joinTypes([query.$id])}`;
	}

	if (Array.isArray(query.$id)) {
		return `FROM ${joinTypes(query.$id)}`;
	}

	throw new Error('Invalid $id');
};

const createMetaFields = (queryPath: string) => {
	return [`"${queryPath}" as \`$$queryPath\``, 'meta::id(id) as `$id`', 'meta::tb(id) as `$thing`'];
};

const createDataFields = (dataFields: EnrichedAttributeQuery[] | EnrichedFieldQuery[]) => {
	return dataFields.map((df) => {
		if (df.$path === 'id') {
			return `meta::id(${df.$path}) AS ${df.$as}`;
		}
		if (df.$path === df.$as) {
			return `\`${df.$path}\``;
		}
		return `\`${df.$path}\` AS \`${df.$as}\``;
	});
};

const createEdgeFields = (
	edgeFields: (EnrichedLinkQuery | EnrichedRoleQuery)[],
	schema: EnrichedBormSchema,
): string[] => {
	return edgeFields
		.map((ef) => {
			//logger('ef', ef);
			const META = createMetaFields(ef[QueryPath]);
			const DATA_FIELDS = createDataFields(ef.$fields.filter((f) => f.$fieldType === 'data'));
			const LINK_FIELDS = createEdgeFields(
				ef.$fields.filter((f) => f.$fieldType === 'link' || f.$fieldType === 'role') as (
					| EnrichedLinkQuery
					| EnrichedRoleQuery
				)[],
				schema,
			);
			const FIELDS = [...META, ...DATA_FIELDS, ...LINK_FIELDS].join(',\n');
			const FROM = `FROM $parent.\`${ef[FieldSchema].path}\`[*]`;
			const WHERE = ef.$filter ? `WHERE ${buildSuqlFilter(parseFilter(ef.$filter, ef.$thing, schema))}` : 'WHERE id';
			const SORT = ef.$sort ? buildSorter(ef.$sort) : '';
			const LIMIT = typeof ef.$limit === 'number' ? `LIMIT ${ef.$limit}` : '';
			const OFFSET = typeof ef.$offset === 'number' ? `START ${ef.$offset}` : '';
			return `( SELECT ${FIELDS} ${FROM} ${WHERE}  ${SORT} ${LIMIT} ${OFFSET}  ) AS \`${ef.$as}\``;
		})
		.filter((f) => f);
};
