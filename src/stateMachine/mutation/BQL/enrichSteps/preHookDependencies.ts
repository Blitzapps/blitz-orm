/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type {
	BQLField,
	BormConfig,
	DBHandles,
	EnrichedBQLMutationBlock,
	EnrichedBormSchema,
	FilledBQLMutationBlock,
} from '../../../../types';
import { getCurrentSchema } from '../../../../helpers';
import { queryPipeline } from '../../../../pipeline/pipeline';
import { DBNode } from '../../../../types/symbols';

export const preQueryPathSeparator = '___';
type ObjectPath = { beforePath: string; ids: string | string[]; key: string };

export const preHookDependencies = async (
	blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	dbHandles: DBHandles,
) => {
	// console.log('beforePreQuery', JSON.stringify(blocks, null, 2));
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

	const convertMutationToQuery = (blocks: FilledBQLMutationBlock[]) => {
		const processBlock = (block: FilledBQLMutationBlock, transformation?: boolean, root?: boolean) => {
			let $fields: any[] = transformation ? block.$fields || [] : [];
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
							const newField = {
								$path: k,
								...processBlock(opBlock, transformation),
							};
							$fields = [...$fields, ...[newField]];
						});
					} else {
						const newField = {
							$path: k,
							...processBlock(v, transformation),
						};
						$fields = [...$fields, ...[newField]];
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
		return {
			// preQueryReq: blocks.map((block) => processBlock(block, false, true)),
			transformationPreQueryReq: blocks.map((block) => processBlock(block, true, true)),
		};
	};

	const { transformationPreQueryReq } = convertMutationToQuery(Array.isArray(blocks) ? blocks : [blocks]);

	// console.log('preQueryReq', JSON.stringify({ preQueryReq, transformationPreQueryReq }, null, 2));

	// @ts-expect-error todo
	const transformationPreQueryRes = await queryPipeline(transformationPreQueryReq, config, schema, dbHandles);

	// console.log('preQueryRes', JSON.stringify({ transformationPreQueryRes }, null, 2));

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

	// 3. Create cache of paths
	type Cache<K extends string> = {
		[key in K]: {
			$objectPath: ObjectPath;
			$ids: string[];
		};
	};

	const tCache: Cache<string> = {};
	const tCachePaths = (
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
						// tCache[cacheKey] = { $objectPath: newObjPath, $ids: cacheArray };
						tCache[cacheKey] = cacheArray;
					} else {
						const val = parent[key];
						tCache[cacheKey] = val;
						// if (isObject(val)) {
						// 	// @ts-expect-error todo
						// 	tCache[cacheKey] = { $objectPath: newObjPath, $ids: [val.$id.toString()] };

						// 	// @ts-expect-error todo
						// 	// eslint-disable-next-line no-param-reassign
						// 	val.$objectPath = newObjPath;
						// } else if (val) {
						// 	tCache[cacheKey] = { $objectPath: newObjPath, $ids: [val.toString()] };
						// }
					}
				}
			}),
		);
	};

	// console.log('tCache: ', JSON.stringify(tCache));
	// @ts-expect-error todo
	tCachePaths(transformationPreQueryRes || {});

	const fillDbNodes = (blocks: FilledBQLMutationBlock[], parentPath?: string) => {
		const processBlock = (block: FilledBQLMutationBlock, hasSymbol?: boolean) => {
			const $dbNode = {};
			if (block.$fields) {
				block.$fields.forEach((field: BQLField) => {
					// @ts-expect-error todo
					const fieldKey = field.$path || field;
					const cacheKey = !block.$objectPath
						? `${parentPath ? parentPath : 'root'}.${block.$id}${preQueryPathSeparator}${fieldKey}`
						: `${parentPath ? parentPath : block.$objectPath}.${block.$id}${preQueryPathSeparator}${fieldKey}`;
					// console.log(
					// 	'cache stuff: ',
					// 	JSON.stringify({ fieldKey, cacheKey, parentPath, BO: block.$objectPath }, null, 2),
					// );
					const cacheFound = tCache[cacheKey];
					if (cacheFound) {
						// todo: based on cardinality, change to single value instead of array
						// @ts-expect-error todo
						if (!field.$path) {
							// @ts-expect-error todo
							$dbNode[fieldKey] = cacheFound;
						} else {
							if (Array.isArray(cacheFound)) {
								const items = cacheFound.map((b) => {
									return processBlock(
										// @ts-expect-error todo
										{
											$id: b,
											// @ts-expect-error todo
											$fields: block.$fields.find((f: BQLField) => f.$path === fieldKey).$fields,
											// $id: id,
											$objectPath: cacheKey,
										},
										true,
									);
								});
								// @ts-expect-error todo
								$dbNode[fieldKey] = items;
							} else {
								// @ts-expect-error todo
								$dbNode[fieldKey] = processBlock(
									{
										// ...cacheFound,
										// @ts-expect-error todo
										$id: cacheFound,

										// @ts-expect-error todo
										$fields: block.$fields.find((f: BQLField) => f.$path === fieldKey).$fields,
										$objectPath: cacheKey,
									},
									true,
								);
							}
						}
					}
				});
			}
			const newBlock = {
				...block,
				...(Object.keys($dbNode).length > 0 && {
					...(!hasSymbol
						? {
								[DBNode]: $dbNode,
							}
						: { $dbNode }),
				}),
				$fields: undefined,
				$objectPath: undefined,
			};

			return newBlock;
		};
		const newBlocks = blocks.map((block) => processBlock(block));
		const finalBlocks = newBlocks.map((block) => {
			const newBlock = { ...block };
			getFieldKeys(newBlock, true).forEach((key) => {
				const _parentPath = `${parentPath ? parentPath : 'root'}.${block.$id}${preQueryPathSeparator}${key}`;
				// @ts-expect-error todo
				const subBlocks = Array.isArray(newBlock[key]) ? newBlock[key] : [newBlock[key]];
				const newSubBlocks = fillDbNodes(subBlocks, _parentPath);
				// @ts-expect-error todo
				newBlock[key] = newSubBlocks;
			});
			return newBlock;
		});
		return finalBlocks;
	};

	// @ts-expect-error todo
	const filledDbNodes = fillDbNodes(blocks);

	// console.log('filledDbNode', filledDbNodes);

	return filledDbNodes;
};
