import { produce } from 'immer';
import type { PipelineOperation } from '../pipeline';
import { traverse } from 'object-traversal';
import { getCurrentSchema } from '../../helpers';
import { isObject } from 'radash';
import type { BQLMutationBlock } from '../../types';

// todo: use rawBQL $as in place of $as for enriched
// todo: add new $_ in place for $as to use in build TQL query

const createDataField = (field: any, fieldStr: string, $justId: boolean) => {
	return {
		$path: fieldStr,
		$thingType: 'attribute',
		$as: field.$as || fieldStr,
		$var: fieldStr,
		$fieldType: 'data',
		$justId,
		...(typeof field !== 'string' && { $fields: field.$fields }),
	};
};

const createLinkField = (field: any, fieldStr: string, linkField: any, $justId: boolean) => {
	const { target, oppositeLinkFieldsPlayedBy } = linkField;

	return oppositeLinkFieldsPlayedBy.map((playedBy: any) => {
		return {
			$thingType: target === 'role' ? playedBy.thingType : 'relation',
			$plays: linkField.plays,
			$path: playedBy.path,
			$as: field.$as || fieldStr,
			$var: fieldStr,
			$thing: target === 'role' ? playedBy.thing : linkField.relation,
			$fields: field.$fields || ['id'],
			$fieldType: 'link',
			$target: target,
			$intermediary: playedBy.relation,
			$justId,
		};
	});
};

const createRoleField = (field: any, fieldStr: string, roleField: any, $justId: boolean) => {
	return roleField.playedBy.map((playedBy: any) => {
		const { thing, thingType, relation } = playedBy;

		return {
			$thingType: thingType,
			$path: fieldStr,
			$as: field.$as || fieldStr,
			$var: fieldStr,
			$thing: thing,
			$fields: field.$fields || ['id'],
			$fieldType: 'role',
			$intermediary: relation,
			$justId,
		};
	});
};

// todo: discern between ids for string and objects for $path
const processField = (field: any, schema: any) => {
	const fieldStr = typeof field === 'string' ? field : field.$path;
	const justId = typeof field === 'string';
	const isDataField = schema.dataFields?.some((dataField: any) => dataField.path === fieldStr);
	const isLinkField = schema.linkFields?.find((linkField: any) => linkField.path === fieldStr);
	const isRoleField = schema.roles?.[fieldStr];

	if (isDataField) {
		return createDataField(field, fieldStr, justId);
	} else if (isLinkField) {
		return createLinkField(field, fieldStr, isLinkField, justId);
	} else if (isRoleField) {
		return createRoleField(field, fieldStr, isRoleField, justId);
	}
	return null;
};

export const enrichBQLQuery: PipelineOperation = async (req) => {
	const { rawBqlRequest: rawBqlQuery, schema } = req;

	if (!('$entity' in rawBqlQuery) && !('$relation' in rawBqlQuery)) {
		throw new Error('No entity specified in query');
	}

	const parser = (blocks: any) => {
		return produce(blocks, (draft: any) =>
			traverse(draft, (context) => {
				const { value: val } = context;
				const value: BQLMutationBlock = val;
				if (isObject(value)) {
					// 1. Moving $id into filter based on schema's idFields

					if (value.$id) {
						const currentSchema = getCurrentSchema(schema, value);
						value.$path = currentSchema.name;
						value.$as = currentSchema.name;
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
						// if no fields, then it's all fields
						if (value.$fields) {
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
							const dataFields = currentSchema.dataFields?.map((field) => field.path) || [];
							const linkFields = currentSchema.linkFields?.map((field) => field.path) || [];
							const allFields = [...dataFields, ...linkFields];
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
					}
				}
			}),
		);
	};

	const enrichedBqlQuery = parser([rawBqlQuery]);
	console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));

	req.enrichedBqlQuery = enrichedBqlQuery;
};
