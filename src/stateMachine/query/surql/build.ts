import type {
	EnrichedAttributeQuery,
	EnrichedBQLQuery,
	EnrichedBormSchema,
	EnrichedFieldQuery,
	EnrichedLinkField,
	EnrichedLinkQuery,
	EnrichedRoleField,
	EnrichedRoleQuery,
	Filter,
} from '../../../types';
import { getFieldType, indent } from '../../../helpers';
import { FieldSchema, QueryPath, SuqlMetadata } from '../../../types/symbols';
import { isArray, isObject, shake } from 'radash';
import { prepareTableNameSurrealDB } from '../../../adapters/surrealDB/helpers';

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
	const allTypesNormed = allTypes.map((t) => prepareTableNameSurrealDB(t));

	if (query.$id) {
		if (typeof query.$id === 'string') {
			lines.push(`FROM ${allTypesNormed.map((t) => `${t}:\`${query.$id}\``).join(',')}`);
		} else if (isArray(query.$id)) {
			const $ids = query.$id;
			const allCombinations = allTypesNormed.flatMap((t) => $ids?.map((id) => `${t}:\`${id}\``));
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
	lines.push(indent('meta::id(id) as `$id`', level));
	lines.push(indent('meta::tb(id) as `$thing`', level));

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
		return indent(`meta::id(${query.$path}) AS ${query.$as}`, level);
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

//todo: Move away
export const parseFilter = (filter: Filter, currentThing: string, schema: EnrichedBormSchema): Filter => {
	if (filter === null || filter === undefined) {
		return filter;
	}
	const wasArray = isArray(filter);
	const arrayFilter = wasArray ? filter : [filter];

	const resultArray = arrayFilter.map((f) => {
		const keys = Object.keys(f);
		const result = keys.reduce((acc, key) => {
			const value = f[key];
			if (key.startsWith('$')) {
				if (key === '$not') {
					return { ...acc, $not: undefined, ['$!']: parseFilter(value, currentThing, schema) };
				}
				if (key === '$or') {
					return { ...acc, $or: undefined, $OR: parseFilter(value, currentThing, schema) };
				}
				if (key === '$and') {
					return { ...acc, $and: undefined, $AND: parseFilter(value, currentThing, schema) };
				}
				if (key === '$eq') {
					return { ...acc, '$nor': undefined, '$=': parseFilter(value, currentThing, schema) };
				}
				if (key === '$id') {
					return { ...acc, '$id': undefined, 'meta::id(id)': { $IN: isArray(value) ? value : [value] } };
				}
				if (key === '$thing') {
					return acc; //do nothing for now, but in the future we will need to filter by tables as well, maybe meta::tb(id) ...
				}
				return { ...acc, [key]: parseFilter(value, currentThing, schema) };
			}
			const currentSchema =
				currentThing in schema.entities ? schema.entities[currentThing] : schema.relations[currentThing];

			const [fieldType, fieldSchema] = getFieldType(currentSchema, key);
			if (fieldType === 'dataField') {
				if (currentSchema.idFields.length > 1) {
					throw new Error('Multiple id fields not supported');
				} //todo: When composed id, this changes:
				if (key === currentSchema.idFields[0]) {
					return { ...acc, 'meta::id(id)': { $IN: isArray(value) ? value : [value] } };
				}
				return { ...acc, [key]: value }; //Probably good place to add ONLY and other stuff depending on the fieldSchema
			}
			if (fieldType === 'linkField' || fieldType === 'roleField') {
				const fieldSchemaTyped = fieldSchema as EnrichedLinkField | EnrichedRoleField;
				const [childrenThing] = fieldSchemaTyped.$things;
				const surrealDBKey = fieldSchemaTyped[SuqlMetadata].queryPath;

				return { ...acc, [surrealDBKey]: parseFilter(value, childrenThing, schema) };
			}
			throw new Error(`Field ${key} not found in schema, Defined in $filter`);
		}, {});
		return shake(result);
	});
	return wasArray ? resultArray : resultArray[0];
};

//todo: move away
export const buildSuqlFilter = (filter: object) => {
	if (filter === null || filter === undefined) {
		return '';
	}

	const entries = Object.entries(filter);
	const parts: string[] = [];

	entries.forEach(([key, value]) => {
		//TODO: probably better to do it by key first, instead of filtering by the type of value, but it works so to refacto once needed.
		if (['$OR', '$AND', '$!'].includes(key)) {
			const logicalOperator = key.replace('$', '');
			const nestedFilters = Array.isArray(value) ? value.map((v) => buildSuqlFilter(v)) : [buildSuqlFilter(value)];
			if (logicalOperator === '!') {
				parts.push(`!(${nestedFilters.join(` ${logicalOperator} `)})`);
			} else {
				parts.push(`(${nestedFilters.join(` ${logicalOperator} `)})`);
			}
			return;
		}
		if (isObject(value)) {
			if (key.includes('<-') || key.includes('->')) {
				const nestedFilter = buildSuqlFilter(value);
				parts.push(`${key}[WHERE ${nestedFilter}]`);
			} else if (key.startsWith('$')) {
				throw new Error(`Invalid key ${key}`);
			} else {
				if (Object.keys.length === 1 && Object.keys(value)[0].startsWith('$')) {
					// This is the case where the filter has an operator manually defined
					const [operator] = Object.keys(value);
					//@ts-expect-error its ok, single key
					const nextValue = value[operator];
					if (isArray(nextValue)) {
						parts.push(`${key} ${operator.replace('$', '')} [${nextValue.map((v) => `'${v}'`).join(', ')}]`);
					} else if (isObject(nextValue)) {
						const nestedFilter = buildSuqlFilter(nextValue);
						parts.push(`${key} ${operator.replace('$', '')} ${nestedFilter}`);
					} else {
						parts.push(`${key} ${operator.replace('$', '')} '${nextValue}'`);
					}
				} else {
					throw new Error(`Invalid key ${key}`);
				}
			}
		} else {
			if (Array.isArray(value)) {
				const operator = key.startsWith('$') ? key.replace('$', '') : 'IN';
				parts.push(`${key} ${operator} [${value.map((v) => `'${v}'`).join(', ')}]`);
			} else {
				const operator = key.startsWith('$') ? key.replace('$', '') : '=';
				parts.push(`${key} ${operator} '${value}'`);
			}
		}
	});

	return parts.join(' AND ');
};

const buildSorter = (sort: ({ field: string; desc?: boolean } | string)[]) => {
	const sorters = sort.map((i) => {
		if (typeof i === 'string') {
			return i;
		}
		const { field, desc } = i;
		return `${field}${desc ? ' DESC' : ' ASC'}`;
	});
	return `ORDER BY ${sorters.join(', ')}`;
};
