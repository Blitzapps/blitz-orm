import { QueryPath } from '../../../types/symbols';
import type { DataFieldQ, LinkFieldQ, QueryParams, Q, RoleFieldQ, RoleFieldIdQ, RoleFieldRecordQ } from './build';
import type { Client } from 'pg';

export const run = async (params: { queries: Q[]; client: Client; metadata: boolean }) => {
	const { queries, client, metadata } = params;
	const res = await Promise.all(queries.map((i) => _run({ query: i, client, metadata })));
	return res;
};

const _run = async (params: { query: Q; client: Client; metadata: boolean }) => {
	const { query, client, metadata } = params;
	const { primaryKeys, subQueries, thing, thingType, queryPath } = query;
	const fields = query.fields.map((i) => i.field);

	if (metadata) {
		query.primaryKeys.forEach((i) => {
			fields.push({ type: 'data', ...i });
		});
	}

	const { selects, joins, params: queryParams } = sqlFields(fields);
	const select = `SELECT\n${selects.join(',\n')}`;
	const from = `\nFROM ${query.from}`;
	const join = joins.length !== 0 ? `\n${joins.join('\n')}` : '';
	const where = query.where ? `\nWHERE ${query.where}` : '';
	const orderBy =
		query.orderBy && query.orderBy.length !== 0
			? `\nORDER BY ${query.orderBy.map((i) => `"${query.alias}"."${i.column}" ${i.desc ? 'DESC' : 'ASC'}`).join(', ')}`
			: '';
	const limit = typeof query.limit === 'number' ? `\nLIMIT ${query.limit}` : '';
	const offset = typeof query.offset === 'number' ? `\nOFFSET ${query.offset}` : '';
	const sql = `${select}${from}${join}${where}${orderBy}${limit}${offset}`;
	const _queryParams = query.params ? [...query.params, ...queryParams] : queryParams;
	const _sql = useOrdinalPlaceholder(sql, _queryParams);
	const res = await client.query(
		_sql,
		_queryParams.map((i) => i.value),
	);

	let subQueryMap: SubQueryMap = {};
	const records: Record<string, any>[] = [];

	res.rows.forEach((r) => {
		const a = buildRecord({
			fields: query.fields,
			subQueries,
			primaryKeys,
			data: r,
			thing,
			thingType,
			metadata,
			queryPath,
		});
		records.push(a.record);
		a.subQueries.forEach((i) => {
			const s = subQueryMap[i.query.alias];
			if (s) {
				s.records.push({ record: i.record, primaryKeys: i.primaryKeys, stringifiedKeys: i.stringifiedKeys });
			} else {
				subQueryMap[i.query.alias] = {
					key: i.key,
					query: i.query,
					records: [{ record: i.record, primaryKeys: i.primaryKeys, stringifiedKeys: i.stringifiedKeys }],
				};
			}
		});
	});

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const subQueries = Object.values(subQueryMap);
		subQueryMap = {};
		if (subQueries.length === 0) {
			break;
		}
		const a = await Promise.all(subQueries.map((subQuery) => runSubQuery({ subQuery, client, metadata })));
		a.forEach((i) => {
			if (i) {
				Object.entries(i).forEach(([k, v]) => {
					subQueryMap[k] = v;
				});
			}
		});
	}

	if (query.unique) {
		return records[0] ?? null;
	}

	return records.length !== 0 ? records : null;
};

type SubQueryMap = Record<
	string, // table alias
	SubQuery
>;

interface SubQuery {
	key: string;
	query: LinkFieldQ;
	records: {
		record: Record<string, any>; // Reference the original record
		primaryKeys: (string | number)[];
		stringifiedKeys: string;
	}[];
}

interface SingleRecordSubQuery {
	key: string;
	query: LinkFieldQ;
	record: Record<string, any>; // Reference the original record
	primaryKeys: (string | number)[];
	stringifiedKeys: string;
}

const runSubQuery = async (params: { subQuery: SubQuery; client: Client; metadata: boolean }) => {
	const { subQuery, client, metadata } = params;
	const { key, query, records } = subQuery;
	const { foreignKeys, unique } = query;
	let fields: (DataFieldQ | Omit<RoleFieldQ, 'unique'>)[];

	if ('tunnel' in query) {
		fields = [query.tunnel];
	} else if ('fields' in query) {
		fields = query.fields.map((i) => i.field);
		if (metadata) {
			query.primaryKeys.forEach((i) => fields.push({ type: 'data', ...i }));
		}
	} else {
		fields = query.primaryKeys.map((i) => ({ ...i, type: 'data' }));
	}

	subQuery.query.foreignKeys.forEach((fk) => {
		fields.push({ type: 'data', ...fk });
	});

	const { selects, joins, params: queryParams } = sqlFields(fields);
	const select = `SELECT\n${selects.join(',\n')}`;
	const from = `\nFROM ${subQuery.query.from}`;
	const join = joins.length !== 0 ? `\n${joins.join('\n')}` : '';
	const where = subQuery.query.where ? `\nWHERE ${subQuery.query.where}` : '';
	const sql = `${select}${from}${join}${where}`;
	const foreignKeysParams = subQuery.query.foreignKeys.map((_, i) => subQuery.records.map((r) => r.primaryKeys[i]));
	const _queryParams = subQuery.query.params ? [...subQuery.query.params, ...queryParams] : queryParams;
	const _sql = useOrdinalPlaceholder(sql, _queryParams, foreignKeysParams.length + 1);
	const res = await client.query(_sql, [...foreignKeysParams, ..._queryParams.map((i) => i.value)]);
	const { rows } = res;

	if ('tunnel' in query) {
		if ('fields' in query.tunnel) {
			const { fields, subQueries, primaryKeys, thing, thingType, queryPath } = query.tunnel;
			return buildSubQueriedRecords({
				records,
				subQueries,
				primaryKeys,
				foreignKeys,
				fields,
				unique,
				key,
				rows,
				requirePrimaryKeys: true,
				metadata,
				thing,
				thingType,
				queryPath,
			});
		} else {
			return buildSubQueriedId({
				records,
				primaryKeys: query.tunnel.primaryKeys,
				foreignKeys,
				unique,
				key,
				rows,
			});
		}
	} else if ('fields' in query) {
		return buildSubQueriedRecords({
			records,
			subQueries: query.subQueries,
			primaryKeys: query.primaryKeys,
			foreignKeys,
			fields: query.fields,
			unique,
			key,
			rows,
			requirePrimaryKeys: false,
			metadata,
			thing: query.thing,
			thingType: query.thingType,
			queryPath: query.queryPath,
		});
	} else {
		return buildSubQueriedId({
			records,
			primaryKeys: query.primaryKeys,
			foreignKeys,
			unique,
			key,
			rows,
		});
	}
};

const buildSubQueriedRecords = (params: {
	key: string;
	records: Record<string, any>[];
	fields: { key: string; field: DataFieldQ | RoleFieldQ }[];
	subQueries?: { key: string; query: LinkFieldQ }[];
	unique: boolean;
	primaryKeys: { column: string; as: string }[];
	foreignKeys: { column: string; as: string }[];
	rows: any[];
	requirePrimaryKeys: boolean;
	metadata: boolean;
	thing: string;
	thingType: 'entity' | 'relation';
	queryPath: string;
}) => {
	const {
		fields,
		subQueries,
		primaryKeys,
		foreignKeys,
		records,
		key,
		unique,
		rows,
		requirePrimaryKeys,
		thing,
		thingType,
		metadata,
		queryPath,
	} = params;
	const subQueryMap: SubQueryMap = {};
	const subRecords: Record<string, Record<string, any>[]> = {};

	rows.forEach((r) => {
		if (requirePrimaryKeys) {
			const exists = primaryKeys.every((k) => r[k.as] !== null && r[k.as] !== undefined);
			if (!exists) {
				return;
			}
		}
		const partialRecord = buildRecord({
			fields,
			subQueries,
			primaryKeys,
			data: r,
			thing,
			thingType,
			metadata,
			queryPath,
		});
		const fk: (string | number)[] = [];
		foreignKeys.forEach((i) => {
			const v = r[i.as];
			fk.push(v);
		});
		const stringifiedKeys = stringifyKeys(fk);
		const rs = subRecords[stringifiedKeys] || [];
		rs.push(partialRecord.record);
		subRecords[stringifiedKeys] = rs;
		partialRecord.subQueries.forEach((i) => {
			const s = subQueryMap[i.key];
			if (s) {
				s.records.push({ record: i.record, primaryKeys: i.primaryKeys, stringifiedKeys: i.stringifiedKeys });
			} else {
				subQueryMap[i.key] = {
					key: i.key,
					query: i.query,
					records: [{ record: i.record, primaryKeys: i.primaryKeys, stringifiedKeys: i.stringifiedKeys }],
				};
			}
		});
	});

	if (unique) {
		records.forEach(({ record, stringifiedKeys }) => {
			const [sub] = subRecords[stringifiedKeys] || [];
			// eslint-disable-next-line no-param-reassign
			record[key] = sub ?? null;
		});
	} else {
		records.forEach(({ record, stringifiedKeys }) => {
			const sub = subRecords[stringifiedKeys];
			// eslint-disable-next-line no-param-reassign
			record[key] = sub && sub.length !== 0 ? sub : null;
		});
	}

	return subQueryMap;
};

const buildSubQueriedId = (params: {
	key: string;
	records: Record<string, any>[];
	unique: boolean;
	primaryKeys: { column: string; as: string }[];
	foreignKeys: { column: string; as: string }[];
	rows: any[];
}) => {
	const { key, records, primaryKeys, foreignKeys, rows, unique } = params;
	const ids: Record<string, any[]> = {};
	rows.forEach((r) => {
		const id = primaryKeys.map((k) => r[k.as]);
		if (id.some((i) => i === undefined || i === null)) {
			return;
		}
		const fk: (string | number)[] = [];
		foreignKeys.forEach((i) => {
			const v = r[i.as];
			fk.push(v);
		});
		const stringifiedKeys = stringifyKeys(fk);
		const rs = ids[stringifiedKeys] || [];
		if (id.length !== 0) {
			rs.push(id.length === 1 ? id[0] : id.join(':'));
			ids[stringifiedKeys] = rs;
		}
	});

	if (unique) {
		records.forEach(({ record, stringifiedKeys }) => {
			const [sub] = ids[stringifiedKeys] || [];
			// eslint-disable-next-line no-param-reassign
			record[key] = sub ?? null;
		});
	} else {
		records.forEach(({ record, stringifiedKeys }) => {
			const sub = ids[stringifiedKeys];
			// eslint-disable-next-line no-param-reassign
			record[key] = sub && sub.length !== 0 ? sub : null;
		});
	}
};

const buildRecord = (params: {
	fields: { key: string; field: DataFieldQ | RoleFieldQ }[];
	data: any;
	subQueries?: { key: string; query: LinkFieldQ }[];
	primaryKeys: { column: string; as: string }[];
	metadata: boolean;
	thing: string;
	thingType: 'entity' | 'relation';
	queryPath: string;
}): { record: Record<string, any>; subQueries: SingleRecordSubQuery[] } => {
	const { fields, data, primaryKeys, thing, thingType, metadata, queryPath } = params;
	const record: Record<string | symbol, any> = {};
	const id = primaryKeys.map((pk) => data[pk.as]).filter((i) => i !== undefined);
	const subQueries: SingleRecordSubQuery[] = [];

	if (metadata) {
		record.$id = id.length === 0 ? null : id.length === 1 ? id[0] : id.join(':');
		record.$thing = thing;
		record.$thingType = thingType;
		record[QueryPath] = queryPath;
	}

	fields.forEach(({ key, field }) => {
		const res = buildFieldValue({ field, data, metadata });
		record[key] = res.value;
		if (res.subQueries) {
			subQueries.push(...res.subQueries);
		}
	});

	if (params.subQueries) {
		const sk = stringifyKeys(id);
		params.subQueries.forEach(({ key, query }) => {
			subQueries.push({
				key,
				query,
				record,
				primaryKeys: id,
				stringifiedKeys: sk,
			});
		});
	}

	return { record, subQueries };
};

const buildFieldValue = (params: {
	field: DataFieldQ | RoleFieldQ;
	data: any;
	metadata: boolean;
}): { value: any; subQueries?: SingleRecordSubQuery[] } => {
	const { field, data, metadata } = params;
	switch (field.type) {
		case 'data': {
			return { value: data[field.as] };
		}
		case 'role': {
			const exists = field.primaryKeys.every((k) => data[k.as] !== null && data[k.as] !== undefined);
			if (!exists) {
				return { value: null };
			}
			if (!('fields' in field)) {
				const keys = field.primaryKeys.map((k) => data[k.as]);
				const id = keys.length > 1 ? keys.join(':') : keys[0];
				return { value: field.unique ? id : [id] };
			}
			const { record, subQueries } = buildRecord({
				fields: field.fields,
				subQueries: field.subQueries,
				primaryKeys: field.primaryKeys,
				data,
				metadata,
				thing: field.thing,
				thingType: field.thingType,
				queryPath: field.queryPath,
			});
			if (!field.subQueries || field.subQueries.length === 0) {
				return { value: field.unique ? record : [record], subQueries };
			}
			const primaryKeys = field.primaryKeys.map((i) => data[i.as]);
			const s = field.subQueries.map(({ key, query }) => ({
				key,
				query,
				record,
				primaryKeys,
				stringifiedKeys: stringifyKeys(primaryKeys),
			}));
			return {
				value: field.unique ? record : [record],
				subQueries: [...s, ...subQueries],
			};
		}
	}
};

const sqlFields = (qs: (DataFieldQ | Omit<RoleFieldQ, 'unique'>)[]) => {
	const selects = new Set<string>();
	const joins: string[] = [];
	const params: QueryParams = [];
	qs.forEach((q) => {
		if (q.type === 'data') {
			selects.add(sqlData(q));
		} else if (q.type === 'role') {
			const sql = sqlRole(q);
			sql.selects.forEach((s) => selects.add(s));
			joins.push(...sql.joins);
			params.push(...sql.params);
		}
	});
	return { selects: [...selects], joins, params };
};

const sqlData = (q: DataFieldQ): string => {
	return `${q.column} AS "${q.as}"`;
};

const sqlRole = (
	q: Omit<RoleFieldIdQ, 'unique'> | Omit<RoleFieldRecordQ, 'unique'>,
): { selects: string[]; joins: string[]; params: QueryParams } => {
	const selects = new Set<string>();
	const joins = [q.join];
	const params: QueryParams = q.params ? [...q.params] : [];

	q.primaryKeys.forEach((i) => {
		selects.add(`${i.column} AS "${i.as}"`);
	});

	if ('fields' in q) {
		const sql = sqlFields(Object.values(q.fields).map((i) => i.field));
		sql.selects.forEach((s) => selects.add(s));
		joins.push(...sql.joins);
		params.push(...sql.params);
	}

	return { selects: [...selects], joins, params };
};

const stringifyKeys = (primaryKeys: any[]) => primaryKeys.join('.');

const useOrdinalPlaceholder = (sql: string, params: QueryParams, start = 1) => {
	let newSql = sql;
	params.forEach((p, i) => {
		newSql = newSql.replace(p.key, `${i + start}`);
	});
	return newSql;
};
