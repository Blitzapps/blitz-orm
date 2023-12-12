import { getCurrentSchema } from '../../helpers';
import type { EnrichedBormEntity, EnrichedBormRelation } from '../../types';
import type { PipelineOperation } from '../pipeline';

const parseMetaData = (str: string) => {
	const asRegex = /as:([a-zA-Z0-9_\-·]+)/;
	const justIdRegex = /justId:([a-zA-Z0-9_\-·]+)/;
	const idNotIncludedRegex = /idNotIncluded:([a-zA-Z0-9_\-·]+)/;
	const filterByUniqueRegex = /filterByUnique:([a-zA-Z0-9_\-·]+)/;

	const asMatch = str.match(asRegex);
	const justIdMatch = str.match(justIdRegex);
	const idNotIncludedMatch = str.match(idNotIncludedRegex);
	const filterByUniqueMatch = str.match(filterByUniqueRegex);

	return {
		as: asMatch ? asMatch[1] : null,
		justId: justIdMatch ? justIdMatch[1] : null,
		idNotIncluded: idNotIncludedMatch ? idNotIncludedMatch[1] : null,
		filterByUnique: filterByUniqueMatch ? filterByUniqueMatch[1] : null,
	};
};
const parseArrayMetadata = (str: string) => {
	try {
		const convertToJson = (str: string) => {
			// Remove $metadata: from the string
			let jsonString = str.replace('$metadata:', '');

			// Enclose keys and values in quotes
			jsonString = jsonString.replace(/([a-zA-Z0-9_\-·]+):/g, '"$1":');
			jsonString = jsonString.replace(/:([a-zA-Z0-9_\-·]+)/g, ':"$1"');

			return jsonString;
		};
		const converted = convertToJson(str);
		return JSON.parse(converted);
	} catch (e) {
		return { as: {} };
	}
};

export const parseTQLQuery: PipelineOperation = async (req, res) => {
	const { enrichedBqlQuery, rawBqlRequest, schema, config } = req;
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
				const field = currentSchema.dataFields?.filter((field: any) => field.path === key || field.dbPath === key);
				// todo: more idFields other than id
				const isIdField = key === 'id';
				const $asKey = Array.isArray($as) ? $as.find((o: any) => o[key])?.[key] : key;
				if (field?.[0]?.cardinality === 'ONE') {
					if (dataFields[key][0]) {
						// @ts-expect-error todo
						dataFieldsRes[$asKey] = dataFields[key][0].value;
						if (isIdField && !config.query?.noMetadata) {
							// @ts-expect-error todo
							dataFieldsRes.$id = dataFields[key][0].value;
						}
					}
				} else if (field?.[0]?.cardinality === 'MANY') {
					const fields = dataFields[key].map((o: { value: string }) => o.value);
					// @ts-expect-error todo
					dataFieldsRes[$asKey] = fields;
				}
			}
		}
		return dataFieldsRes;
	};

	const parseRoleFields = (
		roleFields: { $roleFields: object[]; $key: string; $metaData: string; $cardinality: 'MANY' | 'ONE' }[],
	) => {
		const linkFieldsRes: object = {};
		// each linkField
		for (const roleField of roleFields) {
			const { $roleFields, $metaData, $cardinality } = roleField;
			const items = [];
			const { as, justId, idNotIncluded, filterByUnique } = parseMetaData($metaData);
			// each item of specific linkField
			for (const item of $roleFields) {
				const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(item);
				const parsedDataFields = parseDataFields(dataFields, currentSchema);

				if (justId === 'T') {
					const idObj = { ...parsedDataFields };
					// @ts-expect-error todo
					items.push(idObj.id);
				} else {
					// @ts-expect-error todo
					const parsedLinkFields = parseLinkFields(linkFields);
					const parsedRoleFields = parseRoleFields(roleFields);
					const resDataFields = parsedDataFields;
					if (idNotIncluded === 'true') {
						// @ts-expect-error todo
						for (const field of currentSchema.idFields) {
							// @ts-expect-error todo
							delete resDataFields[field];
						}
					}
					items.push({
						...resDataFields,
						...parsedLinkFields,
						...parsedRoleFields,
						...(!config.query?.noMetadata && { ...schemaValue }),
					});
				}
			}
			if (items.length > 0) {
				// @ts-expect-error todo
				linkFieldsRes[as] = $cardinality === 'MANY' && filterByUnique === 'false' ? items : items[0];
			}
		}
		return linkFieldsRes;
	};

	const parseLinkFields = (
		linkFields: { $linkFields: object[]; $key: string; $metaData: string; $cardinality: 'MANY' | 'ONE' }[],
	) => {
		const linkFieldsRes: object = {};
		// each linkField
		for (const linkField of linkFields) {
			const { $linkFields, $metaData, $cardinality } = linkField;
			const { as, justId, idNotIncluded, filterByUnique } = parseMetaData($metaData);

			const items = [];
			// each item of specific linkField
			for (const item of $linkFields) {
				const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(item);
				const parsedDataFields = parseDataFields(dataFields, currentSchema);
				if (justId === 'T') {
					const idObj = { ...parsedDataFields };
					// @ts-expect-error todo
					items.push(idObj.id);
				} else {
					// @ts-expect-error todo
					const parsedLinkFields = parseLinkFields(linkFields);
					const parsedRoleFields = parseRoleFields(roleFields);
					const resDataFields = parsedDataFields;
					if (idNotIncluded === 'true') {
						// @ts-expect-error todo
						for (const field of currentSchema.idFields) {
							// @ts-expect-error todo
							delete resDataFields[field];
						}
					}
					items.push({
						...resDataFields,
						...parsedLinkFields,
						...parsedRoleFields,
						...(!config.query?.noMetadata && { ...schemaValue }),
					});
				}
			}
			if (items.length > 0) {
				// @ts-expect-error todo
				linkFieldsRes[as] = $cardinality === 'MANY' && filterByUnique === 'false' ? items : items[0];
			}
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
		console.log('obj', JSON.stringify(obj, null, 2));
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
				if (foundLinkField) {
					linkFields.push({
						$linkFields: obj[key],
						$key: identifier,
						$metaData,
						$cardinality: foundLinkField.cardinality,
					});
				}
				if (foundRoleField) {
					roleFields.push({
						$roleFields: obj[key],
						$key: identifier,
						$metaData,
						$cardinality: foundRoleField.cardinality,
					});
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
			// @ts-expect-error todo
			const parsedLinkFields = parseLinkFields(linkFields);
			const parsedRoleFields = parseRoleFields(roleFields);
			const resDataFields = parsedDataFields;

			let finalObj = {
				...parsedLinkFields,
				...parsedRoleFields,
				...(!config.query?.noMetadata && { ...schemaValue }),
				...(!config.query?.noMetadata &&
					rawBqlRequest.$id && {
						// todo: use dynamic idField, not "id"
						// @ts-expect-error todo
						...{ $id: Array.isArray(rawBqlRequest.$id) ? resDataFields['id'] : rawBqlRequest.$id },
					}),
			};
			const idNotIncluded =
				rawBqlRequest?.$fields?.filter(
					(field: any) => currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
				).length === 0;
			if (idNotIncluded) {
				// @ts-expect-error todo
				for (const field of currentSchema.idFields) {
					// @ts-expect-error todo
					delete resDataFields[field];
				}
			}
			finalObj = { ...finalObj, ...resDataFields };
			res.push(finalObj);
		});
		return res;
	};

	const parsedTqlRes = parser(rawTqlRes as object[]);
	console.log('parsedTqlRes', JSON.stringify(parsedTqlRes, null, 2));
	// console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));
	const response =
		(rawBqlRequest.$id && !Array.isArray(rawBqlRequest.$id)) || enrichedBqlQuery[0].$filterByUnique
			? parsedTqlRes?.[0]
			: parsedTqlRes;
	res.bqlRes = Array.isArray(response) ? (response.length === 0 ? null : response) : response ? response : null;
};
