import type {
	EnrichedAttributeQuery,
	EnrichedBQLQuery,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedFieldQuery,
	EnrichedLinkField,
	EnrichedLinkQuery,
	EnrichedRoleField,
	EnrichedRoleQuery,
	Filter,
} from '../../../types';
import { getFieldType } from '../../../helpers';
import { FieldSchema, QueryPath, SuqlMetadata } from '../../../types/symbols';
import { isArray, isObject, shake } from 'radash';
import { prepareTableNameSurrealDB } from '../../../adapters/surrealDB/helpers';

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
	const allTypesNormed = allTypes.map((t) => prepareTableNameSurrealDB(t));

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

const parseFilter = (filter: Filter, currentThing: string, schema: EnrichedBormSchema): Filter => {
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
				if (fieldSchemaTyped.$things.length !== 1) {
					throw new Error(
						`Not supported yet: Role ${key} in ${value.name} is played by multiple things: ${fieldSchemaTyped.$things.join(', ')}`,
					);
				}
				const [childrenThing] = fieldSchemaTyped.$things; //todo: multiple players, then it must be efined
				const surrealDBKey = fieldSchemaTyped[SuqlMetadata].queryPath;

				return { ...acc, [surrealDBKey]: parseFilter(value, childrenThing, schema) };
			}
			throw new Error(`Field ${key} not found in schema, Defined in $filter`);
		}, {});
		return shake(result);
	});
	return wasArray ? resultArray : resultArray[0];
};

const buildSuqlFilter = (filter: object) => {
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
			} else if (key.startsWith('$parent')) {
				//mode: computed refs
				const nestedFilter = buildSuqlFilter(value);
				const keyWithoutPrefix = key.replace('$parent.', '');
				parts.push(`${keyWithoutPrefix}[WHERE ${nestedFilter}]`);
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
