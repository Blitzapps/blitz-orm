import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { FilledBQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';

export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest } = req;
	const isBatchedMutation = Array.isArray(filledBqlRequest);
	if (isBatchedMutation) {
		return;
	}
	let newFilled: FilledBQLMutationBlock | FilledBQLMutationBlock[] = filledBqlRequest as
		| FilledBQLMutationBlock
		| FilledBQLMutationBlock[];
	// 1. Convert mutation to Query
	///console.log('filledBqlRequest: ', JSON.stringify(filledBqlRequest, null, 2));
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
	// console.log('preQueryBlocks: ', JSON.stringify(preQueryBlocks, null, 2));

	// 2. Perform pre-query and get response
	// @ts-expect-error - todo
	const preQueryRes = await queryPipeline(preQueryBlocks, req.config, req.schema, req.dbHandles);
	// console.log('preQueryRes: ', JSON.stringify(preQueryRes, null, 2));
	const getObjectPath = (parent: any, key: string) => {
		const idField = parent.$id || parent.id || parent.$bzId;
		return `${parent.$objectPath ? (idField ? parent.$objectPath : parent.$objectPath.split('.')[0]) : 'root'}${
			idField ? `-${idField}` : ''
		}.${key}`;
	};
	// The storePaths function traverses the blocks and assigns a unique object path to each child object.
	const storePaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, parent } = context;
				// If the parent and key exist and the key does not include '$', assign a unique object path to the child object.
				if (parent && key && !key.includes('$')) {
					if (Array.isArray(parent[key])) {
						parent[key].forEach((o: any) => {
							if (typeof o !== 'string') {
								// Assign a unique object path to the child object.
								o.$objectPath = getObjectPath(parent, key);
							}
						});
					} else if (isObject(parent[key])) {
						// Assign a unique object path to the child object.
						parent[key].$objectPath = getObjectPath(parent, key);
					}
				}
			}),
		);
	};
	// If preQueryRes exists, call the storePaths function with preQueryRes as the argument. Otherwise, return an empty object.
	const storedPaths = preQueryRes ? storePaths(preQueryRes) : {};
	type Cache<K extends string, V extends string> = {
		[key in K]: V;
	};
	// Initialize an empty cache object.
	const cache: Cache<string, string> = {};
	// The cachePaths function creates a cache of paths for each block.
	const cachePaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, parent } = context;
				// If the parent and key exist, the parent has an id, and the key does not include '$', proceed with caching the path.
				if (parent && key && parent.$id && !key.includes('$')) {
					const cacheKey = getObjectPath(parent, key);
					// If the parent's key is an array, create a cache array and add each value to it.
					if (Array.isArray(parent[key])) {
						const cacheArray = [];
						parent[key].forEach((val) => {
							if (isObject(val)) {
								cacheArray.push(val.$id.toString());
							} else {
								cacheArray.push(val.toString());
							}
						});
						// Add the cache array to the cache object with the cacheKey as the key.
						cache[cacheKey] = cacheArray;
					} else {
						// If the parent's key is not an array, add the value to the cache object with the cacheKey as the key.
						const val = parent[key];
						if (isObject(val)) {
							cache[cacheKey] = val.$id.toString();
						} else {
							cache[cacheKey] = val.toString();
						}
					}
				}
			}),
		);
	};
	// @ts-expect-error todo
	cachePaths(storedPaths);
	// console.log('cache: ', cache);

	// 5. Prune mutation

	const checkId = (
		path: string,
		id: string | string[],
	): { found: boolean; cardinality: 'ONE' | 'MANY'; isOccupied: boolean } => {
		// Initialize the found variable as false.
		let found: boolean = false;
		// Determine the cardinality based on whether the cache[path] is an array.
		const cardinality = Array.isArray(cache[path]) ? 'MANY' : 'ONE';
		// Get the ids from the cache using the path.
		const ids: string[] = Array.isArray(cache[path]) ? cache[path] : [cache[path]];

		// If ids exist, check if the id is found in the ids.
		if (ids) {
			const foundIds = !Array.isArray(id) ? ids.filter((o) => o === id) : ids.filter((o) => id.includes(o));
			found = foundIds.length > 0;
		}

		// Return an object containing the found status, cardinality, and whether the path is occupied in the cache.
		return { found, cardinality, isOccupied: cache[path] ? true : false };
	};
	// The getOtherIds function returns an array of ids that are not included in the replaces array.
	const getOtherIds = (path: string, replaces: { $id: string }[]): string[] => {
		// Initialize an empty array for otherIds.
		let otherIds: string[] = [];
		// Get the ids from the cache using the path.
		const ids: string[] = Array.isArray(cache[path]) ? cache[path] : [cache[path]];
		// Get the ids from the replaces array.
		const replacesIds = replaces.map((o) => o.$id);
		// If ids exist, filter out the ids that are included in the replacesIds.
		if (ids) {
			otherIds = ids.filter((o) => !replacesIds.includes(o));
		}

		// Return the otherIds array.
		return otherIds;
	};
	// The prunedMutation function prunes the mutation based on the pre-query response.
	const prunedMutation = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, value, parent } = context;
				if (
					parent &&
					key &&
					!key.includes('$') &&
					(Array.isArray(value) || isObject(value)) &&
					!Array.isArray(parent)
				) {
					if (Array.isArray(parent[key])) {
						parent[key].forEach((o: any) => {
							if (typeof o !== 'string') {
								// eslint-disable-next-line no-param-reassign
								o.$objectPath = getObjectPath(parent, key);
							}
						});
					} else if (isObject(parent[key])) {
						parent[key].$objectPath = getObjectPath(parent, key);
					}
					// console.log('after paths: ', JSON.stringify(parent[key], null, 2));
				}
				// a. only work for role fields that are arrays or objects
				if (
					key &&
					parent &&
					!key?.includes('$') &&
					(Array.isArray(value) || isObject(value)) &&
					!Array.isArray(parent)
				) {
					let values = Array.isArray(value) ? value : [value];

					const currentEntityOrRelation: { $entity?: string; $relation?: string } = {};
					// @ts-expect-error todo
					const replaces = [];
					// @ts-expect-error todo
					const doNothing = [];
					const pathToThing = getObjectPath(parent, key);

					values.forEach((thing) => {
						// todo: fetch the proper idField 'thing.color'
						const idField = thing.$id || thing.id;
						const { found, cardinality, isOccupied } = checkId(pathToThing, idField);

						if (thing.$op && idField) {
							switch (thing.$op) {
								case 'delete':
									if (!found) {
										throw new Error(
											`[BQLE-Q-M-2] Cannot delete $id:"${idField}" because it is not linked to $id:"${parent.$id}"`,
										);
									}
									break;
								case 'update':
									if (!found) {
										throw new Error(
											`[BQLE-Q-M-2] Cannot update $id:"${idField}" because it is not linked to $id:"${parent.$id}"`,
										);
									}
									break;

								case 'unlink':
									if (!found) {
										throw new Error(
											`[BQLE-Q-M-2] Cannot unlink $id:"${idField}" because it is not linked to $id:"${parent.$id}"`,
										);
									}
									break;

								case 'link':
									if (found) {
										throw new Error(
											`[BQLE-Q-M-2] Cannot link $id:"${idField}" because it is already linked to $id:"${parent.$id}"`,
										);
									}
									break;
								case 'replace':
									replaces.push(thing);
									// eslint-disable-next-line no-param-reassign
									thing.$op = 'link';

									if (found) {
										doNothing.push(idField);
									}
									break;

								case 'create':
									// todo: only for cardinality one
									// eslint-disable-next-line no-param-reassign
									replaces.push(thing);
									break;

								default:
									break;
							}
						} else if (thing.$op === 'link' && !found && cardinality === 'ONE' && isOccupied) {
							throw new Error(`[BQLE-Q-M-2] Cannot link on:"${thing.$objectPath}" because it is already occupied.`);
						}

						// eslint-disable-next-line no-param-reassign
					});
					if (replaces.length > 0) {
						// @ts-expect-error todo
						const otherIds = getOtherIds(pathToThing, replaces);
						// console.log('otherIds: ', JSON.stringify({ otherIds, pathToThing }, null, 2));

						otherIds.forEach((id: string) => {
							const valueWithReplaceOp = values.find((thing) => thing.$id === id && thing.$op === 'link');
							// console.log('valueWithReplaceOp: ', JSON.stringify({ valueWithReplaceOp, queryVal }, null, 2));
							// Capture the current entity or relation
							// @ts-expect-error todo
							const [firstThing] = replaces;
							if (firstThing.$entity) {
								currentEntityOrRelation.$entity = firstThing.$entity;
							} else if (firstThing.$relation) {
								currentEntityOrRelation.$relation = firstThing.$relation;
							}
							if (!valueWithReplaceOp && !values.some((thing) => thing.$id === id)) {
								const unlinkOp = {
									...currentEntityOrRelation,
									$op: 'unlink',
									$id: id,
									$bzId: `T_${uuidv4()}`,
								};
								if (Array.isArray(value)) {
									value.push(unlinkOp);
								} else {
									// eslint-disable-next-line no-param-reassign
									values = [value, unlinkOp];
								}
							} else if (valueWithReplaceOp) {
								// Remove $op: 'link' for id that is already present in preQueryRes
								const index = values.findIndex((thing) => thing.$id === id && thing.$op === 'link');
								if (index > -1) {
									values.splice(index, 1);
								}
							}
						});
					}
					// @ts-expect-error todo
					const filtered = values.filter((o) => !doNothing.includes(o.$id));
					parent[key] = isObject(value) && filtered.length === 1 ? filtered[0] : filtered;
				}
			}),
		);
	};
	if (preQueryRes) {
		newFilled = prunedMutation(newFilled);
		///console.log('pruned: ', JSON.stringify(newFilled, null, 2));
		req.filledBqlRequest = newFilled;
	}
};
