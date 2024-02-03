import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { FilledBQLMutationBlock } from '../../../types';
import { getCurrentSchema, getCardinality } from '../../../helpers';
import { queryPipeline, type PipelineOperation } from '../../pipeline';

export const preQueryPathSeparator = '___';
type ObjectPath = { beforePath: string; ids: string | string[]; key: string };

const grandChildOfCreateSymbol = Symbol.for('grandChildOfCreate');

const getSymbols = (oldBlock: FilledBQLMutationBlock) => {
	// console.log({ oldBlock });
	const symbols = {
		...(oldBlock[Symbol.for('relation') as any] && {
			[Symbol.for('relation') as any]: oldBlock[Symbol.for('relation') as any],
		}),
		...(oldBlock[Symbol.for('parent') as any] && {
			[Symbol.for('parent') as any]: oldBlock[Symbol.for('parent') as any],
		}),
		...(oldBlock[Symbol.for('edgeType') as any] && {
			[Symbol.for('edgeType') as any]: oldBlock[Symbol.for('edgeType') as any],
		}),
		...(oldBlock[Symbol.for('role') as any] && {
			[Symbol.for('role') as any]: oldBlock[Symbol.for('role') as any],
		}),
		...(oldBlock[Symbol.for('oppositeRole') as any] && {
			[Symbol.for('oppositeRole') as any]: oldBlock[Symbol.for('oppositeRole') as any],
		}),
		...(oldBlock[Symbol.for('relFieldSchema') as any] && {
			[Symbol.for('relFieldSchema') as any]: oldBlock[Symbol.for('relFieldSchema') as any],
		}),
		...(oldBlock[Symbol.for('path') as any] && {
			[Symbol.for('path') as any]: oldBlock[Symbol.for('path') as any],
		}),
		...(oldBlock[Symbol.for('isRoot') as any] && {
			[Symbol.for('isRoot') as any]: oldBlock[Symbol.for('isRoot') as any],
		}),
		...(oldBlock[Symbol.for('depth') as any] && {
			[Symbol.for('depth') as any]: oldBlock[Symbol.for('depth') as any],
		}),
		...(oldBlock[Symbol.for('schema') as any] && {
			[Symbol.for('schema') as any]: oldBlock[Symbol.for('schema') as any],
		}),
		...(oldBlock[Symbol.for('dbId') as any] && {
			[Symbol.for('dbId') as any]: oldBlock[Symbol.for('dbId') as any],
		}),
		...(oldBlock[Symbol.for('index') as any] && {
			[Symbol.for('index') as any]: oldBlock[Symbol.for('index') as any],
		}),
	};

	return symbols;
};

export const preQuery: PipelineOperation = async (req) => {
	const { filledBqlRequest, config, schema } = req;

	const getFieldKeys = (block: FilledBQLMutationBlock, noDataFields?: boolean) => {
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

	const bqlWithObjectPaths = fillObjectPaths(filledBqlRequest);

	const splitBzIds = (blocks: FilledBQLMutationBlock[]) => {
		const processBlocks = (
			operationBlocks: FilledBQLMutationBlock[],
			parentOperationBlock?: FilledBQLMutationBlock,
		) => {
			let processIds: FilledBQLMutationBlock[] = [];
			operationBlocks
				.filter((operationBlock) => operationBlock)
				.forEach((operationBlock) => {
					// console.log('processBlocks.first for each', operationBlock);
					const fieldCount = Object.keys(operationBlock).filter((key) => !key.startsWith('$')).length;
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
			const fieldsWithMultiples = processIds.filter((operationBlock) => {
				const ops = ['delete', 'update', 'unlink'];
				// Block must have one of the above operations
				const isCorrectOp = ops.includes(operationBlock.$op || '');
				const fieldCount = getFieldKeys(operationBlock, true).length;
				// Block must either not have $id, have an array of $ids, or have a filter
				const isMultiple =
					!operationBlock.$id || (Array.isArray(operationBlock.$id) && fieldCount > 0) || operationBlock.$filter;
				if (isMultiple && isCorrectOp) {
					return true;
				} else {
					fieldsWithoutMultiples.push({ ...operationBlock });
				}
			});
			// console.log('fields', { fieldsWithMultiples, fieldsWithoutMultiples });
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
						const combinableKeys = allKeys.filter((key) => !key.startsWith('$'));

						const allCombinations: FilledBQLMutationBlock[] = [];

						const generateCombinations = (index: number, currentObj: FilledBQLMutationBlock) => {
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
					const allCombinations: FilledBQLMutationBlock[] = getAllKeyCombinations(opBlock).filter(
						(opBlock) =>
							!(opBlock.$op === 'update' && Object.keys(opBlock).filter((key) => !key.startsWith('$')).length === 0),
					);

					let included: string[] = [];
					const emptyObjCKey = objectPathToKey(opBlock.$objectPath);
					const cacheR = cache[emptyObjCKey];
					let remaining: string[] = cacheR ? cache[emptyObjCKey].$ids : [];
					const combinationsFromCache = allCombinations
						.map((combination: FilledBQLMutationBlock, index: number) => {
							const _currentSchema = getCurrentSchema(schema, combination);
							const combinableKeys = Object.keys(combination).filter(
								(fieldKey) => !fieldKey.includes('$') && !_currentSchema.dataFields?.some((o) => o.path === fieldKey),
							);

							const cachesFound = combinableKeys
								.map((key: string) => {
									// todo: test with adjacent operations that aren't multiples and also many multiples
									const multiples = Array.isArray(combination[key])
										? combination[key].length > 1
											? combination[key].filter(
													(opBlock: FilledBQLMutationBlock) =>
														!opBlock.$id || Array.isArray(opBlock.$id) || opBlock.$filter,
											  )
											: combination[key]
										: [combination[key]];
									const processedMultiples = multiples.map((multiple: FilledBQLMutationBlock) => {
										const cKey = objectPathToKey(multiple.$objectPath);
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
										return { idsToKey, key, multiple };
									});
									return processedMultiples;
								})
								.filter((key) => key !== undefined);
							const findCommonIds = (
								data: { idsToKey: string[]; key: string; multiple: FilledBQLMutationBlock }[][],
							) => {
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
										return flatArray.reduce((acc, subArr) => {
											if (!acc) {
												return subArr;
											}
											return subArr.filter((item) => acc.includes(item));
										});
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
								const newOp = {
									...combination,
									$id: remaining,
									$bzId: `T_${uuidv4()}`,
									...getSymbols(combination),
								};
								return newOp;
							} else if (filteredCommonIds.length > 0) {
								const newOp = {
									...combination,
									$id: filteredCommonIds,
									$bzId: `T_${uuidv4()}`,
									...getSymbols(combination),
								};
								return newOp;
							}
						})
						.filter((combination) => combination !== undefined);
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
							return combinationsFromCache;
						}
					};
					const returnFields = getReturnFields();

					newOperationBlocks = [...fieldsWithoutMultiples, ...returnFields].map(processOperationBlock);
				});
			} else {
				newOperationBlocks = processIds.map(processOperationBlock);
			}
			return newOperationBlocks;
		};
		const processOperationBlock = (operationBlock: FilledBQLMutationBlock) => {
			const newBlock: FilledBQLMutationBlock = {
				...operationBlock,
				$bzId: `T_${uuidv4()}`,
				...getSymbols(operationBlock),
			};
			const currentSchema = getCurrentSchema(schema, operationBlock);
			Object.keys(operationBlock)
				// field must be a roleField or linkField
				.filter((fieldKey) => !fieldKey.includes('$') && !currentSchema.dataFields?.some((o) => o.path === fieldKey))
				.forEach((fieldKey) => {
					const operationBlocks: FilledBQLMutationBlock[] = Array.isArray(operationBlock[fieldKey])
						? operationBlock[fieldKey]
						: [operationBlock[fieldKey]];
					const newOperationBlocks = processBlocks(operationBlocks, operationBlock);
					newBlock[fieldKey] = newOperationBlocks.length > 0 ? newOperationBlocks : undefined;
				});
			return newBlock;
		};
		let newBlocks: FilledBQLMutationBlock[] = [];
		// For each root block in a potentially batched mutation
		blocks.forEach((block) => {
			newBlocks = [...newBlocks, ...processBlocks([block])];
		});
		const splitBlocks = newBlocks.map((block) => {
			return processOperationBlock(block);
		});
		return splitBlocks;
	};

	// console.log('filledBql', JSON.stringify([filledBqlRequest], null, 2));

	const splitBql = splitBzIds(Array.isArray(bqlWithObjectPaths) ? bqlWithObjectPaths : [bqlWithObjectPaths]);
	// console.log('splitBql', JSON.stringify(splitBql, null, 2));

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
						$bzId: `T_${uuidv4()}`,
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
							$bzId: `T_${uuidv4()}`,
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
							$bzId: `T_${uuidv4()}`,
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

	const final = fillPaths(processedReplaces);
	// console.log('final', JSON.stringify(final, null, 2));

	req.filledBqlRequest = final;
};
