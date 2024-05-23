import { getIdFieldKey, getThing, indent } from '../../../helpers';
import type {
	EnrichedAttributeQuery,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedBQLQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
} from '../../../types';
import type { Filter, PositiveFilter } from '../../../types/requests/queries';
import { QueryPath } from '../../../types/symbols';
import { v4 as uuidv4 } from 'uuid';

const separator = '___';

export const buildTQLQuery = async (props: { queries: EnrichedBQLQuery[]; schema: EnrichedBormSchema }) => {
	const { queries: batches, schema } = props;
	return batches.map((query) => buildQuery({ query, schema }));
};

const buildQuery = (props: { query: EnrichedBQLQuery; schema: EnrichedBormSchema }) => {
	const { query, schema } = props;
	const { $path, $thing, $filter, $fields, $sort, $offset, $limit, $id } = query;

	if (!$path) {
		throw new Error('Path is not defined');
	}

	const lines: string[] = [];
	const queryPath = query[QueryPath];
	lines.push('match');
	lines.push(`$${$path} isa ${$thing};`);

	if ($filter || $id) {
		const idField = getIdFieldKey(schema, query);
		const $WithIdFilter = { ...$filter, ...($id ? { [idField]: $id } : {}) };
		const filter = buildFilter({ $filter: $WithIdFilter as any, $var: $path, $thing, schema, depth: 0 });
		lines.push(`\n${filter}`);
	}

	const sorter = buildSorter({ schema, $thing, $var: $path, $sort, depth: 0 });

	if (sorter) {
		lines.push(sorter.match);
	}

	const randomId = `M_${uuidv4()}`;

	lines.push(`?queryPath${randomId} = "${queryPath}";`);
	lines.push('fetch');
	lines.push(`?queryPath${randomId} as "queryPath";`);

	if ($fields) {
		const dataFields = $fields.filter((f) => f.$fieldType === 'data') as EnrichedAttributeQuery[];
		if (dataFields && dataFields.length > 0) {
			lines.push(...processDataFields(dataFields, $path, 0));
		}

		const linkFields = $fields.filter((f) => f.$fieldType === 'link') as EnrichedLinkQuery[];
		if (linkFields && linkFields.length > 0) {
			lines.push(...processLinkFields(linkFields, $path, $path, 0, schema));
		}

		const roleFields = $fields.filter((f) => f.$fieldType === 'role') as EnrichedRoleQuery[];
		if (roleFields && roleFields.length > 0) {
			lines.push(...processRoleFields(roleFields, $path, $path, 0, schema));
		}
	}

	if (sorter) {
		lines.push(sorter.sort);
	}

	if (typeof $offset === 'number') {
		lines.push(`\noffset ${$offset};`);
	}

	if (typeof $limit === 'number') {
		lines.push(`\nlimit ${$limit};`);
	}

	return lines.join('\n');
};

const processDataFields = (dataFields: EnrichedAttributeQuery[], $path: string, depth: number) => {
	const postStrParts: string[] = [];
	const asMetaDataParts: string[] = [];

	for (let i = 0; i < dataFields.length; i++) {
		if (!dataFields[i].$isVirtual) {
			postStrParts.push(dataFields[i].$dbPath);
		}
		asMetaDataParts.push(`{${dataFields[i].$dbPath}:${dataFields[i].$as}}`);
	}

	const postStr = postStrParts.join(', ');
	const $asMetaData = asMetaDataParts.join(',');
	const $metaData = `$metadata:{as:[${$asMetaData}]}`;
	const lines = [indent(`$${$path} as "${$path}.${$metaData}.$dataFields": ${postStr};`, depth)];

	return lines;
};

const processRoleFields = (
	roleFields: EnrichedRoleQuery[],
	$path: string,
	dotPath: string,
	depth: number,
	schema: EnrichedBormSchema,
) => {
	const nextDepth = depth + 1;
	const lines: string[] = [];

	for (const roleField of roleFields) {
		const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $thing, $sort, $offset, $limit } = roleField;
		const queryPath = roleField[QueryPath];

		const $metaData = `$metadata:{as:${$as},justId:${
			$justId ? 'T' : 'F'
		},idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
		lines.push(indent(`"${dotPath}.${$metaData}.${roleField.$var}": {`, depth));
		lines.push(indent('match', nextDepth));
		const $roleVar = `${$path}${separator}${roleField.$var}`;
		lines.push(indent(`$${$roleVar} isa ${roleField.$thing};`, nextDepth));
		lines.push(
			indent(
				// TODO: The parent node already declare $path
				`$${$path} (${roleField.$var}: $${$path}${separator}${roleField.$var}) isa ${roleField.$intermediary};`,
				nextDepth,
			),
		);

		if (roleField.$filter || roleField.$id) {
			const idField = getIdFieldKey(schema, roleField);
			const $WithIdFilter = { ...roleField.$filter, ...(roleField.$id ? { [idField]: roleField.$id } : {}) };
			lines.push(
				buildFilter({
					$filter: $WithIdFilter,
					$var: $roleVar,
					$thing: roleField.$thing,
					schema,
					depth: nextDepth,
				}),
			);
		}

		const sorter = buildSorter({ schema, $thing, $var: $roleVar, $sort, depth: nextDepth });

		if (sorter) {
			lines.push(sorter.match);
		}

		if ($fields) {
			const randomId = `M_${uuidv4()}`;
			lines.push(indent(`\n?queryPath${randomId} = "${queryPath}";`, nextDepth)); ///rawPaths => to inject metadata in the response, in this case only the path
			lines.push(indent('fetch', nextDepth));
			lines.push(indent(`?queryPath${randomId} as "queryPath";`, nextDepth)); ///rawPaths => to recover metadata in the response

			const dataFields = $fields?.filter((f) => f.$fieldType === 'data') as EnrichedAttributeQuery[];
			if (dataFields && dataFields.length > 0) {
				lines.push(...processDataFields(dataFields, $roleVar, nextDepth));
			}

			const linkFields = $fields?.filter((f) => f.$fieldType === 'link') as EnrichedLinkQuery[];
			if (linkFields && linkFields.length > 0) {
				lines.push(...processLinkFields(linkFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth, schema));
			}
			const roleFields = $fields?.filter((f) => f.$fieldType === 'role') as EnrichedRoleQuery[];
			if (roleFields && roleFields.length > 0) {
				lines.push(...processRoleFields(roleFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth, schema));
			}
		}

		if (sorter) {
			lines.push(sorter.sort);
		}

		if (typeof $offset === 'number') {
			lines.push(indent(`offset ${$offset};`, nextDepth));
		}

		if (typeof $limit === 'number') {
			lines.push(indent(`limit ${$limit};`, nextDepth));
		}

		lines.push(indent('};', depth));
	}

	return lines;
};

const processLinkFields = (
	linkFields: EnrichedLinkQuery[],
	$path: string,
	dotPath: string,
	depth: number,
	schema: EnrichedBormSchema,
) => {
	const nextDepth = depth + 1;
	const lines: string[] = [];

	for (const linkField of linkFields) {
		const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $playedBy, $thing, $sort, $offset, $limit } =
			linkField;
		const queryPath = linkField[QueryPath];
		const $metaData = `$metadata:{as:${$as},justId:${
			$justId ? 'T' : 'F'
		},idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
		lines.push(indent(`"${dotPath}.${$metaData}.${linkField.$var}": {`, depth));
		lines.push(indent('match', nextDepth));
		const $linkVar = `${$path}${separator}${linkField.$var}`;
		lines.push(indent(`$${$linkVar} isa ${linkField.$thing};`, nextDepth));

		if (linkField.$filter || linkField.$id) {
			const idField = getIdFieldKey(schema, linkField);
			const $WithIdFilter = { ...linkField.$filter, ...(linkField.$id ? { [idField]: linkField.$id } : {}) };
			lines.push(
				buildFilter({
					$filter: $WithIdFilter,
					$var: $linkVar,
					$thing: linkField.$thing,
					schema,
					depth: nextDepth,
				}),
			);
		}

		const sorter = buildSorter({ schema, $thing, $var: $linkVar, $sort, depth: nextDepth });

		if (sorter) {
			lines.push(sorter.match);
		}

		if (linkField.$target === 'role') {
			// a. intermediary
			lines.push(
				indent(
					`$${$path}_intermediary (${linkField.$plays}: $${$path}, ${$playedBy.plays}: $${$linkVar}) isa ${linkField.$intermediary};`,
					nextDepth,
				),
			);
		} else {
			// b. no intermediary
			lines.push(
				indent(
					// TODO: There can't be multiple "isa" for the same variable
					// TODO: There can't be multiple relation constraints for the same variable. The filter may contain multiple relation constraints.
					`$${$linkVar} (${linkField.$plays}: $${$path});`,
					nextDepth,
				),
			);
		}

		if ($fields) {
			const randomId = `M_${uuidv4()}`;
			lines.push(indent(`?queryPath${randomId} = "${queryPath}";`, nextDepth)); ///queryPath => to inject metadata in the response, in this case only the path
			lines.push(indent('fetch', nextDepth));
			lines.push(indent(`?queryPath${randomId} as "queryPath";`, nextDepth)); ///queryPath => to recover metadata in the response

			const dataFields = $fields?.filter((f) => f.$fieldType === 'data') as EnrichedAttributeQuery[];
			if (dataFields && dataFields.length > 0) {
				lines.push(...processDataFields(dataFields, $linkVar, nextDepth));
			}

			const linkFields = $fields?.filter((f) => f.$fieldType === 'link') as EnrichedLinkQuery[];
			if (linkFields && linkFields.length > 0) {
				lines.push(...processLinkFields(linkFields, $linkVar, `${$path}.${linkField.$var}`, nextDepth, schema));
			}

			const roleFields = $fields?.filter((f) => f.$fieldType === 'role') as EnrichedRoleQuery[];
			if (roleFields && roleFields.length > 0) {
				lines.push(...processRoleFields(roleFields, $linkVar, `${$path}.${linkField.$var}`, nextDepth, schema));
			}
		}

		if (sorter) {
			lines.push(sorter.sort);
		}

		if (typeof $offset === 'number') {
			lines.push(indent(`offset ${$offset};`, nextDepth));
		}

		if (typeof $limit === 'number') {
			lines.push(indent(`limit ${$limit};`, nextDepth));
		}

		lines.push(indent('};', depth));
	}

	return lines;
};

const mapFilterKeys = (filter: Filter, thingSchema: EnrichedBormEntity | EnrichedBormRelation) => {
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

const buildFilter = (props: {
	$filter: Filter;
	$var: string;
	$thing: string;
	schema: EnrichedBormSchema;
	depth: number;
}) => {
	const { $filter: $nonMapedFilter, $var, $thing, schema, depth } = props;
	const $filter = mapFilterKeys($nonMapedFilter, getThing(schema, $thing));

	const { $not, ...rest } = $filter;

	const thing = getThing(schema, $thing);
	const matches: string[] = [];

	Object.entries($not || {}).forEach(([key, value]) => {
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
			const oppositeThing = getThing(schema, opposite.thing);
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
				const playerThing = getThing(schema, player.thing);
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
			const oppositeThing = getThing(schema, opposite.thing);
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
				const playerThing = getThing(schema, player.thing);
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

const serializeValue = (value: string | number | boolean | Date) => {
	if (typeof value === 'string') {
		return `'${value}'`;
	}
	if (value instanceof Date) {
		return `'${value.toISOString().replace('Z', '')}'`;
	}
	return `${value}`;
};

const normalizeSorter = (sort: { field: string; desc?: boolean } | string) => {
	if (typeof sort === 'string') {
		return {
			field: sort,
			desc: false,
		};
	}
	return { ...sort, desc: sort.desc ?? false };
};

const buildSorter = (props: {
	$var: string;
	$thing: string;
	schema: EnrichedBormSchema;
	$sort?: ({ field: string; desc?: boolean } | string)[];
	depth: number;
}) => {
	const { $var, $thing, schema, $sort, depth } = props;

	const thing = getThing(schema, $thing);
	const sortMatch: string[] = [];
	const sorter: string[] = [];

	$sort?.forEach((sort) => {
		const s = normalizeSorter(sort);
		const df = thing.dataFields?.find((df) => df.path === s.field);
		if (!df) {
			throw new Error(`"${$thing}" does not have data field "${s.field}"`);
		}
		const attrVar = `${s.field}_${uuidv4()}`;
		sortMatch.push(indent('{', depth));
		sortMatch.push(indent(`$${$var} has ${df.dbPath} $${attrVar}_1;`, depth + 1));
		sortMatch.push(indent('not {', depth + 1));
		sortMatch.push(indent(`$${$var} has ${df.dbPath} $${attrVar}_2;`, depth + 2));
		sortMatch.push(indent(`$${attrVar}_2 < $${attrVar}_1;`, depth + 2));
		sortMatch.push(indent('};', depth + 1));
		sortMatch.push(indent(`?${attrVar}_ = $${attrVar}_1;`, depth + 1));
		sortMatch.push(indent('} or {', depth));
		sortMatch.push(indent(`not { $${$var} has ${df.dbPath} $${attrVar}_1; };`, depth + 1));
		// TODO: This is a workaround to put things with undefined attribute at the end.
		// "~" is the last non-control char (DEC 126) in ASCII.
		sortMatch.push(indent(`?${attrVar}_ = "~";`, depth + 1));
		sortMatch.push(indent('};', depth));
		sortMatch.push(indent(`?${attrVar} = ?${attrVar}_;`, depth));
		const order = s.desc ? 'desc' : 'asc';
		sorter.push(`?${attrVar} ${order}`);
	});

	if (sortMatch.length === 0) {
		return;
	}

	return {
		match: sortMatch.join(''),
		sort: indent(`sort ${sorter.join(', ')};`, depth),
	};
};
