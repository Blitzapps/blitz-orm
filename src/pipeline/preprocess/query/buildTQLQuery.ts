import { getThing } from '../../../helpers';
import type { EnrichedBormSchema, Sorter } from '../../../types';
import { QueryPath } from '../../../types/symbols';
import type { TypeDbResponse } from '../../pipeline';
import type { PipelineOperation } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

const separator = '___';

export const buildTQLQuery: PipelineOperation = async (req) => {
	const { enrichedBqlQuery, schema } = req;
	if (!enrichedBqlQuery) {
		throw new Error('BQL query not enriched');
	}

	let tqlStr = '';

	type ValueBlock = {
		$thing: string;
		$thingType: 'entity' | 'relation' | 'thing' | 'attribute';
		$path?: string;
		$as?: string;
		$var?: string;
		$fields?: ValueBlock[];
		$filter?: object;
		$fieldType?: 'data' | 'role' | 'link';
		$sort?: Sorter[];
		$offset?: number;
		$limit?: number;
		[QueryPath]?: string;
	};

	const processDataFields = (
		dataFields: {
			$path: string;
			$dbPath: string;
			$thingType: 'attribute';
			$as: string;
			$var: string;
			$fieldType: 'data';
			$justId: boolean;
			$isVirtual: boolean;
		}[],
		$path: string,
		depth: number,
	) => {
		const postStrParts: string[] = [];
		const asMetaDataParts: string[] = [];

		let $asMetaData = '';

		for (let i = 0; i < dataFields.length; i++) {
			if (!dataFields[i].$isVirtual) {
				postStrParts.push(dataFields[i].$dbPath);
			}
			asMetaDataParts.push(`{${dataFields[i].$dbPath}:${dataFields[i].$as}}`);
		}

		const postStr = postStrParts.join(', ');
		$asMetaData = asMetaDataParts.join(',');

		const $metaData = `$metadata:{as:[${$asMetaData}]}`;

		tqlStr += indent(`$${$path} as "${$path}.${$metaData}.$dataFields": ${postStr};`, depth);
	};

	const processRoleFields = (
		roleFields: {
			$path: string;
			$dbPath: string;
			$thingType: 'entity' | 'relation' | 'thing';
			$as: string;
			$var: string;
			$fieldType: 'link';
			$target: 'role' | 'relation';
			$fields?: ValueBlock[];
			$thing: string;
			$plays: string;
			$intermediary: string;
			$justId: boolean;
			$filter: object;
			$idNotIncluded: boolean;
			$filterByUnique: boolean;
			$playedBy: any;
			$sort?: Sorter[];
			$offset?: number;
			$limit?: number;
			[QueryPath]: string;
		}[],
		$path: string,
		dotPath: string,
		depth: number,
	) => {
		const nextDepth = depth + 1;
		for (const roleField of roleFields) {
			const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $thing, $sort, $offset, $limit } = roleField;
			const queryPath = roleField[QueryPath];

			const $metaData = `$metadata:{as:${$as},justId:${
				$justId ? 'T' : 'F'
			},idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
			tqlStr += indent(`"${dotPath}.${$metaData}.${roleField.$var}": {`, depth);
			tqlStr += indent('match', nextDepth);
			const $roleVar = `${$path}${separator}${roleField.$var}`;
			tqlStr += indent(`$${$roleVar} isa ${roleField.$thing};`, nextDepth);
			tqlStr += indent(
				`$${$path} (${roleField.$var}: $${$path}${separator}${roleField.$var}) isa ${roleField.$intermediary};`,
				nextDepth,
			);

			if (roleField.$filter) {
				tqlStr += buildFilter({
					$filter: roleField.$filter as any,
					$var: $roleVar,
					$thing: roleField.$thing,
					schema,
					depth: nextDepth,
				});
			}

			const sorter = buildSorter({ schema, $thing, $var: $roleVar, $sort, depth: nextDepth });

			if (sorter) {
				tqlStr += sorter.match;
			}

			if ($fields) {
				const randomId = `M_${uuidv4()}`;
				tqlStr += indent(`\n?queryPath${randomId} = "${queryPath}";`, nextDepth); ///rawPaths => to inject metadata in the response, in this case only the path
				tqlStr += indent('fetch', nextDepth);
				tqlStr += indent(`?queryPath${randomId} as "queryPath";`, nextDepth); ///rawPaths => to recover metadata in the response

				const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
				if (dataFields && dataFields.length > 0) {
					// @ts-expect-error todo
					processDataFields(dataFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth);
				}

				const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
				if (linkFields && linkFields.length > 0) {
					// @ts-expect-error todo
					processLinkFields(linkFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth);
				}
				const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
				if (roleFields && roleFields.length > 0) {
					// @ts-expect-error todo
					processRoleFields(roleFields, $roleVar, `${$path}.${roleField.$var}`, nextDepth);
				}
			}

			if (sorter) {
				tqlStr += sorter.sort;
			}

			if (typeof $offset === 'number') {
				tqlStr += indent(`offset ${$offset};`, nextDepth);
			}

			if (typeof $limit === 'number') {
				tqlStr += indent(`limit ${$limit};`, nextDepth);
			}

			tqlStr += indent('};', depth);
		}
	};

	const processLinkFields = (
		linkFields: {
			$path: string;
			$dbPath: string;
			$thingType: 'entity' | 'relation' | 'thing';
			$as: string;
			$var: string;
			$fieldType: 'link';
			$target: 'role' | 'relation';
			$fields?: ValueBlock[];
			$intermediary?: string;
			$thing: string;
			$plays: string;
			$justId: boolean;
			$filter: object;
			$idNotIncluded: boolean;
			$filterByUnique: boolean;
			$playedBy: any;
			$sort?: Sorter[];
			$offset?: number;
			$limit?: number;
			[QueryPath]: string;
		}[],
		$path: string,
		dotPath: string,
		depth: number,
	) => {
		const nextDepth = depth + 1;
		for (const linkField of linkFields) {
			const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $playedBy, $thing, $sort, $offset, $limit } =
				linkField;
			const queryPath = linkField[QueryPath];
			const $metaData = `$metadata:{as:${$as},justId:${
				$justId ? 'T' : 'F'
			},idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
			tqlStr += indent(`"${dotPath}.${$metaData}.${linkField.$var}": {`, depth);
			tqlStr += indent('match', nextDepth);
			const $linkVar = `${$path}${separator}${linkField.$var}`;
			tqlStr += indent(`$${$linkVar} isa ${linkField.$thing};`, nextDepth);

			if (linkField.$filter) {
				tqlStr += buildFilter({
					$filter: linkField.$filter as any,
					$var: $linkVar,
					$thing: linkField.$thing,
					schema,
					depth: nextDepth,
				});
			}

			const sorter = buildSorter({ schema, $thing, $var: $linkVar, $sort, depth: nextDepth });

			if (sorter) {
				tqlStr += sorter.match;
			}

			// a. intermediary
			if (linkField.$target === 'role') {
				tqlStr += indent(
					`$${$path}_intermediary (${linkField.$plays}: $${$path}, ${$playedBy.plays}: $${$linkVar}) isa ${linkField.$intermediary};`,
					nextDepth,
				);
			} else {
				// b. no intermediary
				tqlStr += `\n$${$linkVar} (${linkField.$plays}: $${$path}) isa ${linkField.$thing};`;
			}

			if ($fields) {
				const randomId = `M_${uuidv4()}`;
				tqlStr += indent(`?queryPath${randomId} = "${queryPath}";`, nextDepth); ///queryPath => to inject metadata in the response, in this case only the path
				tqlStr += indent('fetch', nextDepth);
				tqlStr += indent(`?queryPath${randomId} as "queryPath";`, nextDepth); ///queryPath => to recover metadata in the response

				const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
				if (dataFields && dataFields.length > 0) {
					// @ts-expect-error todo
					processDataFields(dataFields, $linkVar, nextDepth);
				}

				const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
				if (linkFields && linkFields.length > 0) {
					// @ts-expect-error todo
					processLinkFields(linkFields, $linkVar, `${$path}.${linkField.$var}`, nextDepth);
				}

				const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
				if (roleFields && roleFields.length > 0) {
					// @ts-expect-error todo
					processRoleFields(roleFields, $linkVar, `${$path}.${linkField.$var}`, nextDepth);
				}
			}

			if (sorter) {
				tqlStr += sorter.sort;
			}

			if (typeof $offset === 'number') {
				tqlStr += indent(`offset ${$offset};`, nextDepth);
			}

			if (typeof $limit === 'number') {
				tqlStr += indent(`limit ${$limit};`, nextDepth);
			}

			tqlStr += indent('};', depth);
		}
	};

	const isBatched = enrichedBqlQuery.length > 1;
	const tqlStrings: string[] = [];

	const builder = (enrichedBqlQuery: ValueBlock[]) => {
		// Batched
		if (isBatched) {
			for (const query of enrichedBqlQuery) {
				const { $path, $thing, $filter, $fields, $sort, $offset, $limit } = query;

				if (!$path) {
					throw new Error('Path is not defined');
				}

				const queryPath = query[QueryPath];
				tqlStr += `\nmatch\n$${$path} isa ${$thing};`;

				if ($filter) {
					const filter = buildFilter({ $filter: $filter as any, $var: $path, $thing, schema, depth: 0 });
					tqlStr += `\n${filter}`;
				}

				const sorter = buildSorter({ schema, $thing, $var: $path, $sort, depth: 0 });

				if (sorter) {
					tqlStr += sorter.match;
				}

				const randomId = `M_${uuidv4()}`;

				tqlStr += `\n?queryPath${randomId} = "${queryPath}";`;
				tqlStr += '\nfetch';
				tqlStr += `\n?queryPath${randomId} as "queryPath";`;

				if ($fields) {
					const dataFields = $fields.filter((f) => f.$fieldType === 'data');
					if (dataFields && dataFields.length > 0) {
						// @ts-expect-error todo
						processDataFields(dataFields, $path, 0);
					}

					const linkFields = $fields.filter((f) => f.$fieldType === 'link');
					if (linkFields && linkFields.length > 0) {
						// @ts-expect-error todo
						processLinkFields(linkFields, $path, $path, 0);
					}

					const roleFields = $fields.filter((f) => f.$fieldType === 'role');
					if (roleFields && roleFields.length > 0) {
						// @ts-expect-error todo
						processRoleFields(roleFields, $path, $path, 0);
					}
				}

				if (sorter) {
					tqlStr += sorter.sort;
				}

				if (typeof $offset === 'number') {
					tqlStr += `\noffset ${$offset};`;
				}

				if (typeof $limit === 'number') {
					tqlStr += `\nlimit ${$limit};`;
				}

				tqlStrings.push(tqlStr);
				tqlStr = '';
			}
		} else {
			for (const query of enrichedBqlQuery) {
				const { $path, $thing, $filter, $fields, $sort, $offset, $limit } = query;
				if (!$path || $path === 'undefined') {
					throw new Error('Path is not defined');
				}

				const queryPath = query[QueryPath];
				tqlStr += `\nmatch\n$${$path} isa ${$thing};`;

				if ($filter) {
					tqlStr += buildFilter({ $filter: $filter as any, $var: $path, $thing, schema, depth: 0 });
				}

				const sorter = buildSorter({ schema, $thing, $var: $path, $sort, depth: 0 });

				if (sorter) {
					tqlStr += sorter.match;
				}

				tqlStr += `\n?queryPath = "${queryPath}";`;
				tqlStr += '\nfetch';
				tqlStr += '\n?queryPath as "queryPath";';

				if ($fields) {
					const dataFields = $fields.filter((f) => f.$fieldType === 'data');
					if (dataFields && dataFields.length > 0) {
						// @ts-expect-error todo
						processDataFields(dataFields, $path, 0);
					}

					const linkFields = $fields.filter((f) => f.$fieldType === 'link');
					if (linkFields && linkFields.length > 0) {
						// @ts-expect-error todo
						processLinkFields(linkFields, $path, $path, 0);
					}

					const roleFields = $fields.filter((f) => f.$fieldType === 'role');
					if (roleFields && roleFields.length > 0) {
						// @ts-expect-error todo
						processRoleFields(roleFields, $path, $path, 0);
					}
				}

				if (sorter) {
					tqlStr += sorter.sort;
				}

				if (typeof $offset === 'number') {
					tqlStr += `\noffset ${$offset};`;
				}

				if (typeof $limit === 'number') {
					tqlStr += `\nlimit ${$limit};`;
				}
			}
		}
	};

	builder(enrichedBqlQuery);
	// todo: type the tqlRequest
	// @ts-expect-error todo
	req.tqlRequest = isBatched ? tqlStrings : tqlStr;
};

type FilterValue = string | string[] | number | number[] | boolean | boolean[] | Date | Date[] | null;

type Filter = {
	$not?: Record<string, FilterValue>;
} & Record<string, FilterValue>;

const buildFilter = (props: {
	$filter: Filter;
	$var: string;
	$thing: string;
	schema: EnrichedBormSchema;
	depth: number;
}) => {
	const { $filter, $var, $thing, schema, depth } = props;
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
				if (value === null) {
					matches.push(indent(`$${$var} (${player.plays}: ${playerVar});`, depth));
				} else if (Array.isArray(value)) {
					value.forEach((v) => {
						matches.push(
							indent(
								`not { $${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(v)}; $${$var} (${player.plays}: $${playerVar}); };`,
								depth,
							),
						);
					});
				} else {
					matches.push(
						indent(
							`not { $${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(value)}; $${$var} (${player.plays}: $${playerVar}); };`,
							depth,
						),
					);
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
				if (value === null) {
					matches.push(indent(`not { $${$var} (${player.plays}: ${playerVar}); };`, depth));
				} else if (Array.isArray(value)) {
					const alt = value.map(
						(v) =>
							`$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(v)}; $${$var} (${player.plays}: $${playerVar});`,
					);
					const match = joinAlt(alt);
					if (match) {
						matches.push(indent(match, depth));
					}
				} else {
					matches.push(
						indent(
							`$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(value)}; $${$var} (${player.plays}: $${playerVar});`,
							depth,
						),
					);
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

const indent = (line: string, depth: number) => {
	let _indent = '';
	for (let i = 0; i < depth; i++) {
		_indent += '  ';
	}
	return `\n${_indent}${line}`;
};
