import { getCurrentSchema } from '../../helpers';
import type { EnrichedBormEntity, EnrichedBormRelation } from '../../types';
import type { PipelineOperation } from '../pipeline';

// type TQLRoot = 'attribute' | 'entity' | 'relation';

// type TQLDataFieldRes =
// 	| {
// 			[key: string]: {
// 				type: {
// 					label: string;
// 					root: TQLRoot;
// 				};
// 				value: string;
// 				value_type: 'string';
// 			}[];
// 	  }
// 	| {
// 			type: {
// 				label: string;
// 				root: TQLRoot;
// 			};
// 	  };
const parseMetaData = (str: string) => {
	const asRegex = /as:([a-zA-Z0-9_]+)/;
	const justIdRegex = /justId:([a-zA-Z0-9_]+)/;

	const asMatch = str.match(asRegex);
	const justIdMatch = str.match(justIdRegex);

	return {
		as: asMatch ? asMatch[1] : null,
		justId: justIdMatch ? justIdMatch[1] : null,
	};
};
const parseArrayMetadata = (str: string) => {
	try {
		const convertToJson = (str: string) => {
			// Remove $metadata: from the string
			let jsonString = str.replace('$metadata:', '');

			// Enclose keys and values in quotes
			jsonString = jsonString.replace(/([-\w]+):/g, '"$1":');
			jsonString = jsonString.replace(/:([-\w]+)/g, ':"$1"');

			return jsonString;
		};
		const converted = convertToJson(str);
		return JSON.parse(converted);
	} catch (e) {
		return { as: {} };
	}
};

export const parseTQLQuery: PipelineOperation = async (req, res) => {
	const { enrichedBqlQuery, rawBqlRequest, schema } = req;
	const { rawTqlRes } = res;
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not enriched');
	} else if (!rawTqlRes) {
		throw new Error('TQL query not executed');
	}
	console.log('rawTqlRes', JSON.stringify(rawTqlRes, null, 2));
	// console.log('rawBqlRequest', JSON.stringify(rawBqlRequest, null, 2));

	const parseDataFields = (dataFields: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
		const dataFieldsRes: object = {};
		const { $metaData } = dataFields;

		const { as: $as } = parseArrayMetadata($metaData);

		for (const key in dataFields) {
			if (key !== 'type' && !key.includes('$')) {
				const field = currentSchema.dataFields?.filter((field: any) => field.path === key);
				const $asKey = Array.isArray($as) ? $as.find((o: any) => o[key])?.[key] : key;

				if (field?.[0].cardinality === 'ONE') {
					// @ts-expect-error todo
					dataFieldsRes[$asKey] = dataFields[key][0].value;
				} else if (field?.[0].cardinality === 'MANY') {
					const fields = dataFields[key].map((o: { value: string }) => o.value);
					// @ts-expect-error todo
					dataFieldsRes[$asKey] = fields;
				}
			}
		}
		return dataFieldsRes;
	};
	const parseRoleFields = (roleFields: { $roleFields: object[]; $key: string }[]) => {
		const linkFieldsRes: object = {};
		// each linkField
		for (const roleField of roleFields) {
			const { $roleFields, $key } = roleField;
			const items = [];
			// each item of specific linkField
			for (const item of $roleFields) {
				const { dataFields, currentSchema, linkFields, roleFields } = parseFields(item);

				const parsedDataFields = parseDataFields(dataFields, currentSchema);
				const parsedLinkFields = parseLinkFields(linkFields);
				const parsedRoleFields = parseRoleFields(roleFields);
				items.push({ ...parsedDataFields, ...parsedLinkFields, ...parsedRoleFields });
			}
			// @ts-expect-error todo
			linkFieldsRes[$key] = items;
		}
		return linkFieldsRes;
	};

	const parseLinkFields = (linkFields: { $linkFields: object[]; $key: string; $metaData: string }[]) => {
		const linkFieldsRes: object = {};
		// each linkField
		for (const linkField of linkFields) {
			const { $linkFields, $metaData } = linkField;
			const { as, justId } = parseMetaData($metaData);

			const items = [];
			// each item of specific linkField
			for (const item of $linkFields) {
				const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(item);
				if (justId === 'T') {
					const parsedDataFields = parseDataFields(dataFields, currentSchema);
					const idObj = { ...parsedDataFields };
					// @ts-expect-error todo
					items.push(idObj.id);
				} else {
					const parsedDataFields = parseDataFields(dataFields, currentSchema);
					const parsedLinkFields = parseLinkFields(linkFields);
					const parsedRoleFields = parseRoleFields(roleFields);
					items.push({ ...parsedDataFields, ...parsedLinkFields, ...parsedRoleFields, ...schemaValue });
				}
			}
			// @ts-expect-error todo
			linkFieldsRes[as] = items;
		}
		return linkFieldsRes;
	};
	const parseFields = (obj: any) => {
		let dataFields: object = {};

		for (const key in obj) {
			let $metaData;
			if (key.endsWith('.dataFields')) {
				dataFields = obj[key];
				const _keys = key.split('.');
				$metaData = _keys[_keys.length - 2];
			}
			// const identifier = _keys[_keys.length - 1];

			if ($metaData) {
				// @ts-expect-error todo
				dataFields.$metaData = $metaData;
			}
		}
		// @ts-expect-error todo
		const dataFieldsThing = dataFields.type;
		const schemaValue: { $thing: string; $thingType: string } = {
			$thing: dataFieldsThing.label,
			$thingType: dataFieldsThing.root,
		};
		const node = { [`$${schemaValue.$thingType}`]: schemaValue.$thing };
		const currentSchema = getCurrentSchema(schema, node);

		const linkFields = [];
		const roleFields = [];
		for (const key in obj) {
			if (!key.endsWith('.dataFields')) {
				const _keys = key.split('.');
				const identifier = _keys[_keys.length - 1];
				const $metaData = _keys[_keys.length - 2];

				const foundLinkField = currentSchema.linkFields?.find(
					(o) => o.path === identifier && identifier !== 'dataFields',
				);
				// @ts-expect-error todo
				const foundRoleField = currentSchema.roles?.[identifier];
				// todo: make identifier the same as $as in enriched bql
				if (foundLinkField) {
					linkFields.push({ $linkFields: obj[key], $key: identifier, $metaData });
				}
				if (foundRoleField) {
					roleFields.push({ $roleFields: obj[key], $key: identifier, $metaData });
				}
			}
		}

		return { dataFields, schemaValue, currentSchema, linkFields, roleFields };
	};
	const parser = (tqlRes: object[]) => {
		const res: any = [];
		tqlRes.forEach((resObj) => {
			const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(resObj);
			const parsedDataFields = parseDataFields(dataFields, currentSchema);

			const parsedLinkFields = parseLinkFields(linkFields);
			const parsedRoleFields = parseRoleFields(roleFields);

			res.push({ ...parsedDataFields, ...parsedLinkFields, ...parsedRoleFields, ...schemaValue });
		});
		return res;
	};

	const parsedTqlRes = parser(rawTqlRes as object[]);

	console.log('parsedTqlRes', JSON.stringify(parsedTqlRes, null, 2));
	// console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));

	res.bqlRes = parsedTqlRes;
};
