import { isArray } from 'radash';
import { assertDefined, getCurrentSchema } from '../../../helpers';
import type {
	BormConfig,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedBQLQuery,
	RawBQLQuery,
} from '../../../types';
import { QueryPath } from '../../../types/symbols';

type TypeDbResponse = Record<string, any>; //TODO

export const parseTQLQuery = async (props: {
	rawBqlRequest: RawBQLQuery[];
	enrichedBqlQuery: EnrichedBQLQuery[];
	schema: EnrichedBormSchema;
	config: BormConfig;
	rawTqlRes: Record<string, any>[][];
}): Promise<TypeDbResponse[]> => {
	const { enrichedBqlQuery, rawBqlRequest, schema, config, rawTqlRes } = props;

	if (!enrichedBqlQuery) {
		throw new Error('BQL request not enriched');
	} else if (!rawTqlRes) {
		throw new Error('TQL query not executed');
	}

	return rawTqlRes.map((res, i) => {
		const rawBql = rawBqlRequest[i];
		const query = enrichedBqlQuery[i];
		const parsed = realParse(res, rawBql, query, schema, config);
		return parsed;
	});
};

const realParse = (
	res: any[],
	rawBqlRequest: RawBQLQuery,
	enrichedBqlQuery: EnrichedBQLQuery,
	schema: EnrichedBormSchema,
	config: BormConfig,
) => {
	if (res.length === 0) {
		// This is a little inconsistent.  In the prop if the result is empty
		// we return null or undefined based on the config, but the test
		// expect the top level result to always return null.
		// always return
		// return config.query?.returnNulls ? null : undefined;
		return null;
	}
	if (enrichedBqlQuery.$filterByUnique) {
		return parseObj(res[0], rawBqlRequest, schema, config);
	}
	return res.map((item) => parseObj(item, rawBqlRequest, schema, config));
};

const parseObj = (res: any, rawBqlRequest: RawBQLQuery, schema: EnrichedBormSchema, config: BormConfig) => {
	const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(res, schema);

	const parsedDataFields = parseDataFields(dataFields, currentSchema, config);
	const parsedLinkFields = parseLinkFields(linkFields, schema, config);
	const parsedRoleFields = parseRoleFields(roleFields, schema, config);
	const idNotIncluded = rawBqlRequest?.$fields?.every(
		(field) => !currentSchema?.idFields?.includes(typeof field === 'string' ? field : field.$path),
	);

	const finalObj = {
		...parsedLinkFields,
		...parsedRoleFields,
		...schemaValue,
		...(!config.query?.noMetadata && rawBqlRequest.$id
			? // TODO: This line is wrong: the id field may not be "id"; $id may be an array of string;
				{ $id: Array.isArray(rawBqlRequest.$id) ? parsedDataFields['id'] : rawBqlRequest.$id }
			: {}),
		...(idNotIncluded
			? Object.fromEntries(Object.entries(parsedDataFields).filter(([key]) => !currentSchema?.idFields?.includes(key)))
			: parsedDataFields),
	};

	return finalObj;
};

const parseFields = (obj: any, schema: EnrichedBormSchema) => {
	const keys = Object.keys(obj);
	// Find and process $dataFields
	const dataFieldsKey = keys.find((key) => key.endsWith('.$dataFields'));
	const multiValKeys = keys.filter((key) => key.endsWith('.$multiVal'));
	if (!dataFieldsKey) {
		throw new Error('No dataFields');
	}

	//if there are multiValKeys, we replace it in the Object
	if (multiValKeys?.length > 0) {
		multiValKeys.forEach((multiValKey) => {
			const multiValKeyWithout$multiVal = multiValKey.replace(/\.\$multiVal$/, '');
			const realValue = obj[multiValKey][0][multiValKeyWithout$multiVal].attribute; //there is an easier way for sure
			// eslint-disable-next-line no-param-reassign
			obj[dataFieldsKey][multiValKeyWithout$multiVal] = realValue;
		});
	}
	const dataFields = obj[dataFieldsKey];

	const metaDataKey = dataFieldsKey.split('.')[dataFieldsKey.split('.').length - 2];
	dataFields.$metaData = metaDataKey;

	if (dataFields.length === 0) {
		throw new Error('No dataFields');
	}

	const dataFieldsThing = dataFields.type;
	const schemaValue = {
		$thing: dataFieldsThing.label,
		$thingType: dataFieldsThing.root,
		[QueryPath]: obj['queryPath'].value,
	};
	const node = { [`$${schemaValue.$thingType}`]: schemaValue.$thing };
	const currentSchema = getCurrentSchema(schema, node);

	// Process linkFields and roleFields
	const linkFields = keys
		.filter((key) => {
			const $key = assertDefined(key.split('.').pop());
			return !key.endsWith('.$dataFields') && currentSchema.linkFields?.some((o) => o.path === $key);
		})
		.map((key) => {
			const $key = assertDefined(key.split('.').pop());
			const linkField = assertDefined(currentSchema.linkFields?.find((o) => o.path === $key));
			return {
				$linkFields: obj[key],
				$key,
				$metaData: key.split('.')[key.split('.').length - 2],
				$cardinality: linkField.cardinality,
			};
		});

	const roleFields = keys
		.filter((key) => {
			const role = key.split('.').pop();
			return (
				role && !key.endsWith('.$dataFields') && currentSchema.thingType === 'relation' && currentSchema.roles?.[role]
			);
		})
		.map((key) => {
			const role = assertDefined(key.split('.').pop());
			return {
				$roleFields: obj[key],
				$key: role,
				$metaData: key.split('.')[key.split('.').length - 2],
				$cardinality: (currentSchema as EnrichedBormRelation).roles[role].cardinality,
			};
		});

	return { dataFields, schemaValue, currentSchema, linkFields, roleFields };
};

const parseDataFields = (
	dataFields: any,
	currentSchema: EnrichedBormEntity | EnrichedBormRelation,
	config: BormConfig,
) => {
	const { $metaData } = dataFields;
	const { as: $as } = parseArrayMetadata($metaData);

	// Process the main data fields
	const mainDataFields = Object.entries(dataFields as Record<string, any>)
		.filter(([key]) => key !== 'type' && !key.startsWith('$'))
		.map(([key, value]) => {
			const field = currentSchema.dataFields?.find((f) => f.path === key || f.dbPath === key);
			const isIdField = key === 'id';
			const $asKey = Array.isArray($as) ? $as.find((o) => o[key])?.[key] : key;

			let fieldValue;
			if (field?.cardinality === 'ONE') {
				fieldValue = value[0] ? value[0].value : config.query?.returnNulls ? null : undefined;
				if (field.contentType === 'DATE' || (field.contentType === 'FLEX' && value[0].type.value_type === 'datetime')) {
					/// date fields need to be converted to ISO format including the timezone
					fieldValue = fieldValue ? `${fieldValue}Z` : fieldValue;
				} else if (field.contentType === 'JSON') {
					fieldValue = fieldValue && JSON.parse(fieldValue);
				}
				if (isIdField) {
					return [
						[$asKey, fieldValue],
						['$id', fieldValue],
					].filter(([_, v]) => v !== undefined);
				}
			} else if (field?.cardinality === 'MANY') {
				if (!isArray(value)) {
					throw new Error('Typedb fetch has changed its format');
				}
				if (value.length === 0) {
					return config.query?.returnNulls ? [[$asKey, null]] : []; //return nothing unles the returnNulls flag is set
				}
				if (field.contentType === 'DATE') {
					fieldValue = value.map((o) => {
						return `${o.value}Z`;
					});
				} else if (field.contentType === 'FLEX') {
					fieldValue = value.map((o) => {
						if (o.type.value_type === 'datetime') {
							return `${o.value}Z`;
						} else {
							return o.value;
						}
					});
				} else if (field.contentType === 'JSON') {
					fieldValue = value.map((o) => {
						return o.value && JSON.parse(o.value);
					});
				} else {
					fieldValue = value.map((o) => {
						return o.value;
					});
				}
			}
			return [[$asKey, fieldValue]].filter(([_, v]) => v !== undefined);
		})
		.flat();

	return Object.fromEntries([...mainDataFields]);
};

const parseRoleFields = (
	roleFields: { $roleFields: any[]; $key: string; $metaData: string; $cardinality: 'MANY' | 'ONE' }[],
	schema: EnrichedBormSchema,
	config: BormConfig,
) => {
	const roleFieldsRes: Record<string, any> = {};

	roleFields.forEach((roleField) => {
		const { $roleFields, $metaData, $cardinality } = roleField;
		const { as, justId, idNotIncluded, filterByUnique } = parseMetaData($metaData);

		if (as === null) {
			return;
		}

		const items = $roleFields.map((item) => {
			const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(item, schema);
			const parsedDataFields = parseDataFields(dataFields, currentSchema, config);

			if (justId === 'T') {
				return parsedDataFields.id;
			} else {
				const parsedLinkFields = parseLinkFields(linkFields, schema, config);
				const parsedRoleFields = parseRoleFields(roleFields, schema, config);
				const resDataFields = { ...parsedDataFields };
				if (idNotIncluded === 'true') {
					currentSchema?.idFields?.forEach((field) => delete resDataFields[field]);
				}
				return {
					...resDataFields,
					...parsedLinkFields,
					...parsedRoleFields,
					...schemaValue,
				};
			}
		});

		if (items.length > 0) {
			roleFieldsRes[as] = $cardinality === 'MANY' && filterByUnique === 'false' ? items : items[0];
		} else if (config.query?.returnNulls) {
			roleFieldsRes[as] = null;
		}
	});

	return roleFieldsRes;
};

const parseLinkFields = (
	linkFields: { $linkFields: any[]; $key: string; $metaData: string; $cardinality: 'MANY' | 'ONE' }[],
	schema: EnrichedBormSchema,
	config: BormConfig,
) => {
	const linkFieldsRes: Record<string, any> = {};

	linkFields.forEach((linkField) => {
		const { $linkFields, $metaData, $cardinality } = linkField;
		const { as, justId, idNotIncluded, filterByUnique } = parseMetaData($metaData);

		if (as === null) {
			return;
		}

		const items = $linkFields.map((item) => {
			const { dataFields, currentSchema, linkFields, roleFields, schemaValue } = parseFields(item, schema);
			const parsedDataFields = parseDataFields(dataFields, currentSchema, config);

			if (justId === 'T') {
				return parsedDataFields.id;
			} else {
				const parsedLinkFields = parseLinkFields(linkFields, schema, config);
				const parsedRoleFields = parseRoleFields(roleFields, schema, config);
				const resDataFields = { ...parsedDataFields };

				if (idNotIncluded === 'true') {
					currentSchema.idFields?.forEach((field) => delete resDataFields[field]);
				}

				return {
					...resDataFields,
					...parsedLinkFields,
					...parsedRoleFields,
					...schemaValue,
				};
			}
		});

		// eslint-disable-next-line no-param-reassign
		linkFieldsRes[as] =
			items.length > 0
				? $cardinality === 'MANY' && filterByUnique === 'false'
					? items
					: items[0]
				: config.query?.returnNulls
					? null
					: undefined;
	});

	return linkFieldsRes;
};

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
		return { as: [] };
	}
};
