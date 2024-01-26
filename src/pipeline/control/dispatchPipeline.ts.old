import { listify, flat } from 'radash';

import { extractChildEntities, notNull } from '../../helpers';
import type { RawBQLQuery } from '../../types';
import type { PipelineOperation } from '../pipeline';
import { parseTQLRes } from '../postprocess';
import { buildTQLQuery } from '../preprocess';
import { runTQLQuery } from '../transaction';

// todo: fix this
// @ts-expect-error - TODO description
export const dispatchPipeline: PipelineOperation = async (req, res) => {
	const { bqlRequest, schema } = req;
	const { cache } = res;
	if (!bqlRequest) {
		throw new Error('BQL request not parsed');
	}
	if (!cache) {
		throw new Error('Cache not initialized');
	}
	const { query } = bqlRequest;
	if (!query) {
		return;
	}
	const { $fields } = query;

	if (!('$entity' in query) && !('$relation' in query)) {
		throw new Error('Node attributes not supported');
	}
	const $thing = '$entity' in query ? query.$entity : query.$relation;

	if (!$fields || !Array.isArray($fields)) {
		return;
	}

	const expandedLinkAndRoleFields = $fields.filter((f) => typeof f !== 'string' && f.$path);

	// Filter by field in query that has $path == should be expanded
	const nestedThingsByLF =
		$thing.linkFields
			?.filter(
				(linkField) =>
					expandedLinkAndRoleFields.findIndex(
						// @ts-expect-error - only objects with $path are left
						(expanded) => expanded.$path === linkField.path,
					) !== -1,
			)
			.flatMap((linkField) => linkField.oppositeLinkFieldsPlayedBy) || [];

	const nestedThingsByRF =
		'roles' in $thing
			? listify($thing.roles, (k, v) => {
					if (
						expandedLinkAndRoleFields.findIndex(
							// @ts-expect-error - only objects with $path are left
							(expanded) => expanded.$path === k,
						) !== -1
					) {
						return v;
					}
					return null;
			  })
					.flatMap((role) => role?.playedBy)
					.filter((x) => x)
			: [];

	const nestedThings = [...nestedThingsByLF, ...nestedThingsByRF];
	const nextOps = nestedThings
		?.map((linkField) => {
			if (!linkField) {
				return null;
			}
			const { thing } = linkField; // previous filter ensures this is safe
			// todo: get also relations?
			const childEntities = extractChildEntities(schema.entities, thing);

			return [thing, ...childEntities]
				.map((childEntity) => {
					const entity = cache.entities.get(childEntity);
					if (!entity) {
						return null;
					}
					// If '$show' not in val that means that the entity has not been queried
					const resultIds = Array.from(entity.values()).reduce((acc: string[], val) => {
						if (!('$show' in val)) {
							acc.push(val.$id);
						}
						return acc;
					}, []);
					if (resultIds.length === 0) {
						return null;
					}

					const currentSchema = schema.entities[childEntity]
						? { ...schema.entities[childEntity], thingType: 'entity' }
						: { ...schema.relations[childEntity], thingType: 'relation' };

					const $FieldsObj = $fields.find(
						(x) => typeof x === 'object' && x.$path === linkField.plays,
					) as Partial<RawBQLQuery>;

					// TODO: use an $id BQL query
					// todo: $id should not depend only on the entityType as the same entity could play two roles and break this

					// console.log('req', req.bqlRequest);

					const localIdsTemp = $FieldsObj?.$id;
					const localIds = !localIdsTemp ? [] : Array.isArray(localIdsTemp) ? localIdsTemp : [localIdsTemp];
					const localFilters = $FieldsObj?.$filter;

					// use only common ids between localIds and ids arrays
					const commonIds = !localIds.length ? resultIds : localIds.filter((id) => resultIds.includes(id));

					const newBqlRequest = {
						query: {
							$id: commonIds,
							$fields: $FieldsObj?.$fields,
							...(currentSchema.thingType === 'entity' ? { $entity: currentSchema } : {}),
							...(currentSchema.thingType === 'relation' ? { $relation: currentSchema } : {}),
							...(localFilters ? { $localFilters: localFilters } : {}),
							// ...(nestedFilter ? { $nestedFilters: nestedFilters } : {}),
						},
					};

					return {
						req: {
							...req,
							bqlRequest: newBqlRequest,
						},
						res,
						pipeline: [buildTQLQuery, runTQLQuery, parseTQLRes, dispatchPipeline],
					};
				})
				.filter(notNull);
		})
		.filter(notNull);

	if (nextOps?.length) {
		// eslint-disable-next-line consistent-return -- TODO : consistent return
		return flat(nextOps);
	}
};
