import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { FilledBQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';

export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest, config } = req;
	const isBatchedMutation = Array.isArray(filledBqlRequest);

	///0 ignore this step if its a batched mutation or if it does not have deletions or unlinks
	if (!filledBqlRequest) {
		throw new Error('[BQLE-M-0] No filledBqlRequest found');
	}

	const ops: string[] = [];
	traverse(filledBqlRequest, ({ key, value }) => {
		if (key === '$op') {
			if (!ops.includes(value)) {
				ops.push(value);
			}
		}
	});

	if (config.mutation?.preQuery === false) {
		if (ops.includes('replace')) {
			throw new Error('[BQLE-M-4] Cannot replace without preQuery=true');
		}
		return;
	}

	if (!ops.includes('delete') && !ops.includes('unlink') && !ops.includes('replace')) {
		return;
	}

	///temporally skipping batchedMutations
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
	// 3. Store paths on each child object
	const storePaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, parent } = context;
				// console.log('info: ', JSON.stringify({ key, parent }, null, 2));
				if (parent && key && !key.includes('$')) {
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
				}
			}),
		);
	};
	// @ts-expect-error todo
	const storedPaths = preQueryRes ? storePaths(preQueryRes) : {};
	// console.log('storedPaths: ', JSON.stringify(storedPaths, null, 2));
	type Cache<K extends string, V extends string> = {
		[key in K]: V;
	};
	const cache: Cache<string, string> = {};
	// 4. Create cache of paths
	const cachePaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, parent } = context;
				if (parent && key && parent.$id && !key.includes('$')) {
					const cacheKey = getObjectPath(parent, key);
					if (Array.isArray(parent[key])) {
						// @ts-expect-error todo
						const cacheArray = [];
						// @ts-expect-error todo
						parent[key].forEach((val) => {
							if (isObject(val)) {
								// @ts-expect-error todo
								cacheArray.push(val.$id.toString());
							} else if (val) {
								cacheArray.push(val.toString());
							}
						});
						// @ts-expect-error todo
						cache[cacheKey] = cacheArray;
					} else {
						const val = parent[key];
						if (isObject(val)) {
							// @ts-expect-error todo
							cache[cacheKey] = val.$id.toString();
						} else if (val) {
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
		let found: boolean = false;
		const cardinality = Array.isArray(cache[path]) ? 'MANY' : 'ONE';
		// @ts-expect-error todo
		const ids: string[] = Array.isArray(cache[path]) ? cache[path] : [cache[path]];
		// const ids: string[] = cache[path];

		// console.log('paths: ', JSON.stringify({ path, id, ids }, null, 2));

		if (ids) {
			const foundIds = !Array.isArray(id) ? ids.filter((o) => o === id) : ids.filter((o) => id.includes(o));
			found = foundIds.length > 0;
		}

		return { found, cardinality, isOccupied: cache[path] ? true : false };
	};
	const getOtherIds = (path: string, replaces: { $id: string }[]): string[] => {
		let otherIds: string[] = [];
		// @ts-expect-error todo
		const ids: string[] = Array.isArray(cache[path]) ? cache[path] : [cache[path]];

		// console.log('paths: ', JSON.stringify({ ids }, null, 2));
		const replacesIds = replaces.map((o) => o.$id);
		if (ids) {
			otherIds = ids.filter((o) => !replacesIds.includes(o));
		}

		return otherIds;
	};
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
