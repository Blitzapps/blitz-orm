import { produce } from 'immer';
import type {
	PipelineOperation,
	BQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
	BaseResponse,
} from '../../../types';
import { traverse } from 'object-traversal';
import { getCurrentSchema } from '../../../helpers';
import { isObject } from 'radash';
import { QueryPath } from '../../../types/symbols';

//todo: use getCurrentFields instead
const getAllFields = (currentSchema: any) => {
	const dataFields = currentSchema.dataFields?.map((field: any) => field.path) || [];
	const linkFields = currentSchema.linkFields?.map((field: any) => field.path) || [];
	const roleFields = Object.keys(currentSchema.roles || {}) || [];
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

			return isIdField || isUniqueDataField;
		}
		return false;
	});
};

const processFilter = ($filter: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	// Map data fields, link fields, and role fields to a simplified structure
	const dataFields = currentSchema.dataFields?.map((field) => ({ path: field.path, dbPath: field.dbPath })) || [];
	// @ts-expect-error todo
	const linkFields = currentSchema.linkFields?.map((field) => ({ path: field.path, dbPath: field.dbPath })) || [];
	// @ts-expect-error todo
	const roleFields = Object.keys(currentSchema.roles || {}).map((field) => ({ path: field, dbPath: field })) || [];

	// Combine all fields into a single array
	const allFields = [...dataFields, ...linkFields, ...roleFields];

	// Reduce the filter object to a new structure
	return Object.entries($filter || {}).reduce((newFilter, [filterKey, filterValue]) => {
		const field = allFields.find((o) => o.path === filterKey);
		// @ts-expect-error todo
		// eslint-disable-next-line no-param-reassign
		newFilter[field?.dbPath || filterKey] = filterValue;
		return newFilter;
	}, {});
};

export const enrichBQLQuery: PipelineOperation<BaseResponse> = async (req) => {
	const { rawBqlRequest: rawBqlQuery, schema } = req;

	if (!Array.isArray(rawBqlQuery)) {
		if (
			!('$entity' in rawBqlQuery) &&
			!('$relation' in rawBqlQuery) &&
			(!('$thing' in rawBqlQuery) || !('$thingType' in rawBqlQuery))
		) {
			throw new Error('No entity specified in query');
		}
	} else {
		for (const item of rawBqlQuery) {
			if (!('$entity' in item) && !('$relation' in item) && (!('$thing' in item) || !('$thingType' in item))) {
				throw new Error('No entity specified in query');
			}
		}
	}

	const isId = (currentSchema: EnrichedBormEntity | EnrichedBormRelation, field: any) =>
		typeof field === 'string' ? currentSchema.idFields?.includes(field) : currentSchema.idFields?.includes(field.$path);

	const createDataField = (field: any, fieldStr: string, $justId: boolean, dbPath: string, isVirtual?: boolean) => {
		// todo: get all dependencies of the virtual field in the query and then remove from the output
		return {
			$path: fieldStr,
			$dbPath: dbPath,
			$thingType: 'attribute',
			$as: field.$as || fieldStr,
			$var: fieldStr,
			$fieldType: 'data',
			$excludedFields: field.$excludedFields,
			$justId,
			$id: field.$id,
			$filter: field.$filter,
			$isVirtual: isVirtual,
			// ...(typeof field !== 'string' && { $fields: [...field.$fields, ...['id']] }),
			$filterProcessed: true,
		};
	};

	const createLinkField = (field: any, fieldStr: string, linkField: any, $justId: boolean, dbPath: string) => {
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
						// @ts-expect-error todo
						fields = [...field.$fields, ...currentSchema.idFields];
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

			return {
				$thingType,
				$plays: linkField.plays,
				$playedBy: playedBy,
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
				$filter: processFilter(field.$filter, currentSchema),
				$idNotIncluded: idNotIncluded,
				$filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
				$filterProcessed: true,
				$sort: field.$sort,
				$offset: field.$offset,
				$limit: field.$limit,
			};
		});
	};

	const createRoleField = (field: any, fieldStr: string, roleField: any, $justId: boolean, dbPath: string) => {
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
				$filter: processFilter(field.$filter, currentSchema),
				$idNotIncluded: idNotIncluded,
				$filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
				$playedBy: playedBy,
				$filterProcessed: true,
				$sort: field.$sort,
				$offset: field.$offset,
				$limit: field.$limit,
			};
		});
	};
	const processField = (field: any, schema: any) => {
		const fieldStr = typeof field === 'string' ? field : field.$path;
		const justId = typeof field === 'string';
		const isDataField = schema.dataFields?.find((dataField: any) => dataField.path === fieldStr);
		const isLinkField = schema.linkFields?.find((linkField: any) => linkField.path === fieldStr);
		const isRoleField = schema.roles?.[fieldStr];

		if (isDataField) {
			const isComputed = isDataField.isVirtual && isDataField.default; //if there is no default value, then is fully virtual, the computing is managed in the DB
			return createDataField(field, fieldStr, justId, isDataField.dbPath, isComputed); //ignore computed ones
		} else if (isLinkField) {
			return createLinkField(field, fieldStr, isLinkField, justId, isLinkField.dbPath);
		} else if (isRoleField) {
			return createRoleField(field, fieldStr, isRoleField, justId, isRoleField.dbPath);
		}
		return null;
	};
	const parser = (blocks: any) => {
		return produce(blocks, (draft: any) =>
			traverse(draft, (context) => {
				const { value: val, meta } = context;
				const value: BQLMutationBlock = val;
				if (isObject(value)) {
					// 1. Moving $id into filter based on schema's idFields
					if (value.$id) {
						const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
						const currentSchema = getCurrentSchema(schema, node);
						if (!currentSchema?.name) {
							throw new Error(`Schema not found for ${value.$thing}`);
						}
						value.$path = currentSchema.name;
						if (!Array.isArray(value.$id)) {
							value.$filterByUnique = true;
						}
						// todo: composite ids
						if (currentSchema?.idFields?.length === 1) {
							const [idField] = currentSchema.idFields;
							value.$filter = { ...value.$filter, ...{ [idField]: value.$id } };
							delete value.$id;
						} else {
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

					if (isObject(value) && '$thing' in value) {
						const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
						value[QueryPath as any] = meta.nodePath;
						const currentSchema = getCurrentSchema(schema, node);
						if (value.$filter) {
							value.$filterByUnique = checkFilterByUnique(value.$filter, currentSchema);
							if (!value.$filterProcessed) {
								value.$filter = processFilter(value.$filter, currentSchema);
							}
						}
						// if no fields, then it's all fields
						if (value.$fields) {
							const idFieldIncluded =
								value.$fields.filter(
									(field: any) =>
										currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
								).length > 0;
							if (!idFieldIncluded) {
								value.$fields = [
									...value.$fields,
									...(Array.isArray(currentSchema.idFields) ? currentSchema.idFields : []),
								];
								value.$idNotIncluded = true;
							}
							const newFields = value.$fields
								?.flatMap((field: any) => {
									const processed = processField(field, currentSchema);
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
									const processed = processField(field, currentSchema);
									if (Array.isArray(processed)) {
										return processed;
									} else {
										return [processed];
									}
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
	};

	const enrichedBqlQuery = parser(Array.isArray(rawBqlQuery) ? rawBqlQuery : [rawBqlQuery]);
	//console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));

	req.enrichedBqlQuery = enrichedBqlQuery;
};
