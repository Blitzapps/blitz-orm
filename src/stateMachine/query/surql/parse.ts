import { isArray } from 'radash';
import type {
	BormConfig,
	EnrichedBormSchema,
	EnrichedBQLQuery,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
} from '../../../types';
import { QueryPath } from '../../../types/symbols';

export const parse = (props: {
	res: Record<string, any>[][];
	queries: EnrichedBQLQuery[];
	schema: EnrichedBormSchema;
	config: BormConfig;
}) => {
	const { res, queries } = props;
	//console.log('res', res);
	const result = res.map((r, i) => parseRes(queries[i], r));
	//console.log('result', result);
	return result;
};

const parseRes = (query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery, res: Record<string, any>[]) => {
	if (isArray(res) && res.length === 0) {
		return null;
	}
	return res.map((r) => parseObj(query, r));
};

const parseObj = (query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery, obj: Record<string, any>) => {
	const newObj: Record<string, any> = {
		//init with symbols
		[QueryPath]: obj['$$queryPath'],
		$id: obj['$id'],
		$thing: obj['$thing'],
		$thingType: query.$thingType, //This is actually not true always, will need to be fetched from the $thing
	};

	query.$fields.forEach((f) => {
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
	if (query.$fieldType === 'data') {
		return value ?? null;
	}
	if (query.$justId) {
		if (query.$filterByUnique) {
			// TODO: Look up what the id field is in the schema.
			return value[0]?.id ?? null;
		}
		// TODO: Look up what the id field is in the schema.
		return value?.map((i: Record<string, any>) => i.id) ?? [];
	} else {
		if (query.$filterByUnique) {
			return parseObj(query, value[0]);
		}
		return parseRes(query, value);
	}
};
