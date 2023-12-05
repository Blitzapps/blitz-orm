import type { PipelineOperation } from '../pipeline';

export const newBuildTQLQuery: PipelineOperation = async (req) => {
	const { enrichedBqlQuery } = req;
	if (!enrichedBqlQuery) {
		throw new Error('BQL query not enriched');
	}
	console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));

	let tqlStr = '';

	type ValueBlock = {
		$thing: string;
		$thingType: 'entity' | 'relation' | 'thing' | 'attribute';
		$path?: string;
		$as?: string;
		$fields?: ValueBlock[];
		$filter?: object;
		$fieldType?: 'data' | 'role' | 'link';
	};

	const processFilters = ($filter: object) => {
		for (const key in $filter) {
			// @ts-expect-error todo
			tqlStr += `, has ${key} "${$filter[key]}"`;
		}
		tqlStr += '; \n';
	};

	const processDataFields = (
		dataFields: {
			$path: string;
			$thingType: 'attribute';
			$as: string;
			$fieldType: 'data';
		}[],
		$path: string,
	) => {
		tqlStr += `$${$path} as "${$path}.dataFields": `;
		for (let i = 0; i < dataFields.length; i++) {
			tqlStr += ` ${dataFields[i].$path}`;
			if (i < dataFields.length - 1) {
				tqlStr += ',';
			} else {
				tqlStr += ';\n';
			}
		}
	};

	const processRoleFields = (
		roleFields: {
			$path: string;
			$thingType: 'entity' | 'relation' | 'thing';
			$as: string;
			$fieldType: 'link';
			$target: 'role' | 'relation';
			$fields?: ValueBlock[];
			$thing: string;
			$plays: string;
			$intermediary: string;
		}[],
		$path: string,
		dotPath: string,
	) => {
		for (const roleField of roleFields) {
			const { $fields } = roleField;
			tqlStr += `"${dotPath}.${roleField.$as}":{ \n`;
			tqlStr += '\tmatch \n';
			tqlStr += `\t$${$path} (${roleField.$as}: $${$path}_${roleField.$as}) isa ${roleField.$intermediary}; \n`;

			if ($fields) {
				tqlStr += '\tfetch \n';
			}
			const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
			if (dataFields && dataFields.length > 0) {
				// @ts-expect-error todo
				processDataFields(dataFields, `${$path}_${roleField.$as}`, `${$path}.${roleField.$as}`);
			}

			const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
			if (linkFields && linkFields.length > 0) {
				// @ts-expect-error todo
				processLinkFields(linkFields, `${$path}_${roleField.$as}`, `${$path}.${roleField.$as}`);
			}
			const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
			if (roleFields && roleFields.length > 0) {
				// @ts-expect-error todo
				processRoleFields(roleFields, `${$path}_${roleField.$as}`, `${$path}.${roleField.$as}`);
			}
			tqlStr += '}; \n';
		}
	};

	const processLinkFields = (
		linkFields: {
			$path: string;
			$thingType: 'entity' | 'relation' | 'thing';
			$as: string;
			$fieldType: 'link';
			$target: 'role' | 'relation';
			$fields?: ValueBlock[];
			$intermediary?: string;
			$thing: string;
			$plays: string;
		}[],
		$path: string,
		dotPath: string,
	) => {
		for (const linkField of linkFields) {
			const { $fields } = linkField;
			tqlStr += `"${dotPath}.${linkField.$as}":{ \n`;
			tqlStr += '\tmatch \n';
			// intermediary
			if (linkField.$target === 'role') {
				tqlStr += `\t$${$path}_intermediary (${linkField.$path}: $${$path}, ${linkField.$as}: $${$path}_${linkField.$as}) isa ${linkField.$intermediary}; \n`;
			} else {
				tqlStr += `\t$${$path}_${linkField.$as} (${linkField.$plays}: $${$path}) isa ${linkField.$thing}; \n`;
			}
			if ($fields) {
				tqlStr += '\tfetch \n';
			}
			const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
			if (dataFields && dataFields.length > 0) {
				// @ts-expect-error todo
				processDataFields(dataFields, `${$path}_${linkField.$as}`, `${$path}.${linkField.$as}`);
			}

			const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
			if (linkFields && linkFields.length > 0) {
				// @ts-expect-error todo
				processLinkFields(linkFields, `${$path}_${linkField.$as}`, `${$path}.${linkField.$as}`);
			}

			const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
			if (roleFields && roleFields.length > 0) {
				// @ts-expect-error todo
				processRoleFields(roleFields, `${$path}_${linkField.$as}`, `${$path}.${linkField.$as}`);
			}
			tqlStr += '}; \n';
		}
	};

	const builder = (enrichedBqlQuery: ValueBlock[]) => {
		for (const query of enrichedBqlQuery) {
			const { $path, $thing, $filter, $fields } = query;
			tqlStr += `match \n \t $${$path} isa ${$thing}`;
			if ($filter) {
				processFilters($filter);
			}
			if ($fields) {
				tqlStr += 'fetch \n';
			}
			const dataFields = $fields?.filter((f) => f.$fieldType === 'data');
			if (dataFields && dataFields.length > 0) {
				// @ts-expect-error todo
				processDataFields(dataFields, $path, $path);
			}

			const linkFields = $fields?.filter((f) => f.$fieldType === 'link');
			if (linkFields && linkFields.length > 0) {
				// @ts-expect-error todo
				processLinkFields(linkFields, $path, $path);
			}

			const roleFields = $fields?.filter((f) => f.$fieldType === 'role');
			if (roleFields && roleFields.length > 0) {
				// @ts-expect-error todo
				processRoleFields(roleFields, $path, $path);
			}
		}
	};
	builder(enrichedBqlQuery);
	console.log('=== TQL STRING ===');
	console.log(tqlStr);

	// @ts-expect-error todo
	req.tqlRequest = tqlStr;
};
