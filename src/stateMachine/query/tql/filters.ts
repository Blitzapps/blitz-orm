import { isObject, isArray } from "radash";
import { getSchemaByThing, indent } from "../../../helpers";
import { Filter, EnrichedBormSchema, EnrichedBormEntity, EnrichedBormRelation, PositiveFilter } from "../../../types";

export const buildFilter = (props: {
	$filter: Filter;
	$var: string;
	$thing: string;
	schema: EnrichedBormSchema;
	depth: number;
}) => {
	const { $filter: $nonMappedFilter, $var, $thing, schema, depth } = props;
	const $filter = mapFilterKeys($nonMappedFilter, getSchemaByThing(schema, $thing));

	const { $not, ...rest } = $filter;

	const thing = getSchemaByThing(schema, $thing);
	const matches: string[] = [];

	Object.entries($not || {}).forEach(([key, value]) => {
		if (key.startsWith('$')) {
			return; //todo: buildFilter should look similar to the surrealDB one, where we actually check the $or, $and, $not, $id, $thing etc. Aso we can split it in two step, parse to get all the keys etc, and build that only changes the format
		}
		const df = thing.dataFields?.find((df) => df.dbPath === key);
		if (df) {
			if (value === null) {
				matches.push(indent(`$${$var} has ${key} $${key}_${uuidv4()};`, depth));
			} else if (Array.isArray(value)) {
				value.forEach((v) => {
					matches.push(indent(`not { $${$var} has ${key} ${serializeValue(v)}; };`, depth));
				});
			} else {
				matches.push(indent(`not { $${$var} has ${key} ${serializeValue(value)}; };`, depth));
			}
			return;
		}

		const lf = thing.linkFields?.find((lf) => lf.path === key);
		if (lf) {
			const [opposite] = lf.oppositeLinkFieldsPlayedBy;
			const oppositeThing = getSchemaByThing(schema, opposite.thing);
			const oppositeIdField = oppositeThing.idFields?.[0];
			if (!oppositeIdField) {
				throw new Error(`"${opposite.thing}" does not have an id field`);
			}
			if (lf.target === 'relation') {
				if (value === null) {
					matches.push(indent(`(${lf.plays}: $${$var}) isa ${lf.relation};`, depth));
				} else if (Array.isArray(value)) {
					value.forEach((v) => {
						matches.push(
							indent(
								`not { (${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(v)}; };`,
								depth,
							),
						);
					});
				} else {
					matches.push(
						indent(
							`not { (${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(value)}; };`,
							depth,
						),
					);
				}
			} else {
				const oppVar = `${opposite.thing}_${uuidv4()}`;
				if (value === null) {
					matches.push(
						indent(
							`$${oppVar} isa ${opposite.thing}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`,
							depth,
						),
					);
				} else if (Array.isArray(value)) {
					value.forEach((v) => {
						matches.push(
							indent(
								`not { $${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(v)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`,
								depth,
							),
						);
					});
				} else {
					matches.push(
						indent(
							`not { $${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(value)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`,
							depth,
						),
					);
				}
			}
			return;
		}

		if (thing.thingType === 'relation') {
			const role = thing.roles[key];
			if (role) {
				const [player] = role.playedBy || [];
				const playerThing = getSchemaByThing(schema, player.thing);
				const playerIdField = playerThing.idFields?.[0];
				if (!playerIdField) {
					throw new Error(`"${player.thing}" does not have an id field`);
				}
				const playerVar = `${player.thing}_${uuidv4()}`;
				const filterId = uuidv4();
				const filterVar = `${$var}_${filterId}`;
				if (value === null) {
					matches.push(indent(`$${filterVar} isa ${$thing};`, depth));
					matches.push(indent(`$${filterVar} (${player.plays}: ${playerVar});`, depth));
					matches.push(indent(`$${$var} is $${filterVar};`, depth));
				} else if (Array.isArray(value)) {
					value.forEach((v) => {
						matches.push(indent(`$${filterVar} isa ${$thing};`, depth));
						matches.push(
							indent(
								`not { $${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(v)}; $${filterVar} (${player.plays}: $${playerVar}); };`,
								depth,
							),
						);
						matches.push(indent(`$${$var} is $${filterVar};`, depth));
					});
				} else {
					matches.push(indent(`$${filterVar} isa ${$thing};`, depth));
					matches.push(
						indent(
							`not { $${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(value)}; $${filterVar} (${player.plays}: $${playerVar}); };`,
							depth,
						),
					);
					matches.push(indent(`$${$var} is $${filterVar};`, depth));
				}
				return;
			}
		}
	});

	Object.entries(rest).forEach(([key, value]) => {
		if (key.startsWith('$')) {
			return; //todo: buildFilter should look similar to the surrealDB one, where we actually check the $or, $and, $not, $id, $thing etc
		}
		const df = thing.dataFields?.find((df) => df.dbPath === key);
		if (df) {
			if (value === null) {
				matches.push(indent(`not { $${$var} has ${key} $${key}_${uuidv4()}; };`, depth));
			} else if (Array.isArray(value)) {
				const alt = value.map((v) => `$${$var} has ${key} ${serializeValue(v)};`);
				const match = joinAlt(alt);
				if (match) {
					matches.push(indent(match, depth));
				}
			} else {
				matches.push(indent(`$${$var} has ${key} ${serializeValue(value)};`, depth));
			}
			return;
		}

		const lf = thing.linkFields?.find((lf) => lf.path === key);
		if (lf) {
			const [opposite] = lf.oppositeLinkFieldsPlayedBy;
			const oppositeThing = getSchemaByThing(schema, opposite.thing);
			const oppositeIdField = oppositeThing.idFields?.[0];
			if (!oppositeIdField) {
				throw new Error(`"${opposite.thing}" does not have an id field`);
			}
			if (lf.target === 'relation') {
				if (value === null) {
					matches.push(indent(`not { (${lf.plays}: $${$var}) isa ${lf.relation}; };`, depth));
				} else if (Array.isArray(value)) {
					const alt = value.map(
						(v) => `(${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(v)};`,
					);
					const match = joinAlt(alt);
					if (match) {
						matches.push(indent(match, depth));
					}
				} else {
					matches.push(
						indent(
							`(${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(value)};`,
							depth,
						),
					);
				}
			} else {
				const oppVar = `${opposite.thing}_${uuidv4()}`;
				if (value === null) {
					matches.push(
						indent(
							`not { $${oppVar} isa ${opposite.thing}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`,
							depth,
						),
					);
				} else if (Array.isArray(value)) {
					const alt = value.map(
						(v) =>
							`$${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(v)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`,
					);
					const match = joinAlt(alt);
					if (match) {
						matches.push(indent(match, depth));
					}
				} else {
					matches.push(
						indent(
							`$${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(value)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`,
							depth,
						),
					);
				}
			}
			return;
		}

		if (thing.thingType === 'relation') {
			const role = thing.roles[key];
			if (role) {
				const [player] = role.playedBy || [];
				const playerThing = getSchemaByThing(schema, player.thing);
				const playerIdField = playerThing.idFields?.[0];
				if (!playerIdField) {
					throw new Error(`"${player.thing}" does not have an id field`);
				}
				const playerVar = `${player.thing}_${uuidv4()}`;
				const filterId = uuidv4();
				const filterVar = `${$var}_${filterId}`;
				if (value === null) {
					matches.push(indent(`$${filterVar} isa ${$thing};`, depth));
					matches.push(indent(`not { $${filterVar} (${player.plays}: ${playerVar}); };`, depth));
					matches.push(indent(`$${$var} is $${filterVar};`, depth));
				} else if (Array.isArray(value)) {
					const alt = value.map(
						(v) =>
							`$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(v)}; $${filterVar} (${player.plays}: $${playerVar});`,
					);
					const match = joinAlt(alt);
					if (match) {
						matches.push(indent(`$${filterVar} isa ${$thing};`, depth));
						matches.push(indent(match, depth));
						matches.push(indent(`$${$var} is $${filterVar};`, depth));
					}
				} else {
					matches.push(indent(`$${filterVar} isa ${$thing};`, depth));
					matches.push(
						indent(
							`$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(value)}; $${filterVar} (${player.plays}: $${playerVar});`,
							depth,
						),
					);
					matches.push(indent(`$${$var} is $${filterVar};`, depth));
				}
				return;
			}
		}

		throw new Error(`"${$thing}" does not have property "${key}"`);
	});

	return matches.join('\n');
};

const joinAlt = (alt: string[]): string | undefined => {
	if (alt.length > 1) {
		return `{ ${alt.join(' } or { ')} };`;
	}
	const [match] = alt;
	return match;
};

const serializeValue = (value: string | number | boolean | Date | object) => {
	if (typeof value === 'string') {
		return `'${value}'`;
	}
	if (value instanceof Date) {
		return `'${value.toISOString().replace('Z', '')}'`;
	}

	if (isObject(value)) {
		//Todo: Temporal fix, enhance on filters refacto. Btw the dbPath to be added also in the fields as [TypeDBMeta]
		if ('$id' in value) {
			if (isArray(value.$id)) {
				return `like "^(${value.$id.join('|')})$"`;
			}
			return `"${value.$id}"`;
		}
	}
	return `${value}`;
};

const mapFilterKeys = (filter: Filter, thingSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	//? This does not work recursively?
	const mapper: Record<string, string> = {};

	thingSchema.dataFields?.forEach((df) => {
		if (df.path !== df.dbPath) {
			//todo dbPath into TQLMetadata instead of a global dbPath. To be done during enrichment
			mapper[df.path] = df.dbPath;
		}
	});

	if (Object.keys(mapper).length === 0) {
		return filter;
	}

	const { $not, ...f } = filter;
	const newFilter: Filter = mapPositiveFilterKeys(f, mapper);

	if ($not) {
		newFilter.$not = mapPositiveFilterKeys($not as PositiveFilter, mapper);
	}

	return newFilter;
};

const mapPositiveFilterKeys = (filter: PositiveFilter, mapper: Record<string, string>) => {
	const newFilter: PositiveFilter = {};
	Object.entries(filter).forEach(([key, filterValue]) => {
		const newKey = mapper[key] || key;
		newFilter[newKey] = filterValue;
	});
	return newFilter;
};