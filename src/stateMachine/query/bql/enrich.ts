/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type {
	BQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
	RawBQLQuery,
	EnrichedBQLQuery,
	EnrichedBormSchema,
	EnrichedAttributeQuery,
	EnrichedLinkQuery,
	EnrichedRoleQuery,
	EnrichedDataField,
	EnrichedLinkField,
	EnrichedRoleField,
	Filter,
} from '../../../types';
import { traverse } from 'object-traversal';
import { getCurrentSchema, getFieldType } from '../../../helpers';
import { isArray, isObject } from 'radash';
import { FieldSchema, QueryPath } from '../../../types/symbols';

export const enrichBQLQuery = (rawBqlQuery: RawBQLQuery[], schema: EnrichedBormSchema): EnrichedBQLQuery[] => {
	for (const item of rawBqlQuery) {
		if (!('$entity' in item) && !('$relation' in item) && (!('$thing' in item) || !('$thingType' in item))) {
			throw new Error('No entity specified in query');
		}
	}

	const batches = Array.isArray(rawBqlQuery) ? rawBqlQuery : [rawBqlQuery];

	// TODO: The raw query and the enriched query have different type.
	// Instead of mutating the existing object (copy + mutate)
	// replace `produce` and `traverse` with a function that returns a new object.
	// This way we don't need to force the enriched query (RawBQLQuery that has been mutated)
	// to have type EnrichedBQLQuery, thus we get better type check.
	const enriched = produce(batches, (draft: any) =>
		traverse(draft, (context) => {
			const { value: val, meta } = context;
			const value: BQLMutationBlock = val;

			if (isObject(value)) {
				// 1. Moving $id into filter based on schema's idFields
				if (value.$id) {
					//Skip the filter branch
					if (meta.nodePath?.includes('.$filter')) {
						return;
					}
					const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
					const currentSchema = getCurrentSchema(schema, node);
					if (!currentSchema?.name) {
						throw new Error(`Schema not found for ${value.$thing}`);
					}
					value.$path = currentSchema.name;
					if (!Array.isArray(value.$id)) {
						value.$filterByUnique = true;
					}
					if (currentSchema?.idFields?.length !== 1) {
						throw new Error('Multiple ids not yet enabled / composite ids');
					}
				} else if ('$entity' in value || '$relation' in value || '$thing' in value) {
					const currentSchema = getCurrentSchema(schema, value);
					if (!currentSchema?.name) {
						throw new Error(`Schema not found for ${value.$thing}`);
					}
					value.$path = currentSchema.name;
				}
				// 2. Converting $entity or $relation into $thingType and $thing
				if (value.$entity) {
					value.$thing = value.$entity;
					value.$thingType = 'entity';
					delete value.$entity;
				} else if (value.$relation) {
					value.$thing = value.$relation;
					value.$thingType = 'relation';
					delete value.$relation;
				}

				if (isObject(value) && '$thing' in value && value.$thing) {
					const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
					value[QueryPath as any] = meta.nodePath;
					const currentSchema = getCurrentSchema(schema, node);
					if (value.$filter) {
						value.$filterByUnique = checkFilterByUnique(value.$filter, currentSchema);
						value.$filter = enrichFilter(value.$filter, value.$thing, schema);
					}
					// if no fields, then it's all fields
					if (value.$fields) {
						const idFieldIncluded = value.$fields.some((field: any) =>
							currentSchema?.idFields?.includes(field?.$path || field),
						);
						if (!idFieldIncluded) {
							value.$fields = [
								...value.$fields,
								...(Array.isArray(currentSchema.idFields) ? currentSchema.idFields : []),
							];
							value.$idNotIncluded = true;
						}
						const newFields = value.$fields
							?.flatMap((field: any) => {
								const processed = processField(field, currentSchema, schema);
								if (Array.isArray(processed)) {
									return processed;
								} else {
									return [processed];
								}
							})
							.filter(Boolean);
						value.$fields = newFields;
					} else {
						const allFields = getAllFields(currentSchema);
						const newFields = allFields
							?.flatMap((field: any) => {
								const processed = processField(field, currentSchema, schema);
								return Array.isArray(processed) ? processed : [processed];
							})
							.filter(Boolean);
						value.$fields = newFields;
					}

					if (value.$excludedFields) {
						value.$fields = value.$fields.filter((f: { $path: string }) => {
							if (isId(currentSchema, f)) {
								return true;
							}
							return !value.$excludedFields.includes(f.$path);
						});
					}
				}
			}
		}),
	);
	//console.log('enriched', JSON.stringify(enriched));

	return enriched as EnrichedBQLQuery[];
};

const getAllFields = (currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const dataFields = currentSchema.dataFields?.map((field: any) => field.path) || [];
	const linkFields = currentSchema.linkFields?.map((field: any) => field.path) || [];
	const roleFields = Object.keys((currentSchema as EnrichedBormRelation).roles || {}) || [];
	const allFields = [...dataFields, ...linkFields, ...roleFields];
	return allFields;
};

const checkFilterByUnique = ($filter: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const fields = Object.keys($filter || {});
	return fields.some((field) => {
		if (!Array.isArray($filter[field])) {
			const isIdField = currentSchema.idFields?.includes(field);
			const isUniqueDataField = currentSchema.dataFields?.some(
				(f) => (f.dbPath === field || f.path === field) && f?.validations?.unique,
			);
			const isSingle$id = field === '$id' && !Array.isArray($filter[field]);

			return isIdField || isUniqueDataField || isSingle$id;
		}
		return false;
	});
};

const isId = (currentSchema: EnrichedBormEntity | EnrichedBormRelation, field: any) =>
	typeof field === 'string' ? currentSchema.idFields?.includes(field) : currentSchema.idFields?.includes(field.$path);

const createDataField = (props: {
	field: any;
	fieldStr: string;
	$justId: boolean;
	dbPath: string;
	isVirtual?: boolean;
	fieldSchema: EnrichedDataField;
}): EnrichedAttributeQuery => {
	const { field, fieldStr, $justId, dbPath, isVirtual, fieldSchema } = props;
	// todo: get all dependencies of the virtual field in the query and then remove from the output
	return {
		$path: fieldStr,
		$dbPath: dbPath,
		$thingType: 'attribute',
		$as: field.$as || fieldStr,
		$var: fieldStr,
		$fieldType: 'data',
		$justId,
		$id: field.$id,
		$isVirtual: isVirtual,
		[FieldSchema]: fieldSchema,
	};
};

const createLinkField = (props: {
	field: any;
	fieldStr: string;
	linkField: any;
	$justId: boolean;
	dbPath: string;
	schema: EnrichedBormSchema;
	fieldSchema: EnrichedLinkField;
}): EnrichedLinkQuery => {
	const { field, fieldStr, linkField, $justId, dbPath, schema, fieldSchema } = props;
	const { target, oppositeLinkFieldsPlayedBy } = linkField;
	return oppositeLinkFieldsPlayedBy.map((playedBy: any) => {
		const $thingType = target === 'role' ? playedBy.thingType : 'relation';
		const $thing = target === 'role' ? playedBy.thing : linkField.relation;
		const node = { [`$${$thingType}`]: $thing };
		const currentSchema = getCurrentSchema(schema, node);
		const idNotIncluded = field?.$fields?.filter((f: any) => isId(currentSchema, f)).length === 0;

		let fields = [];
		if (typeof field !== 'string') {
			if (field.$fields) {
				if (idNotIncluded) {
					const idFields = currentSchema.idFields || [];
					fields = [...field.$fields, ...idFields];
				} else {
					fields = field.$fields;
				}
			} else {
				fields = getAllFields(currentSchema);
			}
		} else {
			fields = ['id'];
		}

		if (field.$excludedFields) {
			fields = fields.filter((f: { $path: string }) => {
				if (isId(currentSchema, f)) {
					return true;
				}
				return !field.$excludedFields.includes(f.$path);
			});
		}

		const $filter =
			field.$id || field.$filter //skip if no $id and not $filter. In the future $thing can filter too
				? { ...(field.$id ? { $id: field.$id } : {}), ...enrichFilter(field.$filter, $thing, schema) }
				: undefined;

		return {
			$thingType,
			$plays: linkField.plays,
			$playedBy: {
				...playedBy,
				oppositeLinkFieldsPlayedBy: undefined, // Remove this to break the loop
			},
			$path: playedBy.path,
			$dbPath: dbPath,
			$as: field.$as || fieldStr,
			$var: fieldStr,
			$thing,
			$fields: fields,
			$excludedFields: field.$excludedFields,
			$fieldType: 'link',
			$target: target,
			$intermediary: playedBy.relation,
			$justId,
			$id: field.$id,
			$filter,
			$idNotIncluded: idNotIncluded,
			$filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
			$sort: field.$sort,
			$offset: field.$offset,
			$limit: field.$limit,
			[FieldSchema]: fieldSchema,
		};
	});
};

const createRoleField = (props: {
	field: any;
	fieldStr: string;
	roleField: any;
	$justId: boolean;
	dbPath: string;
	schema: EnrichedBormSchema;
	fieldSchema: EnrichedRoleField;
}): EnrichedRoleQuery => {
	const { field, fieldStr, roleField, $justId, dbPath, schema, fieldSchema } = props;

	return roleField.playedBy.map((playedBy: any) => {
		const { thing, thingType, relation } = playedBy;
		const node = { [`$${thingType}`]: thing };
		const currentSchema = getCurrentSchema(schema, node);
		const idNotIncluded =
			field?.$fields?.filter(
				(field: any) => currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
			).length === 0;

		let fields = [];
		if (typeof field !== 'string') {
			if (field.$fields) {
				if (idNotIncluded) {
					const idFields = currentSchema.idFields || [];
					fields = [...field.$fields, ...idFields];
				} else {
					fields = field.$fields;
				}
			} else {
				fields = getAllFields(currentSchema);
			}
		} else {
			fields = ['id'];
		}

		if (field.$excludedFields) {
			fields = fields.filter((f: { $path: string }) => {
				if (isId(currentSchema, f)) {
					return true;
				}
				return !field.$excludedFields.includes(f.$path);
			});
		}

		const $filter =
			field.$id || field.$filter //skip if no $id and not $filter. In the future $thing can filter too
				? { ...(field.$id ? { $id: field.$id } : {}), ...enrichFilter(field.$filter, thing, schema) }
				: undefined;

		return {
			$thingType: thingType,
			$path: fieldStr,
			$dbPath: dbPath,
			$as: field.$as || fieldStr,
			$var: fieldStr,
			$thing: thing,
			$fields: fields,
			$excludedFields: field.$excludedFields,
			$fieldType: 'role',
			$intermediary: relation,
			$justId,
			$id: field.$id,
			$filter,
			//$filter: field.$filter,
			$idNotIncluded: idNotIncluded,
			$filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
			$playedBy: { ...playedBy, oppositeLinkFieldsPlayedBy: undefined },
			$sort: field.$sort,
			$offset: field.$offset,
			$limit: field.$limit,
			[FieldSchema]: fieldSchema,
		};
	});
};

const processField = (
	field: any,
	currentSchema: EnrichedBormEntity | EnrichedBormRelation,
	schema: EnrichedBormSchema,
) => {
	const fieldStr = typeof field === 'string' ? field : field.$path;
	const $justId = typeof field === 'string';
	const dataField = currentSchema.dataFields?.find((dataField: any) => dataField.path === fieldStr);
	const linkField = currentSchema.linkFields?.find((linkField: any) => linkField.path === fieldStr);
	const roleField = (currentSchema as EnrichedBormRelation).roles?.[fieldStr];

	if (dataField) {
		const isVirtual = !!dataField.isVirtual && !!dataField.default; //if there is no default value, then is fully virtual, the computing is managed in the DB
		return createDataField({
			field,
			fieldStr,
			$justId,
			dbPath: dataField.dbPath,
			isVirtual,
			fieldSchema: dataField,
		}); //ignore computed ones
	} else if (linkField) {
		return createLinkField({
			field,
			fieldStr,
			linkField,
			$justId,
			dbPath: linkField.path,
			schema,
			fieldSchema: linkField,
		});
	} else if (roleField) {
		return createRoleField({
			field,
			fieldStr,
			roleField,
			$justId,
			dbPath: fieldStr,
			schema,
			fieldSchema: roleField,
		});
	}
	return null;
};

// Recursive enrich filter that checks all the tree of filters. Sometimes is dataFields, which is easier, but sometimes is linkFields or roleFields so we need to keep drilling
export const enrichFilter = ($filter: Filter | Filter[], $thing: string, schema: EnrichedBormSchema) => {
	//console.log('toEnrich', $filter, $thing);
	if ($filter === null || $filter === undefined) {
		return $filter;
	}
	const wasArray = isArray($filter);

	const filterArray = wasArray ? $filter : [$filter];

	const resultArray = filterArray.map((filter: any) => {
		const keys = Object.keys(filter);

		const enrichedFilter = keys.reduce((acc: any, key: string) => {
			const value = filter[key];

			const valueAsArray = isArray(value) ? value : [value];

			if (key.startsWith('$')) {
				if (['$id', '$thing'].includes(key)) {
					acc[key] = value;
				} else {
					// we don't want to enrich the special keys, for instance $or: ... stays as it is but we enrich nested things:
					acc[key] = enrichFilter(value, $thing, schema); //$thing does not change as we are just jumping throws reserved words like $or, $eq etc
				}
			} else {
				// must be a field
				const currentSchema = $thing in schema.entities ? schema.entities[$thing] : schema.relations[$thing];
				const [fieldType, fieldSchema] = getFieldType(currentSchema, key);

				if (fieldType === 'dataField') {
					acc[key] = value;
				} else if (fieldType === 'linkField' || fieldType === 'roleField') {
					const fieldSchemaTyped = fieldSchema as EnrichedLinkField | EnrichedRoleField;
					const [childrenThing] = fieldSchemaTyped.$things; //todo: Manage polymorphism
					if (valueAsArray.every((v: any) => typeof v === 'string')) {
						acc[key] = { $id: valueAsArray, $thing: childrenThing }; //Avoid the traverse to check this
					} else if (valueAsArray.every((v: any) => isObject(v))) {
						acc[key] = isArray(value)
							? { $or: enrichFilter(value, childrenThing, schema) }
							: enrichFilter(value, childrenThing, schema);
					}
					return acc;
				} else {
					throw new Error(`Field ${key} not found in schema of ${$thing}`);
				}
			}
			return acc;
		}, {});
		return enrichedFilter;
	});

	if (!wasArray) {
		return resultArray[0];
	} else if (resultArray.length === 1) {
		return resultArray[0];
	} else {
		return { $or: resultArray };
	}
};
