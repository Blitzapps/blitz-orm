import { compute } from '../../engine/compute';
import { getCurrentSchema } from '../../helpers';
import type { EnrichedBormEntity, EnrichedBormRelation } from '../../types';
import type { PipelineOperation } from '../pipeline';

//todo: add this metadata as a typedb "?" var instead
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

			// Enclose keys in quotes
			jsonString = jsonString.replace(/([a-zA-Z0-9_\-·]+)(?=:)/g, '"$1"');

			// Enclose values in quotes, handling nested object values separately
			jsonString = jsonString.replace(/:(\s*)([a-zA-Z0-9_\-·]+)/g, (match, p1, p2) => {
				// Check if the value is part of an object
				if (/^{.*}$/.test(p2)) {
					return `:${p2}`;
				} else {
					return `:${p1}"${p2}"`;
				}
			});

			// Convert array elements (non-object) to strings
			jsonString = jsonString.replace(/\[([^\]]+)\]/g, (match, p1) => {
				return `[${p1
					.split(',')
					.map((s: string) => {
						// Check if element is an object-like structure
						if (s.trim().startsWith('{') && s.trim().endsWith('}')) {
							return s.trim();
						} else {
							return `"${s.trim()}"`;
						}
					})
					.join(',')}]`;
			});

			return jsonString;
		};
		const converted = convertToJson(str);

		const parsed = JSON.parse(converted);
		return parsed;
	} catch (e) {
		console.error(e);
		return { as: [], virtual: [] };
	}
};

export const parseTQLQuery: PipelineOperation = async (req, res) => {
	const { enrichedBqlQuery, rawBqlRequest, schema, config } = req;
	const { rawTqlRes, isBatched } = res;
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not enriched');
	} else if (!rawTqlRes) {
		throw new Error('TQL query not executed');
	}
	// console.log('parse.rawTqlRes', JSON.stringify(rawTqlRes, null, 2));
	// console.log('rawBqlRequest', JSON.stringify(rawBqlRequest, null, 2));

	const parseDataFields = (dataFields: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
		const dataFieldsRes: object = {};
		const { $metaData } = dataFields;

		const { as: $as, virtual } = parseArrayMetadata($metaData);

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
					} else if (config.query?.returnNulls) {
						// @ts-expect-error todo
						dataFieldsRes[$asKey] = null;
					}
				} else if (field?.[0]?.cardinality === 'MANY') {
					const fields = dataFields[key].map((o: { value: string }) => o.value);
					// @ts-expect-error todo
					dataFieldsRes[$asKey] = fields;
				}
			}
		}
		for (const key of virtual) {
			const $asKey = $as.find((o: any) => o[key])?.[key];
			const field = currentSchema.dataFields?.find((field: any) => field.isVirtual && field.dbPath === key);
			// @ts-expect-error todo
			const computedValue = compute({ currentThing: dataFieldsRes, fieldSchema: field });

			// @ts-expect-error todo
			dataFieldsRes[$asKey] = computedValue;
		}
		return dataFieldsRes;
	};

	const parseRoleFields = (
		roleFields: { $roleFields: object[]; $key: string; $metaData: string; $cardinality: 'MANY' | 'ONE' }[],
	) => {
		const roleFieldsRes: object = {};
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
				roleFieldsRes[as] = $cardinality === 'MANY' && filterByUnique === 'false' ? items : items[0];
			} else if (config.query?.returnNulls) {
				// @ts-expect-error todo
				roleFieldsRes[as] = null;
			}
		}
		return roleFieldsRes;
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
			} else if (config.query?.returnNulls) {
				// @ts-expect-error todo
				linkFieldsRes[as] = null;
			}
		}
		return linkFieldsRes;
	};

	const parseFields = (obj: any) => {
		let dataFields;

		for (const key in obj) {
			let $metaData;
			if (key.endsWith('.$dataFields')) {
				dataFields = obj[key];
				const _keys = key.split('.');
				$metaData = _keys[_keys.length - 2];
			}
			if ($metaData) {
				dataFields.$metaData = $metaData;
			}
		}
		if (dataFields.length === 0) {
			throw new Error('No datafields');
		}
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
			if (!key.endsWith('.$dataFields')) {
				const _keys = key.split('.');
				const identifier = _keys[_keys.length - 1];
				const $metaData = _keys[_keys.length - 2];
				const foundLinkField = currentSchema.linkFields?.find(
					(o) => o.path === identifier && identifier !== '$dataFields',
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

	const realParse = (tqlRes: object[]) => {
		const res: any = [];
		tqlRes.forEach((resItem) => {
			const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(resItem);
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

	const parser = (tqlRes: any) => {
		if (isBatched) {
			const finalRes: any[] = [];
			tqlRes.forEach((resItems: object[]) => {
				const parsedItems = realParse(resItems);
				const response =
					(rawBqlRequest.$id && !Array.isArray(rawBqlRequest.$id)) || enrichedBqlQuery[0].$filterByUnique
						? parsedItems?.[0]
						: parsedItems;
				finalRes.push(Array.isArray(response) ? (response.length === 0 ? null : response) : response ? response : null);
			});
			return finalRes;
		} else {
			const parsedItems = realParse(tqlRes);
			const response =
				(rawBqlRequest.$id && !Array.isArray(rawBqlRequest.$id)) || enrichedBqlQuery[0].$filterByUnique
					? parsedItems?.[0]
					: parsedItems;
			return Array.isArray(response) ? (response.length === 0 ? null : response) : response ? response : null;
		}
	};

	const parsedTqlRes = parser(rawTqlRes);
	// console.log('parsedTqlRes', JSON.stringify(parsedTqlRes, null, 2));
	res.bqlRes = parsedTqlRes;
	// console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));
};
