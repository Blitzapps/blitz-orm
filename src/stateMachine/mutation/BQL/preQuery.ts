/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type {
	BormConfig,
	DBHandles,
	EnrichedBQLMutationBlock,
	EnrichedBormSchema,
	FilledBQLMutationBlock,
} from '../../../types';
import { getCardinality, getCurrentSchema, getSymbols } from '../../../helpers';
import { v4 as uuidv4 } from 'uuid';
import { queryPipeline } from '../../../pipeline/pipeline';

export const preQueryPathSeparator = '___';
type ObjectPath = { beforePath: string; ids: string | string[]; key: string };

const grandChildOfCreateSymbol = Symbol.for('grandChildOfCreate');

export const mutationPreQuery = async (
	blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	dbHandles: DBHandles,
) => {
	//console.log('beforePreQuery', JSON.stringify(blocks, null, 2));
	const getFieldKeys = (block: FilledBQLMutationBlock | Partial<FilledBQLMutationBlock>, noDataFields?: boolean) => {
		return Object.keys(block).filter((key) => {
			if (!key.startsWith('$') && block[key] !== undefined) {
				if (noDataFields) {
					const currentSchema = getCurrentSchema(schema, block);
					if (currentSchema.dataFields?.find((field) => field.path === key)) {
						// console.log('key is df', key);
						return false;
					} else {
						return true;
					}
				} else {
					return true;
				}
			} else {
				return false;
			}
		});
	};

	if (!blocks) {
		throw new Error('[BQLE-M-PQ-1] No blocks found');
	}

	// console.log('filledBql: ', JSON.stringify(blocks, null, 2));

	// 1. Check config for pre-query === true
	// todo: If false, remove the replace conversion in enrich step
	if (config.mutation?.preQuery === false) {
		return;
	}

	// 2. Check operations to make sure they include: Delete, Unlink, Link, Replace, Updater
	const ops: string[] = [];

	traverse(blocks, ({ parent, key, value }) => {
		// if (key === '$op') {
		// 	if (!ops.includes(value) && parent) {
		// 		ops.push(value);
		// 	}
		// }
		if (parent && key && !key.includes('$') && isObject(parent)) {
			const values = Array.isArray(parent[key]) ? parent[key] : [parent[key]];
			// @ts-expect-error todo
			values.forEach((val) => {
				if (isObject(val)) {
					if (parent.$op !== 'create') {
						// @ts-expect-error todo
						if (!ops.includes(val.$op)) {
							// @ts-expect-error todo
							ops.push(val.$op);
						}
					} else {
						// @ts-expect-error todo
						if (val.$op === 'delete' || val.$op === 'unlink') {
							// @ts-expect-error todo
							throw new Error(`Cannot ${val.$op} under a create`);
						}
					}
				}
			});
		} else if (!parent && isObject(value)) {
			// @ts-expect-error todo
			if (!ops.includes(value.$op)) {
				// @ts-expect-error todo
				ops.push(value.$op);
			}
		}
	});

	if (
		!ops.includes('delete') &&
		!ops.includes('unlink') &&
		!ops.includes('replace') &&
		!ops.includes('update') &&
		!ops.includes('link')
	) {
		return;
	}

	const convertMutationToQuery = (blocks: FilledBQLMutationBlock[]) => {
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
						v.forEach((opBlock) => {
							// const includedKeys = Object.keys(opBlock)
							// 	.filter((o) => !o.startsWith('$'))
							// 	.join('__');

							$fields.push({
								$path: k,
								...processBlock(opBlock),
								// $as: opBlock.$bzId,
								// $as: `${k}_${includedKeys}`,
							});
						});
					} else {
						$fields.push({
							$path: k,
							...processBlock(v),
							// $as: v.$bzId,
						});
					}
				} else {
					// @ts-expect-error todo
					filteredBlock[k] = block[k];
				}
			}
			return {
				...filteredBlock,
				$fields,
				// $as: block.$bzId,
			};
		};
		return blocks.map((block) => processBlock(block, true));
	};

	const preQueryReq = convertMutationToQuery(Array.isArray(blocks) ? blocks : [blocks]);

	// console.log('preQueryReq', JSON.stringify(preQueSryReq, null, 2));

	// @ts-expect-error todo
	const preQueryRes = await queryPipeline(preQueryReq, config, schema, dbHandles);
	// console.log('preQueryRes', JSON.stringify(preQueryRes, null, 2));

	const getObjectPath = (parent: any, key: string) => {
		const idField: string | string[] = parent.$id || parent.id || parent.$bzId;
		if (parent.$objectPath) {
			const { $objectPath } = parent;

			const root = $objectPath?.beforePath || 'root';
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
		const root = $objectPath?.beforePath || 'root';
		const ids = hardId ? hardId : Array.isArray($objectPath?.ids) ? `[${$objectPath?.ids}]` : $objectPath?.ids;

		const final = `${root}.${ids}___${$objectPath?.key}`;
		return final;
	};

	const convertManyPaths = (input: string) => {
		// Check if the string contains square brackets
		if (input.includes('[') && input.includes(']')) {
			// Extract the part before the brackets, the items within the brackets, and the part after the brackets
			const [prefix, itemsWithBrackets, suffix] = input.split(/[[\]]/);
			const items = itemsWithBrackets.split(',');

			// Combine each item with the prefix and suffix and return the array
			return items.map((item) => `${prefix}${item}${suffix}`);
		} else {
			// If no brackets are present, return an array with the original string
			return [input];
		}
	};

	// 3. Create cache of paths
	type Cache<K extends string> = {
		[key in K]: {
			$objectPath: ObjectPath;
			$ids: string[];
		};
	};
	const cache: Cache<string> = {};
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
						cache[cacheKey] = { $objectPath: newObjPath, $ids: cacheArray };
					} else {
						const val = parent[key];
						if (isObject(val)) {
							// @ts-expect-error todo
							cache[cacheKey] = { $objectPath: newObjPath, $ids: [val.$id.toString()] };

							// @ts-expect-error todo
							// eslint-disable-next-line no-param-reassign
							val.$objectPath = newObjPath;
						} else if (val) {
							cache[cacheKey] = { $objectPath: newObjPath, $ids: [val.toString()] };
						}
					}
				}
			}),
		);
	};
	//@ts-expect-error - todo
	cachePaths(preQueryRes || {});

	// console.log('cache', JSON.stringify(cache, null, 2));

	const fillObjectPaths = (
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
							(
								o: string | { $objectPath: ObjectPath; $parentIsCreate: boolean; [grandChildOfCreateSymbol]: boolean },
							) => {
								if (typeof o !== 'string') {
									// eslint-disable-next-line no-param-reassign
									o.$objectPath = getObjectPath(parent, key);
									// eslint-disable-next-line no-param-reassign
									o.$parentIsCreate = parent.$op === 'create';
									// eslint-disable-next-line no-param-reassign
									o[grandChildOfCreateSymbol] =
										parent.$parentIsCreate || parent[Symbol.for('grandChildOfCreate') as any];
								}
							},
						);
					} else if (isObject(parent[key])) {
						parent[key].$parentIsCreate = parent.$op === 'create';
						parent[key][Symbol.for('grandChildOfCreate')] =
							parent.$parentIsCreate || parent[Symbol.for('grandChildOfCreate') as any];
						parent[key].$objectPath = getObjectPath(parent, key);
					}
				}
			}),
		);
	};

	const bqlWithObjectPaths = fillObjectPaths(blocks);

	const fillIds = (blocks: FilledBQLMutationBlock[]) => {
		const newBlocks: FilledBQLMutationBlock[] = [];
		blocks.forEach((block) => {
			if (!block.$id && !block.id && !block.$tempId) {
				const cacheKey = objectPathToKey(block.$objectPath);
				const cacheFound = cache[cacheKey];
				// console.log('cacheKey: ', JSON.stringify({ cacheKey, cacheFound }, null, 2));
				if (cacheFound) {
					cacheFound?.$ids.forEach((id) => {
						const newBlock = { ...block, $id: id, $bzId: `T4_${uuidv4()}` };
						newBlocks.push(newBlock);
					});
				} else {
					newBlocks.push(block);
				}
			} else {
				newBlocks.push(block);
			}
		});

		const finalBlocks = newBlocks.map((block) => {
			const newBlock = { ...block };
			getFieldKeys(newBlock, true).forEach((key) => {
				const subBlocks = Array.isArray(newBlock[key]) ? newBlock[key] : [newBlock[key]];
				const newSubBlocks = fillIds(subBlocks);
				newBlock[key] = newSubBlocks;
			});
			return newBlock;
		});
		return finalBlocks;
	};
	// console.log('filledBql', JSON.stringify([blocks], null, 2));

	const bqlFilledIds = fillIds(Array.isArray(bqlWithObjectPaths) ? bqlWithObjectPaths : [bqlWithObjectPaths]);

	// console.log('bqlFilledIds', JSON.stringify(bqlFilledIds, null, 2));

	const newFilled = fillObjectPaths(bqlFilledIds);

	// console.log('newFilled', JSON.stringify(newFilled, null, 2));

	const splitBzIds = (blocks: FilledBQLMutationBlock[]) => {
		const processBlocks = (blocks: FilledBQLMutationBlock[]) => {
			// 2. Get all combinations for operations with multiples
			// 2a. Filter operations with multiples and operations without multiples
			const getOperationsWithMultiples = (opBlocks: FilledBQLMutationBlock[]) => {
				const operationWithMultiples: FilledBQLMutationBlock[] = [];
				const operationWithoutMultiples: FilledBQLMutationBlock[] = [];
				const otherOps: FilledBQLMutationBlock[] = [];

				opBlocks.forEach((opBlock) => {
					const keys = getFieldKeys(opBlock, true);
					if (keys.length > 0) {
						let hasMultiple = false;
						keys.forEach((key) => {
							const opBlocks: FilledBQLMutationBlock[] = Array.isArray(opBlock[key]) ? opBlock[key] : [opBlock[key]];

							// todo: check for $filters
							const blockMultiples: FilledBQLMutationBlock[] = opBlocks.filter(
								(_opBlock) => !_opBlock.$id && !_opBlock.id && typeof opBlock === 'object',
							);
							if (blockMultiples.length) {
								hasMultiple = true;
							}
						});
						if (hasMultiple) {
							operationWithMultiples.push(opBlock);
						} else {
							operationWithoutMultiples.push(opBlock);
						}
					} else {
						otherOps.push({ ...opBlock, $bzId: `T_${uuidv4()}` });
					}
				});
				return { operationWithMultiples, operationWithoutMultiples, otherOps };
			};
			const { operationWithMultiples, operationWithoutMultiples, otherOps } = getOperationsWithMultiples(blocks);
			// console.log('filtered blocks: ', JSON.stringify({ operationWithMultiples, operationWithoutMultiples }, null, 2));
			// 2b. For multiples get all possible combinations
			const getAllKeyCombinations = (obj: FilledBQLMutationBlock) => {
				const getDataFields = () => {
					const dataFieldObj: any = {};
					for (const key in obj) {
						const currentSchema = getCurrentSchema(schema, obj);
						if (!key.startsWith('$') && currentSchema.dataFields?.find((df) => df.path === key)) {
							dataFieldObj[key] = obj[key];
						}
					}
					return dataFieldObj;
				};
				const dataFieldObj = getDataFields();

				// Get all keys, but only use non-$ keys for generating combinations
				const allKeys = Object.keys(obj);
				const combinableKeys = getFieldKeys(obj, true);
				const allCombinations: Partial<FilledBQLMutationBlock>[] = [];
				const generateCombinations = (index: number, currentObj: Partial<FilledBQLMutationBlock>) => {
					if (index === combinableKeys.length) {
						// Construct the full object with the current id
						const fullObj = { ...currentObj };
						allKeys.forEach((key) => {
							if (key.startsWith('$')) {
								fullObj[key] = obj[key];
							}
						});
						allCombinations.push({ ...fullObj, ...dataFieldObj });
						return;
					}

					// Include the current key
					const newObjInclude = {
						...currentObj,
						[combinableKeys[index]]: obj[combinableKeys[index]],
						...getSymbols(currentObj),
						...dataFieldObj,
					};
					generateCombinations(index + 1, newObjInclude);
					// Exclude the current key and move to the next
					generateCombinations(index + 1, currentObj);
				};
				generateCombinations(0, { ...getSymbols(obj) });
				return allCombinations;
			};
			const crossReferencedOperations: Partial<FilledBQLMutationBlock>[] = [];
			operationWithMultiples.forEach((multipleBlock) => {
				const allCombinations: Partial<FilledBQLMutationBlock>[] = getAllKeyCombinations(multipleBlock);
				const combinationsToKeep: Partial<FilledBQLMutationBlock>[] = [];
				// 2c. Check cache and prune combinations that don't have any ids in the cache
				allCombinations.forEach((combinationBlock) => {
					const keys = getFieldKeys(combinationBlock, true);

					if (combinationBlock.$op === 'create') {
						// console.log('Case 1: ', JSON.stringify(combinationBlock, null, 2));

						combinationsToKeep.push(combinationBlock);
					} else if (combinationBlock.$id) {
						// combinationsToKeep.push(combinationBlock);

						// console.log('Case 2: ', JSON.stringify(combinationBlock, null, 2));
						// check result for if there exists one with the kinds of keys
						const cacheKey = objectPathToKey(combinationBlock.$objectPath);
						const foundKeys: { key: string; ids: string[] }[] = [];
						keys.forEach((key) => {
							const childKey = `${cacheKey.includes('undefined') ? 'root' : cacheKey}.${combinationBlock.$id}${preQueryPathSeparator}${key}`;
							const cacheFound = cache[childKey];
							if (cacheFound) {
								foundKeys.push({ key, ids: cacheFound.$ids });
							}
						});
						if (foundKeys.length === keys.length && !combinationsToKeep.find((c) => c.$id === combinationBlock.$id)) {
							combinationsToKeep.push(combinationBlock);
						} else {
							// only prune the child batched operation
							const newBlock = { ...combinationBlock, $bzId: `T4_${uuidv4()}` };
							keys.forEach((key) => {
								// keeping ops that aren't batched (non-multiples)
								const newOps = combinationBlock[key].filter((op: FilledBQLMutationBlock) => op.$id);
								if (newOps.length > 0) {
									// @ts-expect-error todo
									newBlock[key] = newOps;
								} else {
									// @ts-expect-error todo
									newBlock[key] = undefined;
								}
							});
							const newBlockKeys = getFieldKeys(newBlock, true);
							if (newBlockKeys.length > 0) {
								combinationsToKeep.push(newBlock);
							}
						}
					}
					// When the block is not from the root level
					else if (combinationBlock.$objectPath) {
						// console.log('Case 3: ', JSON.stringify(combinationBlock, null, 2));
						const parentKey = objectPathToKey(combinationBlock.$objectPath);
						// a. get all ids of the parent block
						const idsOfParent = cache[parentKey]?.$ids || [];
						idsOfParent.forEach((id) => {
							const foundKeys: { key: string; ids: string[] }[] = [];
							keys.forEach((key) => {
								const cacheKey = `${parentKey}.${id}${preQueryPathSeparator}${key}`;
								const cacheFound = cache[cacheKey];
								if (cacheFound) {
									foundKeys.push({ key, ids: cacheFound.$ids });
								}
							});

							// If this is the combination with no keys, create an opBlock per remaining $id
							if (keys.length === 0) {
								const remainingIds = idsOfParent.filter((id) => !combinationsToKeep.find((c) => c.$id === id));
								remainingIds.forEach((id) => {
									combinationsToKeep.push({
										...combinationBlock,
										$id: id,
										$bzId: `T_${uuidv4()}`,
									});
								});
							} else if (foundKeys.length === keys.length && !combinationsToKeep.find((c) => c.$id === id)) {
								combinationsToKeep.push({
									...combinationBlock,
									$id: id,
									$bzId: `T_${uuidv4()}`,
								});
							}
						});
					} else {
						// console.log('Case 4: ', JSON.stringify(combinationBlock, null, 2));
						combinationsToKeep.push(combinationBlock);
					}
				});
				combinationsToKeep.forEach((c) => {
					crossReferencedOperations.push(c);
				});
			});
			// console.log(
			// 	'operation: ',
			// 	JSON.stringify({ crossReferencedOperations, operationWithoutMultiples, otherOps }, null, 2),
			// );
			// filter out odd leftover cases
			const allOperations = [...crossReferencedOperations, ...operationWithoutMultiples, ...otherOps];
			// console.log('allOperations', JSON.stringify(allOperations, null, 2));
			const filteredOperations = allOperations.filter((b) => {
				const hasKeys = getFieldKeys(b).length > 0;
				if (hasKeys) {
					return true;
				} else {
					if (b.$op === 'update') {
						return false;
					} else {
						return true;
					}
				}
			});

			// 3. Recursion
			const finalBlocks = filteredOperations.map((block) => {
				const newBlock = { ...block };
				getFieldKeys(newBlock, true).forEach((key) => {
					const subBlocks = Array.isArray(newBlock[key]) ? newBlock[key] : [newBlock[key]];
					const newSubBlocks = processBlocks(subBlocks);
					newBlock[key] = newSubBlocks;
				});
				return newBlock;
			});

			return finalBlocks;
		};
		return processBlocks(blocks);
	};

	const splitBql = splitBzIds(Array.isArray(newFilled) ? newFilled : [newFilled]);
	// console.log('splitBql', JSON.stringify(splitBql, null, 2));

	const processReplaces = (blocks: FilledBQLMutationBlock[]) => {
		return blocks.map((block) => {
			const fields = getFieldKeys(block, true);
			const newBlock = { ...block };

			fields.forEach((field) => {
				const opBlocks: FilledBQLMutationBlock[] = Array.isArray(block[field]) ? block[field] : [block[field]];
				const newOpBlocks: FilledBQLMutationBlock[] = [];
				let replaceIds: string[] = [];
				let createIds: string[] = [];

				// todo: Step 1, get all replaces and their ids as replaceIds, just push blocks that aren't replaces
				// @ts-expect-error todo
				let replaceBlock: FilledBQLMutationBlock = {};
				const cardinality = getCardinality(schema, block, field);

				opBlocks
					.filter((opBlock) => opBlock)
					.forEach((opBlock) => {
						// todo: if it is create and this field is cardinality one
						if (opBlock.$op === 'replace' && opBlock.$id) {
							// eslint-disable-next-line prefer-destructuring
							replaceBlock = opBlock;
							if (Array.isArray(opBlock.$id)) {
								replaceIds = [...replaceIds, ...opBlock.$id];
							} else {
								replaceIds.push(opBlock.$id);
							}
						} else if (opBlock.$op === 'create' && cardinality === 'ONE' && opBlock.id) {
							replaceBlock = opBlock;
							if (Array.isArray(opBlock.id)) {
								createIds = [...replaceIds, ...opBlock.id];
							} else {
								createIds.push(opBlock.id);
							}
						} else {
							newOpBlocks.push(opBlock);
						}
					});

				const cacheKey = objectPathToKey(replaceBlock.$objectPath);
				const cacheKeys = convertManyPaths(cacheKey);
				// console.log('cacheKey: ', JSON.stringify({ cacheKey, cacheKeys }, null, 2));

				const foundKeys = cacheKeys.map((cacheKey) => {
					return cache[cacheKey];
				});

				// todo: Step 2, get cacheIds for this
				let cacheIds: string[] = [];
				foundKeys
					.filter((k) => k !== null && k !== undefined)
					.forEach((key) => {
						cacheIds = [...cacheIds, ...key.$ids];
					});

				// todo: Step 3, unlinkIds contain all cacheIds that aren't found in replaceIds
				// todo: Step 4, linkIds are all replaceIds that aren't found in the cacheIds
				const unlinkIds = cacheIds.filter((id) => !replaceIds.includes(id));
				const linkIds = replaceIds.filter((id) => !cacheIds.includes(id));
				const symbols = getSymbols(replaceBlock);
				if (unlinkIds.length > 0) {
					newOpBlocks.push({
						...replaceBlock,
						$op: 'unlink',
						$id: unlinkIds,
						$bzId: `T4_${uuidv4()}`,
						id: undefined,
						...symbols,
					});
				}
				if (linkIds.length > 0) {
					linkIds.forEach((id) => {
						newOpBlocks.push({
							...replaceBlock,
							$op: 'link',
							$id: id,
							$bzId: `T5_${uuidv4()}`,
							...symbols,
						});
					});
				}
				if (createIds.length > 0) {
					createIds.forEach((id) => {
						newOpBlocks.push({
							...replaceBlock,
							$op: 'create',
							id,
							$bzId: `T6_${uuidv4()}`,
							...symbols,
						});
					});
				}

				newBlock[field] = processReplaces(newOpBlocks);
			});
			return newBlock;
		});
	};

	// @ts-expect-error todo
	const processedReplaces = fillObjectPaths(processReplaces(fillObjectPaths(splitBql)));

	// console.log('processedReplaces', JSON.stringify(processedReplaces, null, 2));

	const throwErrors = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { key, value, parent } = context;

				// a. only work for role fields that are arrays or objects
				if (
					key &&
					parent &&
					!key?.includes('$') &&
					(Array.isArray(value) || isObject(value)) &&
					!Array.isArray(parent)
				) {
					const values: FilledBQLMutationBlock[] = Array.isArray(value) ? value : [value];

					values.forEach((thing) => {
						// todo: If user op is trying to link something that already has it's role filled by something else

						const cacheFound = cache[objectPathToKey(thing.$objectPath)];

						const processArrayIdsFound = (arrayOfIds: string[], cacheOfIds: string[]) => {
							return arrayOfIds.every((id) => cacheOfIds.includes(id));
						};

						const isOccupied = thing.$id
							? Array.isArray(thing.$id)
								? processArrayIdsFound(thing.$id, cacheFound ? cacheFound.$ids : [])
								: cacheFound?.$ids.includes(thing.$id)
							: cacheFound;
						const cardinality = getCardinality(schema, parent, thing.$objectPath.key);

						if (thing.$op === 'link' && isOccupied && cardinality === 'ONE') {
							throw new Error(
								`[BQLE-Q-M-2] Cannot link on:"${objectPathToKey(thing.$objectPath)}" because it is already occupied.`,
							);
						}

						if (thing.$op) {
							switch (thing.$op) {
								case 'delete':
									if (!isOccupied) {
										if (!config.mutation?.ignoreNonexistingThings) {
											throw new Error(
												`[BQLE-Q-M-2] Cannot delete $id:"${thing.$id}" because it is not linked to $id:"${parent.$id}"`,
											);
										} else {
											// todo: prune
										}
									}
									break;
								case 'update':
									if (!isOccupied) {
										if (!config.mutation?.ignoreNonexistingThings) {
											throw new Error(
												`[BQLE-Q-M-2] Cannot update $id:"${thing.$id}" because it is not linked to $id:"${parent.$id}"`,
											);
										}
									}
									break;
								case 'unlink':
									if (!isOccupied) {
										if (!config.mutation?.ignoreNonexistingThings) {
											throw new Error(
												`[BQLE-Q-M-2] Cannot unlink $id:"${thing.$id}" because it is not linked to $id:"${parent.$id}"`,
											);
										}
									}
									break;
								case 'link':
									if (isOccupied) {
										throw new Error(
											`[BQLE-Q-M-2] Cannot link $id:"${thing.$id}" because it is already linked to $id:"${parent.$id}"`,
										);
									}
									break;

								default:
									break;
							}
						}
					});
				}
			}),
		);
	};

	throwErrors(processedReplaces);

	const fillPaths = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, (context) => {
				const { value, meta } = context;
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
			}),
		);
	};

	const final = fillPaths(processedReplaces);
	//console.log('post-preQuery', JSON.stringify(final, null, 2));

	return final;
};
