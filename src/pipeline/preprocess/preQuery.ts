import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { get, isObject } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import type { FilledBQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';

export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest } = req;
	let newFilled: FilledBQLMutationBlock | FilledBQLMutationBlock[] = filledBqlRequest as
		| FilledBQLMutationBlock
		| FilledBQLMutationBlock[];

	// console.log('filledBqlRequest: ', JSON.stringify(filledBqlRequest, null, 2));
	// TODO: get filter replaces to work
	const convertMutationToQuery = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
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
		} else if (isObject(blocks)) {
			const result: any = {
				...(blocks.$relation && {
					$relation: blocks.$relation,
				}),
				...(blocks.$entity && {
					$entity: blocks.$entity,
				}),
				$id: blocks.$id || blocks.id,
			};
			traverse(blocks, ({ key, value, meta }) => {
				if (key === '$op' && value === 'match' && meta.nodePath) {
					const pathComponents = meta.nodePath.split('.').slice(0, -1); // we remove the $op from the end
					let currentPath: any = result;
					pathComponents.forEach((component) => {
						if (!currentPath.$fields) {
							currentPath.$fields = [];
						}
						let existingPath = currentPath.$fields.find((f: any) => f.$path === component);
						if (!existingPath) {
							existingPath = { $path: component };
							currentPath.$fields.push(existingPath);
						}
						currentPath = existingPath;
					});
				}
			});
			return result;
		}
		return blocks;
	};
	const preQueryBlocks = convertMutationToQuery(filledBqlRequest as FilledBQLMutationBlock | FilledBQLMutationBlock[]);
	// console.log('preQueryBlocks: ', preQueryBlocks);

	// @ts-expect-error - todo
	const preQueryRes = await queryPipeline(preQueryBlocks, req.config, req.schema, req.dbHandles);
	// console.log('preQueryRes: ', JSON.stringify(preQueryRes, null, 2));

	// 1. Cannot $link when you already have something already in place, instead must replaces
	const checkForFoundFields = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) => {
			traverse(draft, ({ value: val, key, parent }: any) => {
				// Check if it's a defined operation
				// @ts-expect-error todo
				if (isObject(val) && val.$op === 'link' && parent && parent[key].$op === 'link') {
					// Extract the parent key name (i.e., the entity being created)
					// @ts-expect-error todo
					// TODO: allow for arrays
					if (!Array.isArray(preQueryRes) && preQueryRes && preQueryRes[key] && !parseInt(key)) {
						// @ts-expect-error todo

						if (preQueryRes[key].$op !== 'link') {
							throw new Error(`You already have ${key} filled for this.`);
						}
					}
				}
			});
		});
	};
	newFilled = checkForFoundFields(newFilled);

	// 2. Cannot delete something that isn't in your targeted role
	const checkForDeleting = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) => {
			traverse(draft, (o) => {
				const { value } = o;
				const draftPath = o.meta.nodePath || '';
				// todo: include update, replace, and unlink
				if (value && typeof value === 'object' && value.$op === 'delete' && isObject(preQueryRes)) {
					let found = false;
					traverse(preQueryRes, ({ value: preValue, meta }) => {
						const prePath = meta.nodePath || '';
						const draftParentPath = JSON.stringify(draftPath.slice(0, -1));
						const preParentPath = JSON.stringify(prePath.slice(0, -1));
						if (draftParentPath === preParentPath && preValue === value.$id) {
							found = true;
							return false; // Exit the traversal once found
						}
					});
					if (!found) {
						const parent = get(draft, draftPath.slice(0, -1));
						const key = draftPath[draftPath.length - 1];
						// Remove the delete operation from the draft
						if (Array.isArray(parent)) {
							const index = parent.findIndex((item) => item === value);
							if (index > -1) {
								parent.splice(index, 1);
							}
						} else {
							// @ts-expect-error todo
							parent ? delete parent[key] : null;
						}
					}
				}
			});
		});
	};

	// 3. Check for operation types
	const checkForOperations = (blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[]) => {
		let hasReplace = false;
		let hasDelete = false;

		traverse(blocks, ({ value: val }) => {
			if (val.$op === 'replace') {
				hasReplace = true;
			}
			if (val.$op === 'delete') {
				hasDelete = true;
			}
			return true;
		});

		return { hasReplace, hasDelete };
	};

	const { hasReplace, hasDelete } = checkForOperations(newFilled);

	if (hasDelete) {
		newFilled = checkForDeleting(newFilled);
		// console.log('after deleting: ', JSON.stringify(newFilled, null, 2));
	}
	if (hasReplace) {
		const fillReplaces = (
			blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
		): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
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
						const matchingQueryObj = Array.isArray(preQueryRes)
							? // @ts-expect-error - todo
							  preQueryRes.find((item) => item.$id === parent.$id)
							: preQueryRes;
						// @ts-expect-error - todo
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
								// Remove $op: 'link' for id that is already present in preQueryRes
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

		newFilled = fillReplaces(newFilled);
	}

	// console.log('newFilled: ', JSON.stringify(newFilled, null, 2));

	req.filledBqlRequest = newFilled;
};
