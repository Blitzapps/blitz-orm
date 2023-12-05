import { produce } from 'immer';
import type { PipelineOperation } from '../pipeline';
import { traverse } from 'object-traversal';
import { getCurrentSchema } from '../../helpers';
import { isObject } from 'radash';
import type { BQLMutationBlock } from '../../types';

const createDataField = (field: any, fieldStr: string) => {
	return {
		$path: fieldStr,
		$thingType: 'attribute',
		$as: fieldStr,
		$fieldType: 'data',

		...(typeof field !== 'string' && { $fields: field.$fields }),
	};
};

const createLinkField = (field: any, fieldStr: string, linkField: any) => {
	if (linkField.oppositeLinkFieldsPlayedBy.length === 1) {
		const { target, oppositeLinkFieldsPlayedBy } = linkField;
		return {
			$thingType: target === 'role' ? oppositeLinkFieldsPlayedBy[0].thingType : 'relation',
			$plays: linkField.plays,
			$path: oppositeLinkFieldsPlayedBy[0].path,
			$as: fieldStr,
			$thing: target === 'role' ? oppositeLinkFieldsPlayedBy[0].thing : linkField.relation,
			$fields: field.$fields || ['id'],
			$fieldType: 'link',
			$target: target,
			$intermediary: oppositeLinkFieldsPlayedBy[0].relation,
		};
	} else {
		// todo: work for multiple playedBy
		throw new Error('Multiple oppositeLinkFieldsPlayedBy not yet enabled');
	}
};

const createRoleField = (field: any, fieldStr: string, roleField: any) => {
	if (roleField.playedBy.length === 1) {
		const [{ thing, thingType, relation }] = roleField.playedBy;

		return {
			$thingType: thingType,
			$path: fieldStr,
			$as: fieldStr,
			$thing: thing,
			$fields: field.$fields || ['id'],
			$fieldType: 'role',
			$intermediary: relation,
		};
	} else {
		// todo: work for multiple roles
		throw new Error('Multiple playedBy roles not yet enabled');
	}
};

// todo: discern between ids for string and objects for $path
const processField = (field: any, schema: any) => {
	const fieldStr = typeof field === 'string' ? field : field.$path;
	const isDataField = schema.dataFields?.some((dataField: any) => dataField.path === fieldStr);
	const isLinkField = schema.linkFields?.find((linkField: any) => linkField.path === fieldStr);
	const isRoleField = schema.roles?.[fieldStr];

	if (isDataField) {
		return createDataField(field, fieldStr);
	} else if (isLinkField) {
		return createLinkField(field, fieldStr, isLinkField);
	} else if (isRoleField) {
		return createRoleField(field, fieldStr, isRoleField);
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

					// todo: when thingType isn't specified it is thingType = thing
					if (isObject(value) && '$fields' in value) {
						const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };

						const currentSchema = getCurrentSchema(schema, node);
						const newFields = value.$fields?.map((field: any) => processField(field, currentSchema)).filter(Boolean);
						value.$fields = newFields;
					}
				}
			}),
		);
	};

	const enrichedBqlQuery = parser([rawBqlQuery]);
	// console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));

	req.enrichedBqlQuery = enrichedBqlQuery;
};
