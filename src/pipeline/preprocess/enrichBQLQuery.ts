import { produce } from 'immer';
import type { PipelineOperation } from '../pipeline';
import { traverse } from 'object-traversal';
import { getCurrentSchema } from '../../helpers';
import { isObject } from 'radash';
import type { BQLMutationBlock, EnrichedBormEntity, EnrichedBormRelation } from '../../types';

const getAllFields = (currentSchema: any) => {
	const dataFields = currentSchema.dataFields?.map((field: any) => field.path) || [];
	const linkFields = currentSchema.linkFields?.map((field: any) => field.path) || [];
	const roleFields = Object.keys(currentSchema.roles || {}) || [];
	const allFields = [...dataFields, ...linkFields, ...roleFields];
	return allFields;
};

const checkFilterByUnique = ($filter: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const fields = Object.keys($filter || {});
	let $filteredByUnique = false;
	for (const field of fields) {
		if (!Array.isArray($filter[field])) {
			const idFieldFound = currentSchema.idFields?.find((idField) => idField === field);
			const uniqueDataFieldFound = currentSchema.dataFields?.find(
				(f) => (f.dbPath === field || f.path === field) && f.validations.unique,
			);

			if (idFieldFound || uniqueDataFieldFound) {
				$filteredByUnique = true;
			}
		}
	}
	return $filteredByUnique;
};

const processFilter = ($filter: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const newFilter = {};
	const dataFields =
		currentSchema.dataFields?.map((field: any) => {
			return { path: field.path, dbPath: field.dbPath };
		}) || [];
	const linkFields =
		currentSchema.linkFields?.map((field: any) => {
			return { path: field.path, dbPath: field.dbPath };
		}) || [];
	const roleFields =
		// @ts-expect-error todo
		Object.keys(currentSchema.roles || {}).map((field: string) => {
			return { path: field, dbPath: field };
		}) || [];
	const allFields = [...dataFields, ...linkFields, ...roleFields];

	for (const filter in $filter) {
		const field = allFields.find((o) => o.path === filter);
		// @ts-expect-error todo
		newFilter[field?.dbPath || field?.path] = $filter[filter];
	}
	return newFilter;
};

export const enrichBQLQuery: PipelineOperation = async (req) => {
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

	const createDataField = (field: any, fieldStr: string, $justId: boolean, dbPath: string, isVirtual?: boolean) => {
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
			$filter: field.$filter,
			$isVirtual: isVirtual,
			// ...(typeof field !== 'string' && { $fields: [...field.$fields, ...['id']] }),
		};
	};

	const createLinkField = (field: any, fieldStr: string, linkField: any, $justId: boolean, dbPath: string) => {
		const { target, oppositeLinkFieldsPlayedBy } = linkField;
		return oppositeLinkFieldsPlayedBy.map((playedBy: any) => {
			const $thingType = target === 'role' ? playedBy.thingType : 'relation';
			const $thing = target === 'role' ? playedBy.thing : linkField.relation;
			const node = { [`$${$thingType}`]: $thing };
			const currentSchema = getCurrentSchema(schema, node);
			const idNotIncluded =
				field?.$fields?.filter(
					(field: any) => currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
				).length === 0;

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
				fields = fields.filter((f: { $path: string }) => !field.$excludedFields.includes(f.$path));
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
				$fieldType: 'link',
				$target: target,
				$intermediary: playedBy.relation,
				$justId,
				$id: field.$id,
				$filter: processFilter(field.$filter, currentSchema),
				$idNotIncluded: idNotIncluded,
				$filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
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
				fields = fields.filter((f: { $path: string }) => !field.$excludedFields.includes(f.$path));
			}
			return {
				$thingType: thingType,
				$path: fieldStr,
				$dbPath: dbPath,
				$as: field.$as || fieldStr,
				$var: fieldStr,
				$thing: thing,
				$fields: fields,
				$fieldType: 'role',
				$intermediary: relation,
				$justId,
				$id: field.$id,
				$filter: processFilter(field.$filter, currentSchema),
				$idNotIncluded: idNotIncluded,
				$filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
				$playedBy: playedBy,
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
			return createDataField(field, fieldStr, justId, isDataField.dbPath, isDataField.isVirtual);
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
				const { value: val } = context;
				const value: BQLMutationBlock = val;
				if (isObject(value)) {
					// 1. Moving $id into filter based on schema's idFields
					if (value.$id) {
						const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
						const currentSchema = getCurrentSchema(schema, node);
						value.$path = currentSchema.name;
						if (!Array.isArray(value.$id)) {
							value.$filterByUnique = true;
						}
						// todo: composite ids
						if (currentSchema?.idFields?.length === 1) {
							const [idField] = currentSchema.idFields;
							// @ts-expect-error todo
							value.$filter = { ...value.$filter, ...{ [idField]: value.$id } };
							delete value.$id;
						} else {
							throw new Error('Multiple ids not yet enabled / composite ids');
						}
					} else if ('$entity' in value || '$relation' in value) {
						const currentSchema = getCurrentSchema(schema, value);
						value.$path = currentSchema.name;
						value.$as = currentSchema.name;
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
						const currentSchema = getCurrentSchema(schema, node);
						if (value.$filter) {
							value.$filterByUnique = checkFilterByUnique(value.$filter, currentSchema);
						}
						// if no fields, then it's all fields
						if (value.$fields) {
							const idFieldIncluded =
								value.$fields.filter(
									(field: any) =>
										currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
								).length > 0;
							if (!idFieldIncluded) {
								value.$fields = [...value.$fields, ...currentSchema.idFields];
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
							value.$fields = value.$fields.filter((f: { $path: string }) => !value.$excludedFields.includes(f.$path));
						}
					}
				}
			}),
		);
	};

	const enrichedBqlQuery = parser(Array.isArray(rawBqlQuery) ? rawBqlQuery : [rawBqlQuery]);
	// console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));

	req.enrichedBqlQuery = enrichedBqlQuery;
};
