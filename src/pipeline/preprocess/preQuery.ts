import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { FilledBQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';
import { current, original, produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';

// todo: nested replaces
// todo: nested deletions
export const preQueryPathSeparator = '___';

type ObjectPath = { beforePath: string; ids: string | string[]; key: string };
export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest, config } = req;

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

	if (
		!ops.includes('delete') &&
		!ops.includes('unlink') &&
		!ops.includes('replace') &&
		!ops.includes('update') &&
		!ops.includes('link')
	) {
		return;
	}

	let newFilled: FilledBQLMutationBlock | FilledBQLMutationBlock[] = filledBqlRequest as
		| FilledBQLMutationBlock
		| FilledBQLMutationBlock[];

	// 1. Convert mutation to Query
	// todo: create second set of queries to find if items to be linked exist in db
	const convertMutationToQuery = (blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[]) => {
		const processBlock = (block: FilledBQLMutationBlock, root?: boolean) => {
			const $fields: any[] = [];
			const filteredBlock = {};
			const toRemoveFromRoot = ['$op', '$bzId', '$parentKey'];
			const toRemove = ['$relation', '$entity', '$id', ...toRemoveFromRoot];
			for (const k in block) {
				if (toRemoveFromRoot.includes(k)) {
					continue;
				}
				if (toRemove.includes(k) && !root) {
					continue;
				}
				if (!k.includes('$') && (isObject(block[k]) || Array.isArray(block[k]))) {
					const v = block[k];
					if (Array.isArray(v) && v.length > 0) {
						$fields.push({ $path: k, ...processBlock(v[0]) });
					} else {
						$fields.push({ $path: k, ...processBlock(v) });
					}
				} else {
					// @ts-expect-error todo
					filteredBlock[k] = block[k];
				}
			}
			return { ...filteredBlock, $fields };
		};
		if (Array.isArray(blocks)) {
			return blocks.map((block) => processBlock(block, true));
		} else {
			return processBlock(blocks, true);
		}
	};

	const preQueryBlocks = convertMutationToQuery(filledBqlRequest as FilledBQLMutationBlock | FilledBQLMutationBlock[]);
	// console.log('preQueryBlocks: ', JSON.stringify(preQueryBlocks, null, 2));

	// 2. Perform pre-query and get response

	// @ts-expect-error - todo
	const preQueryRes = await queryPipeline(preQueryBlocks, req.config, req.schema, req.dbHandles);
	// console.log('preQueryRes: ', JSON.stringify(preQueryRes, null, 2));

	const getObjectPath = (parent: any, key: string) => {
		const idField: string | string[] = parent.$id || parent.id || parent.$bzId;
		if (parent.$objectPath) {
			const { $objectPath } = parent;

			const root = $objectPath.beforePath || 'root';
			const ids = Array.isArray($objectPath.ids) ? `[${$objectPath.ids}]` : $objectPath.ids;
			const final = `${root}.${ids}___${$objectPath.key}`;

			const new$objectPath = {
				beforePath: final,
				ids: idField,
				key,
			};
			return new$objectPath;
		} else {
			return {
				beforePath: 'root',
				ids: idField,
				key,
			};
		}

		// return `${parent.$objectPath || 'root'}${idField ? `.${idField}` : ''}${preQueryPathSeparator}${key}`;
	};

	const objectPathToKey = ($objectPath: ObjectPath, hardId?: string) => {
		const root = $objectPath.beforePath || 'root';
		const ids = hardId ? hardId : Array.isArray($objectPath.ids) ? `[${$objectPath.ids}]` : $objectPath.ids;

		const final = `${root}.${ids}___${$objectPath.key}`;
		return final;
	};

	// 3. Create cache of paths
	type Cache<K extends string, V extends string> = {
		[key in K]: V;
	};
	const cache: Cache<string, string> = {};
	const cachePaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, parent } = context;

				if (parent && key && parent.$id && !key.includes('$')) {
					const newObjPath = getObjectPath(parent, key);
					const cacheKey = objectPathToKey(newObjPath);
					if (Array.isArray(parent[key])) {
						// @ts-expect-error todo
						const cacheArray = [];
						// @ts-expect-error todo
						parent[key].forEach((val) => {
							if (isObject(val)) {
								// @ts-expect-error todo
								// eslint-disable-next-line no-param-reassign
								val.$objectPath = newObjPath;
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
							// @ts-expect-error todo
							// eslint-disable-next-line no-param-reassign
							val.$objectPath = newObjPath;
						} else if (val) {
							cache[cacheKey] = val.toString();
						}
					}
				}
			}),
		);
	};
	// @ts-expect-error todo
	cachePaths(preQueryRes || {});
	// console.log('cache: ', cache);

	// 4. Prune mutation
	const checkId = (
		path: string,
		id: string | string[],
	): { found: boolean; cardinality: 'ONE' | 'MANY'; isOccupied: boolean } => {
		let found: boolean = false;
		const cardinality = Array.isArray(cache[path]) ? 'MANY' : 'ONE';
		// @ts-expect-error todo
		const ids: string[] = Array.isArray(cache[path]) ? cache[path] : [cache[path]];
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
						parent[key].forEach(
							(o: string | { $objectPath: ObjectPath; $parentIsCreate: boolean; $grandChildOfCreate: boolean }) => {
								if (typeof o !== 'string') {
									// eslint-disable-next-line no-param-reassign
									o.$objectPath = getObjectPath(parent, key);
									// eslint-disable-next-line no-param-reassign
									o.$parentIsCreate = parent.$op === 'create';
									// eslint-disable-next-line no-param-reassign
									o.$grandChildOfCreate = parent.$parentIsCreate || parent.$grandChildOfCreate;
								}
							},
						);
					} else if (isObject(parent[key])) {
						parent[key].$parentIsCreate = parent.$op === 'create';
						parent[key].$grandChildOfCreate = parent.$parentIsCreate || parent.$grandChildOfCreate;
						parent[key].$objectPath = getObjectPath(parent, key);
					}
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
					const doNothing: any[] = [];
					const pathToThing = objectPathToKey(getObjectPath(parent, key));
					// const toAddAdjacent: any[] = [];

					values.forEach((thing) => {
						// todo: fetch the proper idField 'thing.color'
						const idField = thing.$id || thing.id;
						const { found, cardinality, isOccupied } = checkId(pathToThing, idField);
						if (thing.$op === 'link' && !found && cardinality === 'ONE' && isOccupied) {
							throw new Error(
								`[BQLE-Q-M-2] Cannot link on:"${objectPathToKey(thing.$objectPath)}" because it is already occupied.`,
							);
						}

						if (thing.$op) {
							switch (thing.$op) {
								case 'delete':
									if (thing.$parentIsCreate) {
										throw new Error('Cannot delete under a create');
									}
									if (!found && idField) {
										if (!config.mutation?.ignoreNonexistingThings) {
											throw new Error(
												`[BQLE-Q-M-2] Cannot delete $id:"${idField}" because it is not linked to $id:"${parent.$id}"`,
											);
										} else {
											doNothing.push(idField);
										}
									}
									break;
								case 'update':
									if (!found && idField) {
										if (!config.mutation?.ignoreNonexistingThings) {
											throw new Error(
												`[BQLE-Q-M-2] Cannot update $id:"${idField}" because it is not linked to $id:"${parent.$id}"`,
											);
										} else {
											doNothing.push(idField);
										}
									}
									break;
								case 'unlink':
									if (thing.$parentIsCreate) {
										throw new Error('Cannot unlink under a create');
									}
									if (!found && idField) {
										if (!config.mutation?.ignoreNonexistingThings) {
											throw new Error(
												`[BQLE-Q-M-2] Cannot unlink $id:"${idField}" because it is not linked to $id:"${parent.$id}"`,
											);
										} else {
											doNothing.push(idField);
										}
									}
									break;
								case 'link':
									if (found && idField) {
										throw new Error(
											`[BQLE-Q-M-2] Cannot link $id:"${idField}" because it is already linked to $id:"${parent.$id}"`,
										);
									}
									break;
								case 'replace':
									if (thing.$parentIsCreate) {
										throw new Error('Cannot replace under a create');
									}
									replaces.push(thing);
									// eslint-disable-next-line no-param-reassign
									thing.$op = 'link';
									if (found && idField) {
										doNothing.push(idField);
									}
									break;
								case 'create':
									if (!thing.$parentIsCreate && !thing.$grandChildOfCreate) {
										// todo: only for cardinality one
										replaces.push(thing);
									}
									break;
								default:
									break;
							}
						}
					});

					if (replaces.length > 0) {
						// @ts-expect-error todo
						const otherIds = getOtherIds(pathToThing, replaces);
						otherIds.forEach((id: string) => {
							const valueWithReplaceOp = values.find((thing) => thing.$id === id && thing.$op === 'link');
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

					const prunedOps: any = [];
					const toRemove: { $bzId: string; key: string }[] = [];

					values.forEach((thing) => {
						if (thing.$op === 'delete' && !thing.$id) {
							const cacheKey = objectPathToKey(thing.$objectPath);
							if (cache[cacheKey]) {
								const cachePath = Array.isArray(cache[cacheKey]) ? cache[cacheKey] : [cache[cacheKey]];
								const keysWithOps = Object.keys(thing).filter((o) => !o.startsWith('$'));
								// console.log('thing', current(thing));
								const parentSymbols = {
									[Symbol.for('relation') as any]: current(thing)[Symbol.for('relation') as any],
									[Symbol.for('edgeType') as any]: current(thing)[Symbol.for('edgeType') as any],
									[Symbol.for('parent') as any]: {
										...current(thing)[Symbol.for('parent') as any],
										// $id: ,
										// path: null,
									},
									[Symbol.for('role') as any]: current(thing)[Symbol.for('role') as any], // this is the currentChildren
									// this is the parent
									[Symbol.for('oppositeRole') as any]: current(thing)[Symbol.for('oppositeRole') as any],
									[Symbol.for('relFieldSchema') as any]: current(thing)[Symbol.for('relFieldSchema') as any],
									[Symbol.for('path') as any]: current(thing)[Symbol.for('path') as any],
									[Symbol.for('isRoot') as any]: current(thing)[Symbol.for('isRoot') as any],
									[Symbol.for('depth') as any]: current(thing)[Symbol.for('depth') as any],
									[Symbol.for('schema') as any]: current(thing)[Symbol.for('schema') as any],
									[Symbol.for('dbId') as any]: current(thing)[Symbol.for('dbId') as any],
									[Symbol.for('index') as any]: current(thing)[Symbol.for('index') as any],
								};
								// @ts-expect-error todo
								cachePath.forEach((id) => {
									const replaceKeys: any = {};
									keysWithOps.forEach((key) => {
										const cacheHas = cache[`${cacheKey}.${id}___${key}`];
										if (cacheHas) {
											const cacheHasArray = Array.isArray(cacheHas) ? cacheHas : [cacheHas];
											const thingKey = original(thing[key]);
											const newOps: any[] = [];
											cacheHasArray.forEach((_id) => {
												const $bzId = `T_${uuidv4()}`;
												const symbols = {
													[Symbol.for('relation') as any]: current(thing)[key][Symbol.for('relation') as any],
													[Symbol.for('edgeType') as any]: current(thing)[key][Symbol.for('edgeType') as any],
													[Symbol.for('parent') as any]: {
														...current(thing)[key][Symbol.for('parent') as any],
														$id: id,
														// path: null,
													},
													[Symbol.for('role') as any]: current(thing)[key][Symbol.for('role') as any], // this is the currentChildren
													// this is the parent
													[Symbol.for('oppositeRole') as any]: current(thing)[key][Symbol.for('oppositeRole') as any],
													[Symbol.for('relFieldSchema') as any]:
														current(thing)[key][Symbol.for('relFieldSchema') as any],
													[Symbol.for('path') as any]: current(thing)[key][Symbol.for('path') as any],
													[Symbol.for('isRoot') as any]: current(thing)[key][Symbol.for('isRoot') as any],
													[Symbol.for('depth') as any]: current(thing)[key][Symbol.for('depth') as any],
													[Symbol.for('schema') as any]: current(thing)[key][Symbol.for('schema') as any],
													[Symbol.for('dbId') as any]: current(thing)[key][Symbol.for('dbId') as any],
													[Symbol.for('index') as any]: current(thing)[key][Symbol.for('index') as any],
												};
												// console.log('symbols1: ', symbols);
												const newObj = {
													...(Array.isArray(thingKey) ? { ...thingKey[0] } : { ...thingKey }),
													$id: _id,
													$bzId,
													...symbols,
												};
												// if the object with delete already exists earlier in the mutation, it can't be deleted twice
												if (!`${cacheKey}.${id}___${key}`.includes(_id)) {
													newOps.push(newObj);
												}
											});
											replaceKeys[key] = Array.isArray(cacheHas) ? newOps : newOps[0];
										}
									});
									const thingWithOutKeys = Object.keys(thing)
										.filter((key) => key.startsWith('$')) // Keep only keys that start with '$'
										.reduce((newObj, key) => {
											// @ts-expect-error todo
											// eslint-disable-next-line no-param-reassign
											newObj[key] = thing[key]; // Add the filtered keys to the new object
											return newObj;
										}, {});

									const parentBzId = `T_${uuidv4()}`;
									// console.log('parentSymbols', parentSymbols);
									prunedOps.push({
										...thingWithOutKeys,
										...replaceKeys,
										$id: id,
										$bzId: parentBzId,
										...parentSymbols,
									});
								});
							} else {
								toRemove.push({ $bzId: thing.$bzId, key });
							}
						}
					});
					if (prunedOps.length > 0) {
						// @ts-expect-error todo
						let filtered = prunedOps.filter((o) => !doNothing.includes(o.$id));
						filtered = filtered.filter((o: any) => !toRemove.find((x) => x.$bzId === o.$bzId));
						parent[key] =
							filtered.length > 0 ? (isObject(value) && filtered.length === 1 ? filtered[0] : filtered) : undefined;
					} else {
						let filtered = values.filter((o) => !doNothing.includes(o.$id));
						filtered = filtered.filter((o) => !toRemove.find((x) => x.$bzId === o.$bzId));
						parent[key] =
							filtered.length > 0 ? (isObject(value) && filtered.length === 1 ? filtered[0] : filtered) : undefined;
					}
				}
			}),
		);
	};
	newFilled = prunedMutation(newFilled);

	const fillPaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { parent, key, value, meta } = context;
				if (isObject(value)) {
					// @ts-expect-error todo
					value[Symbol.for('path') as any] = meta.nodePath;
					// // @ts-expect-error todo
					// value.$_path = meta.nodePath;
					// @ts-expect-error todo
					delete value.$objectPath;
					// @ts-expect-error todo
					delete value.$parentIsCreate;
				}

				if (
					key &&
					parent &&
					!key?.includes('$') &&
					(Array.isArray(value) || isObject(value)) &&
					!Array.isArray(parent)
				) {
					const values = Array.isArray(value) ? value : [value];
					values.forEach((val) => {
						if (isObject(val)) {
							// @ts-expect-error todo
							// eslint-disable-next-line no-param-reassign
							val[Symbol.for('parent') as any] = {
								// @ts-expect-error todo
								...value[Symbol.for('parent') as any],
								path: parent[Symbol.for('path') as any],
							};
							// eslint-disable-next-line no-param-reassign
							// val.$_parentPath = parent[Symbol.for('path') as any];
						}
					});
				}
			}),
		);
	};
	newFilled = fillPaths(newFilled);

	// console.log('pruned: ', JSON.stringify(newFilled, null, 2));

	req.filledBqlRequest = newFilled;
};
