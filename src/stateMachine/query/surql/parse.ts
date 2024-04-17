import type {
	BormConfig,
	EnrichedBormSchema,
	EnrichedBQLQuery,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
} from '../../../types';

export const parse = (props: {
	res: Record<string, any>[][];
	queries: EnrichedBQLQuery[];
	schema: EnrichedBormSchema;
	config: BormConfig;
}) => {
	const { res, queries } = props;
	return res.map((r, i) => parseRes(queries[i], r));
};

const parseRes = (query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery, res: Record<string, any>[]) => {
	return res.map((r) => parseObj(query, r));
};

const parseObj = (query: EnrichedBQLQuery | EnrichedLinkQuery | EnrichedRoleQuery, obj: Record<string, any>) => {
	const newObj: Record<string, any> = {};
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
		} else {
			// TODO: Look up what the id field is in the schema.
			return value?.map((i: Record<string, any>) => i.id) ?? [];
		}
	} else {
		if (query.$filterByUnique) {
			return parseObj(query, value[0]);
		} else {
			return parseRes(query, value);
		}
	}
};
