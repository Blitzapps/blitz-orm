import { uid } from 'radash';
import type {
	EnrichedAttributeQuery,
	EnrichedBQLQuery,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedDataField,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleField,
	EnrichedRoleQuery,
} from '../../../types';
import { FieldSchema, QueryPath } from '../../../types/symbols';

export interface Q {
	primaryKeys: { column: string; as: string }[];
	fields: { key: string; field: DataFieldQ | RoleFieldQ }[];
	subQueries?: { key: string; query: LinkFieldQ }[];
	from: string;
	alias: string;
	where?: string;
	params?: QueryParams;
	orderBy?: { column: string; desc: boolean }[];
	limit?: number;
	offset?: number;
	unique: boolean;
	thingType: 'relation' | 'entity';
	thing: string;
	queryPath: string;
}

export type FieldQ = DataFieldQ | RoleFieldQ | LinkFieldQ;

export interface DataFieldQ {
	type: 'data';
	column: string;
	as: string;
}

export type RoleFieldQ = RoleFieldIdQ | RoleFieldRecordQ;

export interface RoleFieldIdQ {
	type: 'role';
	primaryKeys: { column: string; as: string }[];
	join: string;
	alias: string;
	params?: QueryParams;
	unique: boolean;
	thingType: 'relation' | 'entity';
	thing: string;
	queryPath: string;
}

export interface RoleFieldRecordQ extends RoleFieldIdQ {
	fields: { key: string; field: DataFieldQ | RoleFieldQ }[];
	subQueries?: { key: string; query: LinkFieldQ }[];
}

export type LinkFieldQ = LinkFieldIdQ | LinkFieldRecordQ | PassthroughLinkFieldQ;

export interface LinkFieldIdQ {
	type: 'link';
	primaryKeys: { column: string; as: string }[];
	/**
	 * Used to join the parent records
	 */
	foreignKeys: {
		column: string;
		as: string;
	}[];
	from: string;
	alias: string;
	where: string;
	params?: QueryParams;
	unique: boolean;
	thingType: 'relation' | 'entity';
	thing: string;
	queryPath: string;
}

export interface LinkFieldRecordQ extends LinkFieldIdQ {
	fields: { key: string; field: DataFieldQ | RoleFieldQ }[];
	subQueries?: { key: string; query: LinkFieldQ }[];
}

export interface PassthroughLinkFieldQ extends LinkFieldIdQ {
	tunnel: Omit<RoleFieldIdQ, 'unique'> | Omit<RoleFieldRecordQ, 'unique'>;
}

export type QueryParams = { key: string; value: any }[];

type Filter = LocalFilter & FilterSet;

interface LocalFilter {
	[field: string]: FieldFilter;
}

interface FieldFilter {
	$eq?: Value;
	$neq?: Value;
	$in?: string[] | number[] | boolean[] | Date[];
	$exists?: boolean;
	$id?: string | string[];
}

interface FilterSet {
	$not?: LocalFilter;
	$and?: LocalFilter;
	$or?: LocalFilter;
}

type Value = string | number | boolean | Date | null;

export const build = (props: { queries: EnrichedBQLQuery[]; schema: EnrichedBormSchema }) => {
	const { queries, schema } = props;
	return queries.map((query) => buildQ({ query, schema }));
};

const buildQ = (params: { query: EnrichedBQLQuery; schema: EnrichedBormSchema }): Q => {
	const { query, schema } = params;

	const relation = schema.entities[query.$thing] ?? schema.relations[query.$thing];

	if (!relation) {
		throw new Error(`Entity or relation ${query.$thing} does not exist`);
	}

	const table = relation.defaultDBConnector.path ?? relation.name;
	const tableAlias = createTableAlias(table);
	const dataFieldMap = Object.fromEntries(relation.dataFields?.map((i) => [i.path, i]) ?? []);
	const fieldMap: Record<string, RoleFieldQ | DataFieldQ> = {};
	const subQueryMap: Record<string, LinkFieldQ> = {};
	// @ts-expect-error Filter type does not match
	const condition = buildCondition({ table: tableAlias, filter: query.$filter, thing: relation, id: query.$id });

	query.$fields.forEach((i) => {
		const q = buildField({ query: i, schema, table: tableAlias });
		if (q.type === 'link') {
			subQueryMap[i.$as] = q;
		} else {
			fieldMap[i.$as] = q;
		}
	});

	const primaryKeys = relation.idFields.map((i) => {
		const df = dataFieldMap[i];
		if (!df) {
			throw new Error(`Data field ${i} does not exist in ${relation.name}`);
		}
		return { column: `"${tableAlias}"."${df.path}"`, as: `${tableAlias}.${df.path}` };
	});

	if (primaryKeys.length === 0) {
		throw new Error(`Table ${table} does not have a primary key`);
	}

	const fields = Object.entries(fieldMap).map(([key, field]) => ({ key, field }));
	const subQueries = Object.entries(subQueryMap).map(([key, query]) => ({ key, query }));
	const orderBy = query.$sort?.flatMap((i) => {
		const [field, desc] = typeof i === 'string' ? [i, false] : [i.field, i.desc ?? false];
		const column = dataFieldMap[field]?.path;
		if (!column) {
			return [];
		}
		return [{ column, desc }];
	});

	return {
		primaryKeys,
		fields,
		from: `"${table}" AS "${tableAlias}"`,
		alias: tableAlias,
		where: condition?.condition,
		subQueries: subQueries && subQueries.length !== 0 ? subQueries : undefined,
		params: condition?.params,
		orderBy,
		limit: query.$limit,
		offset: query.$offset,
		unique: query.$filterByUnique,
		thing: relation.name,
		thingType: relation.thingType,
		queryPath: query[QueryPath],
	};
};

const buildField = (params: { query: EnrichedFieldQuery; schema: EnrichedBormSchema; table: string }): FieldQ => {
	const { query, schema, table } = params;

	switch (query.$fieldType) {
		case 'data': {
			return buildDataFieldQuery({ query, table });
		}
		case 'role': {
			return buildRoleFieldQuery({ query, schema, table });
		}
		case 'link': {
			return buildLinkFieldQuery({ query, schema });
		}
	}
};

const buildDataFieldQuery = (params: { query: EnrichedAttributeQuery; table: string }): DataFieldQ => {
	const { query, table } = params;

	const dataField = query[FieldSchema];

	return {
		type: 'data',
		column: `"${table}"."${dataField.path}"`,
		as: `${table}.${dataField.path}`,
	};
};

const buildRoleFieldQuery = (params: {
	query: EnrichedRoleQuery;
	schema: EnrichedBormSchema;
	table: string;
}): RoleFieldQ => {
	const { query, schema, table } = params;
	const role = query[FieldSchema];

	return {
		..._buildRoleFieldQuery({
			role,
			$fields: query.$justId ? undefined : query.$fields,
			// @ts-expect-error Filter type does not match
			$filter: query.$filter,
			thing: query.$playedBy.thing,
			schema,
			table,
			queryPath: query[QueryPath],
		}),
		unique: query.$filterByUnique || role.cardinality === 'ONE',
	};
};

const _buildRoleFieldQuery = (params: {
	role: EnrichedRoleField;
	thing: string;
	$id?: string | string[];
	$fields?: EnrichedFieldQuery[];
	$filter?: Filter;
	schema: EnrichedBormSchema;
	table: string;
	queryPath: string;
}): Omit<RoleFieldIdQ, 'unique'> | Omit<RoleFieldRecordQ, 'unique'> => {
	const { $fields, $filter, $id, role, schema, thing, table, queryPath } = params;

	if (!role.dbConfig) {
		throw new Error('role.dbConfig is missing');
	}

	const player = schema.entities[thing] ?? schema.relations[thing];

	if (!player) {
		throw new Error(`Entity or relation ${thing} does not exist`);
	}

	const primaryKeys = player.idFields.map((i) => {
		const df = player.dataFields?.find((f) => f.path === i);
		if (!df) {
			throw new Error(`Data field ${i} does not exist in ${player.name}`);
		}
		return df.path;
	});

	const foreignKeys = role.dbConfig.fields.map((i) => i.path);

	if (foreignKeys.length !== primaryKeys.length) {
		throw new Error(`Role ${role.path}`);
	}

	const joinTable = player.defaultDBConnector.path ?? player.name;
	const joinTableAlias = createTableAlias(joinTable);
	const on = primaryKeys.map((c, i) => {
		return `"${table}"."${foreignKeys[i]}" = "${joinTableAlias}"."${c}"`;
	});

	const fieldMap: Record<string, RoleFieldQ | DataFieldQ> = {};
	const subQueryMap: Record<string, LinkFieldQ> = {};
	const condition = buildCondition({ table: joinTableAlias, filter: $filter, thing: player, id: $id });
	const joinCondition = condition ? ` AND ${condition.condition}` : '';

	if (!$fields) {
		return {
			type: 'role',
			alias: joinTableAlias,
			primaryKeys: primaryKeys.map((c) => ({ column: `"${joinTableAlias}"."${c}"`, as: `${joinTableAlias}.${c}` })),
			join: `LEFT JOIN "${joinTable}" AS "${joinTableAlias}" ON ${on.join(' AND ')}${joinCondition}`,
			params: condition?.params,
			thing: player.name,
			thingType: player.thingType,
			queryPath,
		};
	}

	$fields.forEach((i) => {
		const q = buildField({ query: i, schema, table: joinTableAlias });
		if (q.type === 'link') {
			subQueryMap[i.$as] = q;
		} else {
			fieldMap[i.$as] = q;
		}
	});

	const fields = Object.entries(fieldMap).map(([key, field]) => ({ key, field }));
	const subQueries = Object.entries(subQueryMap).map(([key, query]) => ({ key, query }));

	return {
		type: 'role',
		alias: joinTableAlias,
		fields,
		primaryKeys: primaryKeys.map((c) => ({ column: `"${joinTableAlias}"."${c}"`, as: `${joinTableAlias}.${c}` })),
		join: `LEFT JOIN "${joinTable}" AS "${joinTableAlias}" ON ${on.join(' AND ')}${joinCondition}`,
		params: condition?.params,
		subQueries: subQueries.length !== 0 ? subQueries : undefined,
		thing: player.name,
		thingType: player.thingType,
		queryPath,
	};
};

const buildLinkFieldQuery = (params: { query: EnrichedLinkQuery; schema: EnrichedBormSchema }): LinkFieldQ => {
	const { query, schema } = params;

	const linkField = query[FieldSchema];
	const relation = schema.relations[linkField.relation];

	if (!relation) {
		throw new Error(`Relation ${linkField.relation} does not exist`);
	}

	const table = relation.defaultDBConnector.path ?? relation.name;
	const tableAlias = createTableAlias(table);
	const unique = query.$filterByUnique || linkField.cardinality === 'ONE';
	const role = relation.roles[linkField.plays];

	if (!role) {
		throw new Error(`Role ${query.$playedBy.relation}.${query.$playedBy.plays} does not exist`);
	}
	if (role.dbConfig?.db !== 'postgres') {
		throw new Error();
	}
	if (role.dbConfig.fields.length === 0) {
		throw new Error();
	}

	const primaryKeys = relation.idFields.map((i) => {
		const df = relation.dataFields?.find((f) => f.path === i);
		if (!df) {
			throw new Error(`Data field ${i} does not exist in ${relation.name}`);
		}
		return { column: `"${tableAlias}"."${df.path}"`, as: `${tableAlias}.${df.path}` };
	});

	if (primaryKeys.length === 0) {
		throw new Error(`Table ${table} does not have a primary key`);
	}

	const foreignKeys = role.dbConfig.fields.map((f) => ({
		column: `"${tableAlias}"."${f.path}"`,
		as: `${tableAlias}.${f.path}`,
	}));

	const condition =
		linkField.target !== 'role'
			? // @ts-expect-error Filter type does not match
				buildCondition({ table: tableAlias, filter: query.$filter, thing: relation, id: query.$id })
			: undefined;
	const _condition = condition ? ` AND ${condition.condition}` : '';

	let where: string;

	if (foreignKeys.length === 1) {
		where = `${foreignKeys[0].column} = ANY($1)${_condition}`;
	} else {
		// TODO: Postgres does not support multiple anonymous unnest.
		where = `(${foreignKeys.map((i) => i.column).join(', ')}) IN (SELECT ${foreignKeys.map((_, i) => `UNNEST($${i + 1})`)})${_condition}`;
	}

	if (linkField.target === 'role') {
		if (linkField.oppositeLinkFieldsPlayedBy.length > 1) {
			throw new Error(
				`Link field with multiple role target players is not supported: ${linkField.relation}.${linkField.plays}`,
			);
		}
		const [oppositePlayer] = linkField.oppositeLinkFieldsPlayedBy;
		if (!oppositePlayer) {
			throw new Error(`Role ${relation.name}.${linkField.plays} does not have opposite player`);
		}
		const role = relation.roles[oppositePlayer.plays];
		if (!role) {
			throw new Error(`Role ${relation.name}.${oppositePlayer.plays} does not exist`);
		}
		return {
			type: 'link',
			primaryKeys,
			tunnel: _buildRoleFieldQuery({
				$fields: query.$justId ? undefined : query.$fields,
				$id: query.$id,
				// @ts-expect-error Filter type does not match
				$filter: query.$filter,
				role,
				thing: query.$playedBy.thing,
				schema,
				table: tableAlias,
				queryPath: query[QueryPath],
			}),
			foreignKeys,
			from: `"${table}" AS "${tableAlias}"`,
			alias: tableAlias,
			where,
			params: condition?.params,
			unique,
			thing: oppositePlayer.thing,
			thingType: oppositePlayer.thingType,
			queryPath: query[QueryPath],
		};
	}

	const fieldMap: Record<string, RoleFieldQ | DataFieldQ> = {};
	const subQueryMap: Record<string, LinkFieldQ> = {};

	query.$fields.forEach((i) => {
		const q = buildField({ query: i, schema, table: tableAlias });
		if (q.type === 'link') {
			subQueryMap[i.$as] = q;
		} else {
			fieldMap[i.$as] = q;
		}
	});

	const fields = Object.entries(fieldMap).map(([key, field]) => ({ key, field }));
	const subQueries = Object.entries(subQueryMap).map(([key, query]) => ({ key, query }));

	if (query.$justId) {
		return {
			type: 'link',
			primaryKeys,
			foreignKeys,
			from: `"${table}" AS "${tableAlias}"`,
			alias: tableAlias,
			where,
			params: condition?.params,
			unique,
			thing: relation.name,
			thingType: relation.thingType,
			queryPath: query[QueryPath],
		};
	}

	if (subQueries.length === 0) {
		return {
			type: 'link',
			primaryKeys,
			fields,
			foreignKeys,
			from: `"${table}" AS "${tableAlias}"`,
			alias: tableAlias,
			where,
			params: condition?.params,
			unique,
			thing: relation.name,
			thingType: relation.thingType,
			queryPath: query[QueryPath],
		};
	}

	return {
		type: 'link',
		fields,
		foreignKeys,
		from: `"${table}" AS "${tableAlias}"`,
		alias: tableAlias,
		where,
		primaryKeys,
		subQueries,
		params: condition?.params,
		unique,
		thing: relation.name,
		thingType: relation.thingType,
		queryPath: query[QueryPath],
	};
};

const createTableAlias = (table: string) => {
	return `${table}__${uid(6)}`;
};

const buildCondition = (params: {
	table: string;
	filter?: Filter;
	thing: EnrichedBormEntity | EnrichedBormRelation;
	id?: string | number | string[] | number[];
}) => {
	const { table, filter, thing, id } = params;
	const conditions: string[] = [];
	const queryParams: { key: string; value: any }[] = [];

	if (id) {
		if (thing.idFields.length > 1) {
			throw new Error('Filtering entity/relation with composite id fields is not supported');
		}
		const [idField] = thing.idFields
			.map((i) => thing.dataFields?.find((j) => j.path === i))
			.filter((i): i is EnrichedDataField => !!i);
		if (!idField) {
			throw new Error(`Missing id field ${thing}`);
		}
		const key = uid(6);
		if (Array.isArray(id)) {
			conditions.push(`"${table}"."${idField.path}" = ANY($${key})`);
		} else {
			conditions.push(`"${table}"."${idField.path}" = $${key}`);
		}
		queryParams.push({ key, value: id });
	}

	const { $and, $or, $not, $id: _$id, ...rest } = filter ?? {};

	if ($and) {
		const res = buildLocalCondition({ table, filter: $and, thing });
		if (res.conditions.length === 1) {
			conditions.push(res.conditions[0]);
		} else if (res.conditions.length > 1) {
			conditions.push(`(${res.conditions.join(' AND ')})`);
		}
		queryParams.push(...res.params);
	}

	if ($or) {
		const res = buildLocalCondition({ table, filter: $or, thing });
		if (res.conditions.length === 1) {
			conditions.push(res.conditions[0]);
		} else if (res.conditions.length > 1) {
			conditions.push(`(${res.conditions.join(' OR ')})`);
		}
		queryParams.push(...res.params);
	}

	if ($not) {
		const res = buildLocalCondition({ table, filter: $not, thing });
		conditions.push(`NOT (${res.conditions.join(' AND ')})`);
		queryParams.push(...res.params);
	}

	const res = buildLocalCondition({ table, filter: rest, thing });
	conditions.push(...res.conditions);
	queryParams.push(...res.params);

	if (conditions.length === 0) {
		return;
	}

	return {
		condition: conditions.length === 1 ? conditions[0] : `(${conditions.join(' AND ')})`,
		params: queryParams,
	};
};

const buildLocalCondition = (params: {
	table: string;
	filter: LocalFilter;
	thing: EnrichedBormEntity | EnrichedBormRelation;
}) => {
	const { table, filter, thing } = params;
	const conditions: string[] = [];
	const queryParams: { key: string; value: any }[] = [];

	Object.entries(filter).forEach(([k, v]) => {
		const condition = buildFieldCondition({ table, field: k, filter: v, thing });
		if (condition) {
			conditions.push(condition.condition);
			queryParams.push(...condition.params);
		}
	});

	return {
		conditions,
		params: queryParams,
	};
};

const buildFieldCondition = (params: {
	table: string;
	field: string;
	filter: FieldFilter;
	thing: EnrichedBormEntity | EnrichedBormRelation;
}) => {
	const { table, field, filter, thing } = params;
	const conditions: string[] = [];
	const queryParams: { key: string; value: any }[] = [];
	const { $eq, $neq, $in, $exists, $id } = filter;

	const dataField = thing.dataFields?.find((i) => i.path === field);
	const roleField = 'roles' in thing ? thing.roles[field] : undefined;

	if (dataField) {
		if ($eq !== undefined) {
			if ($eq === null) {
				conditions.push(`("${table}"."${field}") IS NULL`);
			} else {
				const key = uid(6);
				conditions.push(`"${table}"."${field}" = $${key}`);
				queryParams.push({ key, value: $eq });
			}
		}

		if ($neq !== undefined) {
			if ($neq === null) {
				conditions.push(`("${table}"."${field}") IS NOT NULL`);
			} else {
				const key = uid(6);
				conditions.push(`"${table}"."${field}" != $${key}`);
				queryParams.push({ key, value: $neq });
			}
		}

		if ($in) {
			const key = uid(6);
			conditions.push(`"${table}"."${field}" = ANY($${key})`);
			queryParams.push({ key, value: $in });
		}

		if ($exists !== undefined) {
			const not = $exists ? ' NOT' : '';
			conditions.push(`("${table}"."${field}") IS${not} NULL`);
		}
	} else if (roleField) {
		const [field] = roleField.dbConfig?.fields ?? [];
		if (!field) {
			throw new Error(`Role ${thing.name}.${roleField.path} does not have a foreign key`);
		}
		if (roleField.dbConfig && roleField.dbConfig.fields.length > 1) {
			throw new Error(
				`Filtering by a role field with multiple foreign keys is not supported: ${thing.name}.${roleField.path}`,
			);
		}
		if ($id !== undefined) {
			if ($id === null) {
				conditions.push(`("${table}"."${field.path}") IS NULL`);
			} else if (Array.isArray($id)) {
				const key = uid(6);
				conditions.push(`"${table}"."${field.path}" = ANY($${key})`);
				queryParams.push({ key, value: $id });
			} else {
				const key = uid(6);
				conditions.push(`"${table}"."${field.path}" = $${key}`);
				queryParams.push({ key, value: $id });
			}
		}
	} else {
		throw new Error(`Field ${field} does not exist in ${thing.name}`);
	}

	if (conditions.length === 0) {
		return;
	}

	return {
		condition: conditions.length === 1 ? conditions[0] : `(${conditions.join(' AND ')})`,
		params: queryParams,
	};
};
