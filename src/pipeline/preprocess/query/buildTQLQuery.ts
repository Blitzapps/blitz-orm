import { QueryPath } from '../../../types/symbols';
import type { TypeDbResponse } from '../../pipeline';
import type { PipelineOperation } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

const separator = '___';

export const buildTQLQuery: PipelineOperation<TypeDbResponse> = async (req) => {
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

	const processFilters = ($filter: object, $var: string) => {
		let simpleHas = '';
		let orHas = '';

		for (const key in $filter) {
			// @ts-expect-error todo
			const filterKey = $filter[key];
			if (Array.isArray(filterKey)) {
				for (let i = 0; i < filterKey.length; i++) {
					orHas += `{$${$var} has ${key} "${filterKey[i]}";}`;
					if (i < filterKey.length - 1) {
						orHas += 'or';
					} else {
						orHas += ';';
					}
				}
			} else {
				simpleHas += `, has ${key} "${filterKey}"`;
			}
		}
		simpleHas += '; \n';
		tqlStr += simpleHas;
		tqlStr += orHas;
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
				tqlStr += ` $${$path}${separator}${roleField.$var} isa ${roleField.$thing}`;
				processFilters(roleField.$filter, `${$path}${separator}${roleField.$var}`);
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
				tqlStr += ` $${$path}${separator}${linkField.$var} isa ${linkField.$thing}`;
				processFilters(linkField.$filter, `${$path}${separator}${linkField.$var}`);
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
				tqlStr += `match \n \t $${$path} isa ${$thing} `;
				if ($filter) {
					processFilters($filter, $path);
				} else {
					tqlStr += '; ';
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

				tqlStr += `match \n \t $${$path} isa ${$thing} `;
				if ($filter) {
					processFilters($filter, $path);
				} else {
					tqlStr += '; ';
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
