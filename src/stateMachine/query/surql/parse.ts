import { isArray } from 'radash';
import type {
	BormConfig,
	EnrichedBormSchema,
	EnrichedBQLQuery,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
} from '../../../types';
import { FieldSchema, QueryPath } from '../../../types/symbols';
import { sanitizeTableNameSurrealDb } from '../../../adapters/surrealDB/helpers';

export const parse = (props: {
	res: Record<string, any>[][];
	queries: EnrichedBQLQuery[];
	schema: EnrichedBormSchema;
	config: BormConfig;
}) => {
	const { res, queries } = props;
	//console.log('res!', res[0]);
	const result = res.map((r, i) => parseRes(queries[i], r));
	//console.log('result', result);
	return result;
};

const parseRes = (query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery, res: Record<string, any>[]) => {
	if (isArray(res)) {
		if (res.length === 0) {
			return null;
		}
		if (query.$filterByUnique) {
			if (res.length > 1) {
				throw new Error('Multiple results found for unique query');
			} else {
				return parseObj(query, res[0]);
			}
		}
		if (res.length >= 1) {
			return res.map((r) => parseObj(query, r));
		}
	} else {
		throw new Error('res is unexpectedly not an array');
	}
};

const parseObj = (query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery, obj: Record<string, any>) => {
	const newObj: Record<string, any> = {
		//init with symbols
		[QueryPath]: obj['$$queryPath'],
		$id: obj['$id'],
		$thing: sanitizeTableNameSurrealDb(obj['$thing']),
		$thingType: query.$thingType, //This is actually not true always, will need to be fetched from the $thing
	};

	query.$fields.forEach((f) => {
		//console.log('FIELD', f.$dbPath, 'object', obj);
		const key = f.$as;
		const value = obj[key];
		// TODO: Look up what the id field is in the schema.
		if (f.$path === 'id' && query.$idNotIncluded) {
			return;
		}
		newObj[key] = parseFieldResult(f, value);
	});
	return newObj;
};

const parseFieldResult = (query: EnrichedFieldQuery, value: any) => {
	if (!value || (isArray(value) && value.length === 0)) {
		return null;
	}
	if (query.$fieldType === 'data') {
		if (query[FieldSchema].cardinality === 'ONE') {
			isArray(value) ? value[0] : value;
		}
		return value ?? null;
	}
	if (query.$justId) {
		if (query.$filterByUnique || query[FieldSchema].cardinality === 'ONE') {
			// TODO: Look up what the id field is in the schema.
			return value[0]?.id ?? null;
		}
		// TODO: Look up what the id field is in the schema.
		return value?.map((i: Record<string, any>) => i.id) ?? [];
	} else {
		if (query.$filterByUnique || query[FieldSchema].cardinality === 'ONE') {
			return parseObj(query, value[0]);
		}
		return parseRes(query, value);
	}
};
