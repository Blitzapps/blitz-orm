import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import type { BQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';

export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest } = req;
	// check for replaces, if there are, perform pre-query
	const checkForReplaces = (blocks: BQLMutationBlock | BQLMutationBlock[]): boolean => {
		let hasReplace = false;

		traverse(blocks, ({ value: val }) => {
			if (val.$op === 'replace') {
				hasReplace = true;
				return false; // Stops the traversal once a replace is found
			}
			return true;
		});

		return hasReplace;
	};
	// @ts-expect-error - todo
	const hasReplace = checkForReplaces(filledBqlRequest);

	// console.log('filledBqlRequest: ', JSON.stringify(filledBqlRequest, null, 2));
	// TODO: get filter replaces to work
	const convertMutationToQuery = (
		blocks: BQLMutationBlock | BQLMutationBlock[],
	): BQLMutationBlock | BQLMutationBlock[] => {
		if (Array.isArray(blocks)) {
			const ids: string[] = [];
			let relation: string | null = null;
			let entity: string | null = null;
			traverse(blocks, ({ value: val, key, meta }: TraversalCallbackContext) => {
				// Only capture root level $relation, $entity, and $id
				if (meta.depth === 2) {
					// Extracting $relation or $entity
					if (key === '$relation') {
						relation = val;
					} else if (key === '$entity') {
						entity = val;
					} else if (key === '$id' && typeof val === 'string') {
						ids.push(val);
					}
				}
			});

			if (!relation && !entity) {
				throw new Error('Neither $relation nor $entity found in the blocks');
			}

			const result: any = { $id: ids };

			if (relation) {
				result.$relation = relation;
			}

			if (entity) {
				result.$entity = entity;
			}

			return result;
		}
		return blocks;
	};
	// @ts-expect-error - todo
	const query = convertMutationToQuery(filledBqlRequest);
	// console.log('pre-query: ', query);

	// @ts-expect-error - todo
	const queryRes = await queryPipeline(query, req.config, req.schema, req.dbHandles);
	// console.log('pre-queryRes: ', JSON.stringify(queryRes, null, 2));
	// TODO: check query res if already has a value, if does do not allow for creates
	const checkForFoundFields = (
		blocks: BQLMutationBlock | BQLMutationBlock[],
	): BQLMutationBlock | BQLMutationBlock[] => {
		return produce(blocks, (draft) => {
			traverse(draft, ({ value: val, key, parent }: any) => {
				// Check if it's a defined operation
				// @ts-expect-error todo
				if (isObject(val) && val.$op === 'link' && parent && parent[key].$op === 'link') {
					// Extract the parent key name (i.e., the entity being created)
					// TODO: allow for arrays
					if (!Array.isArray(queryRes) && queryRes && queryRes[key] && !parseInt(key)) {
						if (queryRes[key].$op !== 'link') {
							throw new Error(`You already have ${key} filled for this.`);
						}
					}
				}
			});
		});
	};

	// @ts-expect-error todo
	checkForFoundFields(filledBqlRequest);

	if (hasReplace) {
		const fillReplaces = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
			return produce(blocks, (draft) =>
				traverse(draft, ({ value: val, key, parent }: TraversalCallbackContext) => {
					if (key && !key?.includes('$') && (Array.isArray(val) || isObject(val))) {
						const values = Array.isArray(val) ? val : [val];

						const currentEntityOrRelation: { $entity?: string; $relation?: string } = {};

						values.forEach((thing) => {
							if (thing.$op === 'replace') {
								// eslint-disable-next-line no-param-reassign
								thing.$op = 'link';
							}

							// Capture the current entity or relation
							if (thing.$entity) {
								currentEntityOrRelation.$entity = thing.$entity;
							} else if (thing.$relation) {
								currentEntityOrRelation.$relation = thing.$relation;
							}
						});

						let idsFromQueryRes: any[] = [];
						const matchingQueryObj = Array.isArray(queryRes)
							? // @ts-expect-error - todo
							  queryRes.find((item) => item.$id === parent.$id)
							: queryRes;

						const queryVal = matchingQueryObj ? matchingQueryObj[key] : null;

						if (Array.isArray(queryVal)) {
							idsFromQueryRes = queryVal.map((thing) => (typeof thing === 'object' ? thing.$id : thing));
						} else if (typeof queryVal === 'string') {
							idsFromQueryRes = [queryVal];
						}

						idsFromQueryRes.forEach((id: any) => {
							const valueWithReplaceOp =
								queryVal[0].$op === 'replace'
									? null
									: values.find((thing: any) => thing.$id === id && thing.$op === 'link');
							// console.log('valueWithReplaceOp: ', JSON.stringify({ valueWithReplaceOp, queryVal }, null, 2));

							if (!valueWithReplaceOp && !values.some((thing: any) => thing.$id === id)) {
								const unlinkOp = {
									...currentEntityOrRelation,
									$op: 'unlink',
									$id: id,
									$bzId: `T_${uuidv4()}`,
								};

								if (Array.isArray(val)) {
									val.push(unlinkOp);
								} else {
									// @ts-expect-error todo
									// eslint-disable-next-line no-param-reassign
									parent[key] = [val, unlinkOp];
								}
							} else if (valueWithReplaceOp) {
								// Remove $op: 'link' for id that is already present in queryRes
								const index = values.findIndex((thing: any) => thing.$id === id && thing.$op === 'link');
								if (index > -1) {
									values.splice(index, 1);
								}
							}
						});
					}
				}),
			);
		};

		// @ts-expect-error - todo
		const filledReplaces = fillReplaces(filledBqlRequest);
		// console.log('filledReplaces: ', JSON.stringify(filledReplaces, null, 2));

		// @ts-expect-error - todo
		req.filledBqlRequest = filledReplaces;
	}
};
