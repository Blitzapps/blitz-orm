import { getThing } from '../../../helpers';
import { EnrichedBormSchema } from '../../../types';
import { QueryPath } from '../../../types/symbols';
import type { PipelineOperation } from '../../pipeline';
import { v4 as uuidv4 } from 'uuid';

const separator = '___';

type FilterValue = string | string[] | number | number[] | boolean | boolean[] | Date | Date[] | null;

type Filter = {
  $not?: Record<string, FilterValue>;
} & Record<string, FilterValue>;

const buildFilter = ($filter: Filter, $var: string, $thing: string, schema: EnrichedBormSchema) => {
  const { $not, ...rest } = $filter;

  const thing = getThing(schema, $thing);
  const matches: string[] = [];

  Object.entries($not || {}).forEach(([key, value]) => {
    const df = thing.dataFields?.find((df) => df.dbPath === key);
    if (df) {
      if (value === null) {
        matches.push(`$${$var} has ${key} $${key}_${uuidv4()};`);
      } else if (Array.isArray(value)) {
        value.forEach((v) => {
          matches.push(`not { $${$var} has ${key} ${serializeValue(v)}; };`);
        });
      } else {
        matches.push(`not { $${$var} has ${key} ${serializeValue(value)}; };`);
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
          matches.push(`(${lf.plays}: $${$var}) isa ${lf.relation};`);
        } else if (Array.isArray(value)) {
          value.forEach((v) => {
            matches.push(`not { (${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(v)}; };`);
          });
        } else {
          matches.push(`not { (${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(value)}; };`);
        }
      } else {
        const oppVar = `${opposite.thing}_${uuidv4()}`;
        if (value === null) {
          matches.push(`$${oppVar} isa ${opposite.thing}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`);
        } else if (Array.isArray(value)) {
          value.forEach((v) => {
            matches.push(`not { $${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(v)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`);
          });
        } else {
          matches.push(`not { $${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(value)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`);
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
          matches.push(`$${$var} (${player.plays}: ${playerVar});`);
        } else if (Array.isArray(value)) {
          value.forEach((v) => {
            matches.push(`not { $${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(v)}; $${$var} (${player.plays}: $${playerVar}); };`);
          });
        } else {
          matches.push(`not { $${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(value)}; $${$var} (${player.plays}: $${playerVar}); };`);
        }
        return;
      }
    }
  });

  Object.entries(rest).forEach(([key, value]) => {
    const df = thing.dataFields?.find((df) => df.dbPath === key);
    if (df) {
      if (value === null) {
        matches.push(`not { $${$var} has ${key} $${key}_${uuidv4()}; };`);
      } else if (Array.isArray(value)) {
        const alt = value.map((v) => `$${$var} has ${key} ${serializeValue(v)};`);
        const match = joinAlt(alt);
        if (match) {
          matches.push(match);
        }
      } else {
        matches.push(`$${$var} has ${key} ${serializeValue(value)};`);
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
          matches.push(`not { (${lf.plays}: $${$var}) isa ${lf.relation}; };`);
        } else if (Array.isArray(value)) {
          const alt = value.map((v) => `(${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(v)};`);
          const match = joinAlt(alt);
          if (match) {
            matches.push(match);
          }
        } else {
          matches.push(`(${lf.plays}: $${$var}) isa ${lf.relation}, has ${oppositeIdField} ${serializeValue(value)};`);
        }
      } else {
        const oppVar = `${opposite.thing}_${uuidv4()}`;
        if (value === null) {
          matches.push(`not { $${oppVar} isa ${opposite.thing}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation}; };`);
        } else if (Array.isArray(value)) {
          const alt = value.map((v) => `$${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(v)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`);
          const match = joinAlt(alt);
          if (match) {
            matches.push(match);
          }
        } else {
          matches.push(`$${oppVar} isa ${opposite.thing}, has ${oppositeIdField} ${serializeValue(value)}; (${lf.plays}: $${$var}, ${opposite.plays}: $${oppVar}) isa ${lf.relation};`);
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
          matches.push(`not { $${$var} (${player.plays}: ${playerVar}); };`);
        } else if (Array.isArray(value)) {
          const alt = value.map((v) => `$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(v)}; $${$var} (${player.plays}: $${playerVar});`);
          const match = joinAlt(alt);
          if (match) {
            matches.push(match);
          }
        } else {
          matches.push(`$${playerVar} isa ${player.thing}, has ${playerIdField} ${serializeValue(value)}; $${$var} (${player.plays}: $${playerVar});`);
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

export const buildTQLQuery: PipelineOperation = async (req) => {
	const { enrichedBqlQuery } = req;
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
	) => {
		const postStrParts = [];
		const asMetaDataParts = [];

		let $asMetaData = '';

		for (let i = 0; i < dataFields.length; i++) {
			if (!dataFields[i].$isVirtual) {
				postStrParts.push(` ${dataFields[i].$dbPath}`);
			}
			asMetaDataParts.push(`{${dataFields[i].$dbPath}:${dataFields[i].$as}}`);
		}

		const postStr = `${postStrParts.join(',')};\n`;
		$asMetaData = asMetaDataParts.join(',');

		const $metaData = `$metadata:{as:[${$asMetaData}]}`;

		tqlStr += `$${$path} as "${$path}.${$metaData}.$dataFields": `;

		tqlStr += postStr;
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
			[QueryPath]: string;
		}[],
		$path: string,
		dotPath: string,
	) => {
		for (const roleField of roleFields) {
			const { $fields, $as, $justId, $idNotIncluded, $filterByUnique } = roleField;
			const queryPath = roleField[QueryPath];

			const $metaData = `$metadata:{as:${$as},justId:${
				$justId ? 'T' : 'F'
			},idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
			tqlStr += `"${dotPath}.${$metaData}.${roleField.$var}":{ \n`;
			tqlStr += '\tmatch \n';
			if (roleField.$filter) {
				tqlStr += ` $${$path}${separator}${roleField.$var} isa ${roleField.$thing};`;
				// processFilters(roleField.$filter, `${$path}${separator}${roleField.$var}`);
        const $var = `${$path}${separator}${roleField.$var}`;
        tqlStr += `\n${buildFilter(roleField.$filter as any, $var, roleField.$thing, req.schema)}`;
			}
			tqlStr += `\t$${$path} (${roleField.$var}: $${$path}${separator}${roleField.$var}) isa ${roleField.$intermediary}; \n`;

			if ($fields) {
				const randomId = `M_${uuidv4()}`;
				tqlStr += `?queryPath${randomId} = "${queryPath}";\n`; ///rawPaths => to inject metadata in the response, in this case only the path
				tqlStr += '\tfetch \n';
				tqlStr += `?queryPath${randomId} as "queryPath" \n;`; ///rawPaths => to recover metadata in the response

				const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
				if (dataFields && dataFields.length > 0) {
					// @ts-expect-error todo
					processDataFields(dataFields, `${$path}${separator}${roleField.$var}`, `${$path}.${roleField.$var}`);
				}

				const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
				if (linkFields && linkFields.length > 0) {
					// @ts-expect-error todo
					processLinkFields(linkFields, `${$path}${separator}${roleField.$var}`, `${$path}.${roleField.$var}`);
				}
				const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
				if (roleFields && roleFields.length > 0) {
					// @ts-expect-error todo
					processRoleFields(roleFields, `${$path}${separator}${roleField.$var}`, `${$path}.${roleField.$var}`);
				}
			}
			tqlStr += '}; \n';
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
			[QueryPath]: string;
		}[],
		$path: string,
		dotPath: string,
	) => {
		for (const linkField of linkFields) {
			const { $fields, $as, $justId, $idNotIncluded, $filterByUnique, $playedBy } = linkField;
			const queryPath = linkField[QueryPath];
			const $metaData = `$metadata:{as:${$as},justId:${
				$justId ? 'T' : 'F'
			},idNotIncluded:${$idNotIncluded},filterByUnique:${$filterByUnique}}`;
			tqlStr += `"${dotPath}.${$metaData}.${linkField.$var}":{ \n`;
			tqlStr += '\tmatch \n';
			if (linkField.$filter) {
				tqlStr += ` $${$path}${separator}${linkField.$var} isa ${linkField.$thing};`;
				// processFilters(linkField.$filter, `${$path}${separator}${linkField.$var}`);
        const $var = `${$path}${separator}${linkField.$var}`;
        tqlStr += `\n${buildFilter(linkField.$filter as any, $var, linkField.$thing, req.schema)}`;
			}
			// a. intermediary
			if (linkField.$target === 'role') {
				tqlStr += `\t$${$path}_intermediary (${linkField.$plays}: $${$path}, ${$playedBy.plays}: $${$path}${separator}${linkField.$var}) isa ${linkField.$intermediary}; \n`;
			} else {
				// b. no intermediary
				tqlStr += `\t$${$path}${separator}${linkField.$var} (${linkField.$plays}: $${$path}) isa ${linkField.$thing}; \n`;
			}

			if ($fields) {
				const randomId = `M_${uuidv4()}`;
				tqlStr += `?queryPath${randomId} = "${queryPath}";\n`; ///queryPath => to inject metadata in the response, in this case only the path
				tqlStr += '\tfetch \n';
				tqlStr += `?queryPath${randomId} as "queryPath" \n;`; ///queryPath => to recover metadata in the response

				const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
				if (dataFields && dataFields.length > 0) {
					// @ts-expect-error todo
					processDataFields(dataFields, `${$path}${separator}${linkField.$var}`);
				}

				const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
				if (linkFields && linkFields.length > 0) {
					// @ts-expect-error todo
					processLinkFields(linkFields, `${$path}${separator}${linkField.$var}`, `${$path}.${linkField.$var}`);
				}

				const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
				if (roleFields && roleFields.length > 0) {
					// @ts-expect-error todo
					processRoleFields(roleFields, `${$path}${separator}${linkField.$var}`, `${$path}.${linkField.$var}`);
				}
			}
			tqlStr += '}; \n';
		}
	};
	const isBatched = enrichedBqlQuery.length > 1;
	const tqlStrings: string[] = [];

	const builder = (enrichedBqlQuery: ValueBlock[]) => {
		// Batched
		if (isBatched) {
			for (const query of enrichedBqlQuery) {
				const { $path, $thing, $filter, $fields } = query;
				if (!$path) {
					throw new Error('Path is not defined');
				}
				const queryPath = query[QueryPath];
				tqlStr += `match \n \t $${$path} isa ${$thing};`;
				if ($filter) {
					// processFilters($filter, $path);
          tqlStr += `\n${buildFilter($filter as any, $path, $thing, req.schema)}`;
				// } else {
				// 	tqlStr += '; ';
				}

				const randomId = `M_${uuidv4()}`;

				tqlStr += `?queryPath${randomId} = "${queryPath}";\n`;
				tqlStr += 'fetch \n';
				tqlStr += `?queryPath${randomId} as "queryPath" \n;`;

				if ($fields) {
					const dataFields = $fields.filter((f) => f.$fieldType === 'data');
					if (dataFields && dataFields.length > 0) {
						// @ts-expect-error todo
						processDataFields(dataFields, $path);
					}

					const linkFields = $fields.filter((f) => f.$fieldType === 'link');
					if (linkFields && linkFields.length > 0) {
						// @ts-expect-error todo
						processLinkFields(linkFields, $path, $path);
					}

					const roleFields = $fields.filter((f) => f.$fieldType === 'role');
					if (roleFields && roleFields.length > 0) {
						// @ts-expect-error todo
						processRoleFields(roleFields, $path, $path);
					}
				}
				tqlStrings.push(tqlStr);
				tqlStr = '';
			}
		} else {
			for (const query of enrichedBqlQuery) {
				const { $path, $thing, $filter, $fields } = query;
				if (!$path || $path === 'undefined') {
					throw new Error('Path is not defined');
				}
				const queryPath = query[QueryPath];

				tqlStr += `match \n \t $${$path} isa ${$thing};`;
				if ($filter) {
					// processFilters($filter, $path);
          tqlStr += `\n${buildFilter($filter as any, $path, $thing, req.schema)}`;
				// } else {
				// 	tqlStr += '; ';
				}

				tqlStr += `?queryPath = "${queryPath}";\n`;
				tqlStr += 'fetch \n';
				tqlStr += '?queryPath as "queryPath" \n;';

				if ($fields) {
					const dataFields = $fields.filter((f) => f.$fieldType === 'data');
					if (dataFields && dataFields.length > 0) {
						// @ts-expect-error todo
						processDataFields(dataFields, $path);
					}

					const linkFields = $fields.filter((f) => f.$fieldType === 'link');
					if (linkFields && linkFields.length > 0) {
						// @ts-expect-error todo
						processLinkFields(linkFields, $path, $path);
					}

					const roleFields = $fields.filter((f) => f.$fieldType === 'role');
					if (roleFields && roleFields.length > 0) {
						// @ts-expect-error todo
						processRoleFields(roleFields, $path, $path);
					}
				}
			}
		}
	};

	builder(enrichedBqlQuery);
	//console.log('tqlStr', tqlStr);
	//console.log('tqlStrings', tqlStrings);
	// todo: type the tqlRequest
	// @ts-expect-error todo
	req.tqlRequest = isBatched ? tqlStrings : tqlStr;
};
