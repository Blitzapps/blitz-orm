import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { FilledBQLMutationBlock } from '../../../types';
import { getCurrentSchema, getCardinality, getSymbols } from '../../../helpers';
import { queryPipeline, type PipelineOperation } from '../../pipeline';

export const preQueryPathSeparator = '___';
type ObjectPath = { beforePath: string; ids: string | string[]; key: string };

const grandChildOfCreateSymbol = Symbol.for('grandChildOfCreate');

export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest, config, schema } = req;

	//console.log('filledBqlRequest', JSON.stringify(filledBqlRequest, null, 2));

	const getFieldKeys = (block: Partial<FilledBQLMutationBlock>, noDataFields?: boolean) => {
		return Object.keys(block).filter((key) => {
			if (!key.startsWith('$')) {
				if (noDataFields) {
					const currentSchema = getCurrentSchema(schema, block);
					if (!currentSchema.dataFields?.find((field) => field.path === key)) {
						return true;
					} else {
						return false;
					}
				} else {
					return true;
				}
			} else {
				return false;
			}
		});
	};

	if (!filledBqlRequest) {
		throw new Error('[BQLE-M-PQ-1] No filledBqlRequest found');
	}

	// console.log('filledBql: ', JSON.stringify(filledBqlRequest, null, 2));

	// 1. Check config for pre-query === true
	// todo: If false, remove the replace conversion in enrich step
	if (config.mutation?.preQuery === false) {
		return;
	}

	// 2. Check operations to make sure they include: Delete, Unlink, Link, Replace, Updater
	const ops: string[] = [];

	traverse(filledBqlRequest, ({ parent, key, value }) => {
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

	if (ops.filter((op) => ['delete', 'unlink', 'replace', 'update', 'link'].includes(op)).length === 0) {
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
							$fields.push({
								$path: k,
								...processBlock(opBlock),
							});
						});
					} else {
						$fields.push({
							$path: k,
							...processBlock(v),
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
			};
		};
		return blocks.map((block) => processBlock(block, true));
	};

	const preQueryReq = convertMutationToQuery(Array.isArray(filledBqlRequest) ? filledBqlRequest : [filledBqlRequest]);

	// console.log('preQueryReq', JSON.stringify(preQueryReq, null, 2));

	// @ts-expect-error todo
	const preQueryRes = await queryPipeline(preQueryReq, req.config, req.schema, req.dbHandles);
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
	// @ts-expect-error todo
	cachePaths(preQueryRes || {});

	console.log('cache', JSON.stringify(cache, null, 2));

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

	const bqlWithObjectPaths = fillObjectPaths(filledBqlRequest);

	console.log('bqlWithObjectPaths', JSON.stringify(bqlWithObjectPaths, null, 2));

	const splitBzIds = (blocks: FilledBQLMutationBlock[]) => {
		const processBlocks = (
			operationBlocks: FilledBQLMutationBlock[],
			parentOperationBlock?: FilledBQLMutationBlock,
		): FilledBQLMutationBlock[] => {
			// console.log('operationBlocks', JSON.stringify(operationBlocks, null, 2));
			// splitting by ids, for operations with many ids, make individual operation block
			let processIds: FilledBQLMutationBlock[] = [];
			operationBlocks
				.filter((operationBlock) => operationBlock !== undefined && operationBlock !== null)
				.forEach((operationBlock) => {
					// console.log('processBlocks.first for each', operationBlock);
					const fieldCount = getFieldKeys(operationBlock).length;

					if (Array.isArray(operationBlock.$id) && fieldCount > 0) {
						const splitBlocksById = operationBlock.$id.map((id) => {
							return { ...operationBlock, $id: id };
						});
						processIds = [...processIds, ...splitBlocksById];
					} else {
						processIds.push({ ...operationBlock });
					}
				});

			let newOperationBlocks: FilledBQLMutationBlock[] = [];
			const fieldsWithoutMultiples: FilledBQLMutationBlock[] = [];
			// console.log('processIds', JSON.stringify(processIds, null, 2));
			const fieldsWithMultiples = processIds.filter((operationBlock) => {
				const ops = ['delete', 'update', 'unlink'];
				// Block must have one of the above operations
				const isCorrectOp = ops.includes(operationBlock.$op || '');
				const fieldCount = getFieldKeys(operationBlock).length;

				if (Array.isArray(operationBlock.$id) && fieldCount > 0) {
					throw new Error('Array of ids not processed');
				}
				// Block must either not have $id, have an array of $ids, or have a filter
				const isMultiple = !operationBlock.$id || operationBlock.$filter;
				if (isMultiple && isCorrectOp) {
					return true;
				} else {
					fieldsWithoutMultiples.push({ ...operationBlock });
				}
			});

			// console.log('fields', JSON.stringify({ fieldsWithMultiples, fieldsWithoutMultiples }, null, 2));
			if (fieldsWithMultiples.length > 0) {
				fieldsWithMultiples.forEach((opBlock) => {
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
						const combinableKeys = getFieldKeys(obj);

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
								allCombinations.push(fullObj);
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
					const allCombinations: Partial<FilledBQLMutationBlock>[] = getAllKeyCombinations(opBlock).filter(
						(opBlock) => !(opBlock.$op === 'update' && getFieldKeys(opBlock).length === 0),
					);
					// console.log('allCombinations', JSON.stringify(allCombinations,null,2))
					let included: string[] = [];
					const emptyObjCKey = objectPathToKey(opBlock.$objectPath);
					const cacheR = cache[emptyObjCKey];
					let remaining: string[] = cacheR ? cache[emptyObjCKey].$ids : [];
					const combinationsFromCache: Partial<FilledBQLMutationBlock>[] = [];
					allCombinations.forEach((combination: Partial<FilledBQLMutationBlock>, index: number) => {
						// console.log('combination', JSON.stringify(combination,null,2))
						const combinableKeys = getFieldKeys(combination, true);
						// console.log('combinableKeys', JSON.stringify({ combination, combinableKeys }, null, 2));
						const cachesFound = combinableKeys
							.map((key: string) => {
								// todo: figure out why things don't get added
								const getMultiples = (things: FilledBQLMutationBlock[] | FilledBQLMutationBlock) => {
									// console.log('things', JSON.stringify(things, null, 2));
									const multiples: FilledBQLMutationBlock[] = [];
									const nonMultiples: FilledBQLMutationBlock[] = [];
									const _things = Array.isArray(things) ? things : [things];
									_things.forEach((opBlock) => {
										if (!opBlock.$id || Array.isArray(opBlock.$id) || opBlock.$filter) {
											multiples.push(opBlock);
										} else {
											nonMultiples.push(opBlock);
										}
									});
									return { multiples, nonMultiples };
								};
								// todo: test with adjacent operations that aren't multiples and also many multiples
								const { multiples } = getMultiples(combination[key]);
								// console.log('multiples', JSON.stringify(multiples,null,2))
								const processedMultiples = multiples.map((multiple: FilledBQLMutationBlock) => {
									const cKey = objectPathToKey(multiple.$objectPath);
									console.log('cKey', JSON.stringify(cKey, null, 2));
									const getIdsToKey = (searchKey: string) => {
										const ids = [];
										const searchSegments = searchKey.split('.');
										const starting = searchSegments.slice(0, searchSegments.length - 1).join('.');
										// eslint-disable-next-line prefer-destructuring
										const ending = searchSegments
											.slice(searchSegments.length - 1, searchSegments.length)[0]
											.split('___')[1];
										for (const key in cache) {
											if (key.startsWith(starting) && key.endsWith(ending)) {
												const searchSegments = key.split('.');
												// eslint-disable-next-line prefer-destructuring
												const id = searchSegments
													.slice(searchSegments.length - 1, searchSegments.length)[0]
													.split('___')[0];
												ids.push(id);
											}
										}
										return ids;
									};

									const idsToKey = getIdsToKey(cKey);
									// console.log('idsToKey', JSON.stringify(idsToKey, null, 2));

									return { idsToKey, key, multiple };
								});
								return processedMultiples;
							})
							.filter((key) => key !== undefined);
						const findCommonIds = (data: { idsToKey: string[]; key: string; multiple: FilledBQLMutationBlock }[][]) => {
							const preppedArray = data.map((operations) => {
								const ids = operations.map((operation) => {
									return operation.idsToKey;
								});
								return ids;
							});
							const findCommonElements = (arr: string[][][]) => {
								if (arr.length > 0) {
									// Flatten the array to two dimensions
									const flatArray = arr.reduce((acc, val) => acc.concat(val), []);
									// Find common elements
									if (flatArray.length > 0) {
										return flatArray.reduce((acc, subArr) => {
											if (!acc) {
												return subArr;
											}
											return subArr.filter((item) => acc.includes(item));
										});
									} else {
										return [];
									}
								} else {
									return [];
								}
							};
							return findCommonElements(preppedArray);
						};
						const commonIds = findCommonIds(cachesFound);

						const filteredCommonIds = commonIds.filter((id) => !included.includes(id));
						included = [...included, ...filteredCommonIds];
						remaining = remaining.filter((id) => !filteredCommonIds.includes(id));
						// the last combination is always without the fields with multiples, so it's all remaining ids found in the cache
						if (index === allCombinations.length - 1 && remaining.length > 0) {
							remaining.forEach((id) => {
								const newOp = {
									...combination,
									$id: id,
									$bzId: `T1_${uuidv4()}`,
									...getSymbols(combination),
								};
								combinationsFromCache.push(newOp);
							});
						} else if (filteredCommonIds.length > 0) {
							filteredCommonIds.forEach((id) => {
								const newOp = {
									...combination,
									$id: id,
									$bzId: `T2_${uuidv4()}`,
									...getSymbols(combination),
								};
								combinationsFromCache.push(newOp);
							});
						}
					});
					// .filter((combination) => combination !== undefined);
					// console.log(
					// 	'info: ',
					// 	JSON.stringify({ combinationsFromCache, emptyObjCKey, parentOperationBlock, opBlock }, null, 2),
					// );

					const getReturnFields = () => {
						if (combinationsFromCache.length === 0 && !parentOperationBlock?.$id) {
							return fieldsWithMultiples;
						} else if (combinationsFromCache.length === 0 && parentOperationBlock?.$id) {
							const parentIds = Array.isArray(parentOperationBlock.$id)
								? parentOperationBlock.$id
								: [parentOperationBlock.$id];
							const newOps: FilledBQLMutationBlock[] = [];
							parentIds.forEach((id) => {
								const cKey = objectPathToKey({ ...opBlock.$objectPath, ids: id });
								const found = cache[cKey];
								if (found) {
									newOps.push({ ...opBlock, $id: found.$ids, ...getSymbols(opBlock), $bzId: `T_${uuidv4()}` });
								}
							});
							return newOps;
						} else {
							return combinationsFromCache.filter((combination) => combination !== undefined);
						}
					};
					const returnFields = getReturnFields();
					console.log('returnFields', JSON.stringify({ returnFields, fieldsWithoutMultiples }, null, 2));
					//@ts-expect-error - todo
					newOperationBlocks = [...fieldsWithoutMultiples, ...returnFields];
				});
			} else {
				newOperationBlocks = processIds;
			}
			// ! this is where the color field is being removed
			return newOperationBlocks;
		};
		const processOperationBlock = (operationBlock: FilledBQLMutationBlock) => {
			// console.log('operationBlock', operationBlock);
			const newBlock: FilledBQLMutationBlock = {
				...operationBlock,
				$bzId: operationBlock.$tempId ?? `T3_${uuidv4()}`,
				...getSymbols(operationBlock),
			};
			getFieldKeys(operationBlock, true).forEach((fieldKey) => {
				const operationBlocks: FilledBQLMutationBlock[] = Array.isArray(operationBlock[fieldKey])
					? operationBlock[fieldKey]
					: [operationBlock[fieldKey]];
				// if (operationBlock[fieldKey] !== null && !operationBlock[fieldKey]) {
				// 	console.log('operationBlock', JSON.stringify({ operationBlock, fieldKey, operationBlocks }, null, 2));
				// 	throw new Error(`No ${fieldKey} in this operation block`);
				// }
				const newOperationBlocks = processBlocks(operationBlocks, operationBlock);
				// todo: check for cardinality one, if it is and there is one object, then return and object not an array
				newBlock[fieldKey] = newOperationBlocks.length > 0 ? newOperationBlocks : undefined;
			});
			return newBlock;
		};
		let newBlocks: FilledBQLMutationBlock[] = [];
		// For each root block in a potentially batched mutation
		blocks.forEach((block) => {
			newBlocks = [...newBlocks, ...processBlocks([block])];
		});
		console.log('newBlocks', JSON.stringify(newBlocks, null, 2));
		const splitBlocks = newBlocks.map((block) => {
			return processOperationBlock(block);
		});
		console.log('splitBlocks', JSON.stringify(splitBlocks, null, 2));

		return splitBlocks;
	};

	const _splitBzIds = (blocks: FilledBQLMutationBlock[]) => {
		const processBlocks = (blocks: FilledBQLMutationBlock[]) => {
			const newBlocks: FilledBQLMutationBlock[] = [];
			// 1. Splitting ids
			blocks.forEach((block) => {
				if (Array.isArray(block.$id)) {
					block.$id.forEach((id) => {
						const newBlock = { ...block, $id: id, $bzId: `T_${uuidv4()}` };
						newBlocks.push(newBlock);
					});
				} else if (!block.$id) {
					newBlocks.push(block);
				} else {
					newBlocks.push(block);
				}
			});
			// 2. Get all combinations for operations with multiples
			// 2a. Filter operations with multiples and operations without multiples
			const getOperationsWithMultiples = (opBlocks: FilledBQLMutationBlock[]) => {
				// console.log('things', JSON.stringify(things, null, 2));
				const operationWithMultiples: FilledBQLMutationBlock[] = [];
				const operationWithoutMultiples: FilledBQLMutationBlock[] = [];
				opBlocks.forEach((opBlock) => {
					getFieldKeys(opBlock).forEach((key) => {
						const opBlocks: FilledBQLMutationBlock[] = Array.isArray(opBlock[key]) ? opBlock[key] : [opBlock[key]];
						// todo: check for $filters
						const blockMultiples: FilledBQLMutationBlock[] = opBlocks.filter((_opBlock) => !_opBlock.$id);
						if (blockMultiples.length > 0) {
							operationWithMultiples.push(opBlock);
						} else {
							operationWithoutMultiples.push(opBlock);
						}
					});
				});
				return { operationWithMultiples, operationWithoutMultiples };
			};
			const { operationWithMultiples, operationWithoutMultiples } = getOperationsWithMultiples(newBlocks);
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
				const combinableKeys = getFieldKeys(obj);
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
						allCombinations.push(fullObj);
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
			let crossReferencedOperations: Partial<FilledBQLMutationBlock>[] = [];
			operationWithMultiples.forEach((multipleBlock) => {
				const allCombinations: Partial<FilledBQLMutationBlock>[] = getAllKeyCombinations(multipleBlock);
				const combinationsToKeep: Partial<FilledBQLMutationBlock>[] = [];
				const alreadyIncluded: string[] = [];
				// console.log('allCombinations', JSON.stringify({ multipleBlock, allCombinations }, null, 2));
				// 2c. Check cache and prune combinations that don't have any ids in the cache
				allCombinations.forEach((combinationBlock) => {
					// keys for this combination
					const keys = getFieldKeys(combinationBlock);
					if (!combinationBlock.$objectPath) {
						throw new Error(`No $objectPath for this combination: ${JSON.stringify(combinationBlock, null, 2)}`);
					}
					const beforePath = objectPathToKey(combinationBlock.$objectPath);
					// the ids that will be added to the cache key to check which ids are found in all keys
					const idsOfBeforePath = cache[beforePath]?.$ids || [];
					// console.log(
					// 	'combination search info: ',
					// 	JSON.stringify({ combinationBlock, keys, beforePath, idsOfBeforePath }, null, 2),
					// );
					const idsMatchingCombination: string[] = [];

					idsOfBeforePath.forEach((id) => {
						const keysFound: string[][] = [];
						keys.forEach((key) => {
							const cacheKey = `${beforePath}.${id}${preQueryPathSeparator}${key}`;
							const cacheResult = cache[cacheKey]?.$ids;

							if (cacheResult) {
								keysFound.push(cacheResult);
							}
						});
						const include = keysFound.length === keys.length && !alreadyIncluded.includes(id);
						if (include) {
							idsMatchingCombination.push(id);
							alreadyIncluded.push(id);
						}
					});
					// console.log('idsMatchingCombination', JSON.stringify(idsMatchingCombination, null, 2));
					idsMatchingCombination.forEach((id) => {
						const newBlock = { ...combinationBlock, $id: id, $bzId: `T_${uuidv4()}` };
						combinationsToKeep.push(newBlock);
					});
				});
				crossReferencedOperations = [...crossReferencedOperations, ...combinationsToKeep];
			});
			const allOperations = [...crossReferencedOperations, ...operationWithoutMultiples];
			// 3. Recursion
			const finalBlocks = allOperations.map((block) => {
				const newBlock = { ...block };
				getFieldKeys(newBlock).forEach((key) => {
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

	// console.log('filledBql', JSON.stringify([filledBqlRequest], null, 2));

	const splitBql = _splitBzIds(Array.isArray(bqlWithObjectPaths) ? bqlWithObjectPaths : [bqlWithObjectPaths]);
	console.log('splitBql', JSON.stringify(splitBql, null, 2));

	const processReplaces = (blocks: FilledBQLMutationBlock[]) => {
		return blocks.map((block) => {
			const fields = getFieldKeys(block, true);
			const newBlock = { ...block };
			// console.log('block', JSON.stringify({ block, fields }, null, 2));

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
						// console.log('info:', JSON.stringify({ cacheFound, thing }, null, 2));

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
	// console.log('final', JSON.stringify(final, null, 2));

	req.filledBqlRequest = final;
};
