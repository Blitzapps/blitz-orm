import { isObject, isArray } from 'radash';
import { getSchemaByThing, indent } from '../../../helpers';
import { v4 as uuidv4 } from 'uuid';
import type {
	Filter,
	EnrichedBormSchema,
	EnrichedBormEntity,
	EnrichedBormRelation,
	PositiveFilter,
} from '../../../types';

export const buildFilter = (props: {
	$filter: Filter;
	$var: string;
	$thing: string;
	schema: EnrichedBormSchema;
	depth: number;
}): string => {
	const { $filter: $nonMappedFilter, $var, $thing, schema, depth } = props;
	const $filter = mapFilterKeys($nonMappedFilter, getSchemaByThing(schema, $thing));

	const { $not, ...rest } = $filter;

	const matches: string[] = [];

	// Handle $not filters
	if (isPositiveFilter($not)) {
		const notMatches = processPositiveFilter($not, $var, $thing, schema, depth, true);
		matches.push(...notMatches);
	} else if ($not !== undefined) {
		throw new Error('$not must be a PositiveFilter object');
	}

	// Handle positive filters
	const positiveMatches = processPositiveFilter(rest, $var, $thing, schema, depth, false);
	matches.push(...positiveMatches);

	return matches.join('\n');
};

const processPositiveFilter = (
	filter: PositiveFilter,
	$var: string,
	$thing: string,
	schema: EnrichedBormSchema,
	depth: number,
	isNegated: boolean,
): string[] => {
	const thing = getSchemaByThing(schema, $thing);
	const matches: string[] = [];

	for (const [key, value] of Object.entries(filter)) {
		if (key.startsWith('$')) {
			// Handle logical operators ($and, $or)
			const normalizedKey = key.toLowerCase() as '$and' | '$or';
			if (normalizedKey === '$and' || normalizedKey === '$or') {
				const subFilters = isArray(value) ? value : [value];
				const subMatches = subFilters.map((subFilter) => {
					if (isPositiveFilter(subFilter)) {
						const subFilterMatches = processPositiveFilter(subFilter, $var, $thing, schema, depth + 1, isNegated);
						return subFilterMatches.join('\n');
					} else {
						throw new Error(`Invalid subfilter in ${normalizedKey}: ${JSON.stringify(subFilter)}`);
					}
				});
				const joinedSubMatches = subMatches.join(normalizedKey === '$and' ? '\n' : ' } or { ');
				if (normalizedKey === '$or' && subMatches.length > 1) {
					matches.push(indent(`{ ${joinedSubMatches} };`, depth));
				} else {
					matches.push(indent(joinedSubMatches, depth));
				}
				continue;
			}
			// Skip other special keys
			continue;
		}

		// Handle data fields
		const df = thing.dataFields?.find((df) => df.dbPath === key || df.path === key);
		if (df) {
			const fieldMatches = handleDataFieldFilter(key, value, $var, depth, isNegated);
			matches.push(...fieldMatches);
			continue;
		}

		// Handle link fields
		const lf = thing.linkFields?.find((lf) => lf.path === key);
		if (lf) {
			const linkMatches = handleLinkFieldFilter(lf, value, $var, schema, depth, isNegated);
			matches.push(...linkMatches);
			continue;
		}

		// Handle roles in relations
		if (thing.thingType === 'relation') {
			const role = thing.roles[key];
			if (role) {
				const roleMatches = handleRelationRoleFilter(role, value, $var, $thing, schema, depth, isNegated);
				matches.push(...roleMatches);
				continue;
			}
		}

		throw new Error(`"${$thing}" does not have property "${key}"`);
	}

	return matches;
};

const handleDataFieldFilter = (key: string, value: any, $var: string, depth: number, isNegated: boolean): string[] => {
	const matches: string[] = [];

	if (isObject(value) && !isArray(value)) {
		// Handle operator-based filters (e.g., { $eq: value })
		for (const [op, opValue] of Object.entries(value)) {
			const normalizedOp = op.toLowerCase() as '$eq' | '$ne' | '$in' | '$nin' | '$exists';
			let match = '';
			switch (normalizedOp) {
				case '$eq':
					match = `$${$var} has ${key} ${serializeValue(opValue)};`;
					break;
				case '$ne':
					match = `not { $${$var} has ${key} ${serializeValue(opValue)}; };`;
					break;
				case '$in': {
					if (!isArray(opValue)) {
						throw new Error('Value for $in operator must be an array');
					}
					const inAlt = opValue.map((v) => `$${$var} has ${key} ${serializeValue(v)};`);
					match = joinAlt(inAlt);
					if (isNegated) {
						match = `not { ${match} };`;
					}
					break;
				}
				case '$nin':
					if (!isArray(opValue)) {
						throw new Error('Value for $nin operator must be an array');
					}
					for (const v of opValue) {
						const ninMatch = `not { $${$var} has ${key} ${serializeValue(v)}; };`;
						matches.push(indent(ninMatch, depth));
					}
					continue; // Skip the rest of the loop for '$nin'
				case '$exists':
					if (opValue === true) {
						match = `$${$var} has ${key} $${key}_${uuidv4()};`;
					} else if (opValue === false) {
						match = `not { $${$var} has ${key} $${key}_${uuidv4()}; };`;
					} else {
						throw new Error(`Invalid value for $exists: ${opValue}`);
					}
					break;
				default:
					throw new Error(`Unsupported operator "${op}" for data field "${key}"`);
			}
			if (isNegated) {
				match = `not { ${match} };`;
			}
			matches.push(indent(match, depth));
		}
	} else if (isArray(value)) {
		// Treat array value as an $in operator
		const alt = value.map((v) => `$${$var} has ${key} ${serializeValue(v)};`);
		let match = joinAlt(alt);
		if (match) {
			if (isNegated) {
				match = `not { ${match} };`;
			}
			matches.push(indent(match, depth));
		}
	} else {
		// Scalar value
		let match = `$${$var} has ${key} ${serializeValue(value)};`;
		if (isNegated) {
			match = `not { ${match} };`;
		}
		matches.push(indent(match, depth));
	}

	return matches;
};

const handleLinkFieldFilter = (
	lf: any, // Adjust type as needed
	value: any,
	$var: string,
	schema: EnrichedBormSchema,
	depth: number,
	isNegated: boolean,
): string[] => {
	const matches: string[] = [];
	const [opposite] = lf.oppositeLinkFieldsPlayedBy;
	const oppositeThing = getSchemaByThing(schema, opposite.thing);
	const oppositeIdField = oppositeThing.idFields?.[0];
	if (!oppositeIdField) {
		throw new Error(`"${opposite.thing}" does not have an id field`);
	}

	const oppVar = `${opposite.thing}_${uuidv4()}`;

	let match = '';

	if (lf.target === 'relation') {
		// Handle link field targeting a relation
		if (value === null) {
			match = isNegated
				? `(${lf.plays}: $${$var}) isa ${lf.relation};`
				: `not { (${lf.plays}: $${$var}) isa ${lf.relation}; };`;
		} else if (isArray(value)) {
			const alt = value.map(
				(v) => `(${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(v)};`,
			);
			match = joinAlt(alt);
			if (isNegated) {
				match = `not { ${match} };`;
			}
		} else {
			match = `(${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(value)};`;
			if (isNegated) {
				match = `not { ${match} };`;
			}
		}
	} else {
		// Handle link field without intermediary relation
		if (value === null) {
			match = isNegated
				? `$${oppVar} isa ${opposite.thing}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`
				: `not { $${oppVar} isa ${opposite.thing}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`;
		} else if (isArray(value)) {
			const alt = value.map(
				(v) =>
					`$${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(
						v,
					)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`,
			);
			match = joinAlt(alt);
			if (isNegated) {
				match = `not { ${match} };`;
			}
		} else {
			match = `$${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(
				value,
			)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`;
			if (isNegated) {
				match = `not { ${match} };`;
			}
		}
	}

	matches.push(indent(match, depth));
	return matches;
};

const handleRelationRoleFilter = (
	role: any, // Adjust type as needed
	value: any,
	$var: string,
	$thing: string,
	schema: EnrichedBormSchema,
	depth: number,
	isNegated: boolean,
): string[] => {
	const matches: string[] = [];
	const [player] = role.playedBy || [];
	const playerThing = getSchemaByThing(schema, player.thing);
	const playerIdField = playerThing.idFields?.[0];
	if (!playerIdField) {
		throw new Error(`"${player.thing}" does not have an id field`);
	}
	const playerVar = `${player.thing}_${uuidv4()}`;
	const filterId = uuidv4();
	const filterVar = `${$var}_${filterId}`;

	matches.push(indent(`$${filterVar} isa ${$thing};`, depth));

	let match = '';

	if (value === null) {
		match = `$${filterVar} (${player.plays}: ${playerVar});`;
		if (isNegated) {
			matches.push(indent(match, depth));
		} else {
			matches.push(indent(`not { ${match} };`, depth));
		}
	} else if (isArray(value)) {
		const alt = value.map(
			(v) =>
				`$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(
					v,
				)}; $${filterVar} (${player.plays}: $${playerVar});`,
		);
		match = joinAlt(alt);
		if (isNegated) {
			matches.push(indent(`not { ${match} };`, depth));
		} else {
			matches.push(indent(match, depth));
		}
	} else {
		match = `$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(
			value,
		)}; $${filterVar} (${player.plays}: $${playerVar});`;
		if (isNegated) {
			matches.push(indent(`not { ${match} };`, depth));
		} else {
			matches.push(indent(match, depth));
		}
	}

	matches.push(indent(`$${$var} is $${filterVar};`, depth));

	return matches;
};

const joinAlt = (alt: string[]): string => {
	if (alt.length > 1) {
		return `{ ${alt.join(' } or { ')} };`;
	} else if (alt.length === 1) {
		return alt[0];
	} else {
		throw new Error('No alternatives provided to joinAlt');
	}
};

const serializeValue = (value: string | number | boolean | Date | object): string => {
	if (typeof value === 'string') {
		return `'${value}'`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${value}`;
	}
	if (value instanceof Date) {
		return `'${value.toISOString().replace('Z', '')}'`;
	}
	if (isObject(value)) {
		if ('$id' in value) {
			const idValue = (value as any).$id;
			if (isArray(idValue)) {
				return `like "^(${idValue.join('|')})$"`;
			}
			return serializeValue(idValue);
		}
		throw new Error('Cannot serialize complex object values in filter');
	}
	throw new Error(`Unsupported value type: ${typeof value}`);
};

const mapFilterKeys = (filter: Filter, thingSchema: EnrichedBormEntity | EnrichedBormRelation): Filter => {
	const mapper: Record<string, string> = {};

	thingSchema.dataFields?.forEach((df) => {
		if (df.path !== df.dbPath) {
			mapper[df.path] = df.dbPath;
		}
	});

	if (Object.keys(mapper).length === 0) {
		return filter;
	}

	const { $not, ...f } = filter;
	const newFilter: Filter = mapPositiveFilterKeys(f, mapper);

	if ($not && isPositiveFilter($not)) {
		newFilter.$not = mapPositiveFilterKeys($not, mapper);
	}

	return newFilter;
};

const mapPositiveFilterKeys = (filter: PositiveFilter, mapper: Record<string, string>): PositiveFilter => {
	const newFilter: PositiveFilter = {};
	Object.entries(filter).forEach(([key, filterValue]) => {
		const newKey = mapper[key] || key;
		newFilter[newKey] = filterValue;
	});
	return newFilter;
};

const isPositiveFilter = (filter: any): filter is PositiveFilter => {
	return typeof filter === 'object' && filter !== null && !Array.isArray(filter);
};
