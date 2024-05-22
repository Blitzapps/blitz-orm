import type {
	EnrichedAttributeQuery,
	EnrichedBQLQuery,
	EnrichedBormSchema,
	EnrichedFieldQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
	Filter,
	PositiveFilter,
} from '../../../types';
import { indent } from '../../../helpers';
import { QueryPath } from '../../../types/symbols';

export const build = (props: { queries: EnrichedBQLQuery[]; schema: EnrichedBormSchema }) => {
	const { queries, schema } = props;
	//console.log('queries!', queries);
	return queries.map((query) => buildQuery({ query, schema }));
};

const buildQuery = (props: { query: EnrichedBQLQuery; schema: EnrichedBormSchema }): string | null => {
	const { query, schema } = props;

	if (query.$fields.length === 0) {
		return null;
	}

	const lines: string[] = [];

	lines.push('SELECT');

	const fieldLines = buildFieldsQuery({ parentQuery: query, queries: query.$fields, level: 1, schema });
	if (fieldLines) {
		lines.push(fieldLines);
	}

	const currentSchema = schema.entities[query.$thing] || schema.relations[query.$thing];
	if (!currentSchema) {
		throw new Error(`Schema for ${query.$thing} not found`);
	}
	const allTypes = currentSchema.subTypes ? [query.$thing, ...currentSchema.subTypes] : [query.$thing];

	lines.push(`FROM ${allTypes.join(',')}`);

	const filter = (query.$filter && buildFilter(query.$filter, 0)) || [];
	lines.push(...filter);

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
		return indent(`meta::id(\`${query.$path}\`) AS ${query.$as}`, level);
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

	const things = [
		query.$playedBy.thing,
		...getSubtypeRecursive(schema, query.$playedBy.thingType, query.$playedBy.thing),
	];
	let from: string;
	if (query.$target === 'relation') {
		// [Space]<-SpaceObj_spaces<-SpaceObj
		// NOTE:
		// Convention: The thing that owns the role has "out"-ward arrow
		// and the thing that has the linkField has "in"-ward arrow.
		from = things.map((thing) => `<-\`${query.$playedBy.thing}_${query.$plays}\`<-\`${thing}\``).join(', ');
	} else {
		// [Space]<-Space-User_spaces<-Space-User->Space-User_users->User
		from = things
			.map(
				(thing) =>
					`<-\`${query.$playedBy.relation}_${query.$plays}\`<-\`${query.$playedBy.relation}\`->\`${query.$playedBy.relation}_${query.$playedBy.plays}\`->\`${thing}\``,
			)
			.join(', ');
	}
	lines.push(indent(`FROM ${from}`, queryLevel));

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

	const things = [query.$playedBy.thing, ...getSubtypeRecursive(schema, query.$thingType, query.$thing)];
	const from = things
		.map((thing) => `->\`${query.$playedBy.relation}_${query.$playedBy.plays}\`->\`${thing}\``)
		.join(', ');
	lines.push(indent(`FROM ${from}`, queryLevel));

	if (query.$filter) {
		lines.push(...buildFilter(query.$filter, queryLevel));
	}

	lines.push(indent(`) AS \`${query.$as}\``, level));

	return lines.join('\n');
};

const buildFilter = (filter: Filter, level: number): string[] => {
	const conditions: string[] = [];
	const { $not, ...f } = filter;
	const conditionLevel = level + 1;
	Object.entries(f).forEach(([key, value]) => {
		conditions.push(indent(`${key}=${JSON.stringify(value)}`, conditionLevel));
	});
	if ($not) {
		Object.entries($not as PositiveFilter).forEach(([key, value]) => {
			conditions.push(`${key}!=${JSON.stringify(value)}`);
		});
	}
	const [firstCondition, ...restConditions] = conditions;
	if (firstCondition) {
		return [
			indent('WHERE (', level),
			indent(firstCondition, conditionLevel),
			...restConditions.map((i) => indent(`AND ${i}`, conditionLevel)),
			indent(')', level),
		];
	}
	return conditions;
};

const getSubtypeRecursive = (schema: EnrichedBormSchema, thingType: 'entity' | 'relation', thing: string): string[] => {
	const subTypes = getSubtype(schema, thingType, thing);
	let i = 0;
	while (subTypes[i]) {
		subTypes.push(...getSubtype(schema, thingType, subTypes[i]));
		i++;
	}
	return subTypes;
};

const getSubtype = (schema: EnrichedBormSchema, thingType: 'entity' | 'relation', thing: string): string[] => {
	const subtypes = Object.values(thingType === 'entity' ? schema.entities : schema.relations)
		.filter((itemSchema) => itemSchema.extends === thing)
		.map((itemSchema) => itemSchema.name as string);
	return subtypes;
};
