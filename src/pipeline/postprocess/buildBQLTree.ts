/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject, listify } from 'radash';

import { getCurrentFields, notNull, oFilter } from '../../helpers';
import type { BormConfig, BQLFieldObj, BQLMutationBlock, RawBQLQuery } from '../../types';
import type { Entity, PipelineOperation } from '../pipeline';
import { compute } from '../../engine/compute';

const isOne = (children: any[], $id: string) => {
	if (children.length === 1 && typeof children[0] !== 'string' ? children[0].$id === $id : false) {
		return children[0];
	}
	return children;
};

const isStringOrHasShow = <TValue extends { $show?: boolean }>(value: TValue | string): value is TValue => {
	return typeof value === 'string' || !!value.$show;
};

const cleanOutput = (obj: RawBQLQuery | BQLMutationBlock | BQLMutationBlock[], config: BormConfig) =>
	produce(obj, (draft) =>
		traverse(
			draft,
			({ value }: TraversalCallbackContext) => {
				// if it is an array or an object, then return

				if (Array.isArray(value) || !(typeof value === 'object')) {
					return;
				}
				if (value.$tempId) {
					value.$tempId = `_:${value.$tempId}`;
				}
				if (value.$fields) {
					delete value.$fields;
				}
				if (value.$filter) {
					delete value.$filter;
				}
				if (value.$show) {
					delete value.$show;
				}
				if (value.$bzId) {
					delete value.$bzId;
				}

				if (config.query?.noMetadata && (value.$entity || value.$relation)) {
					delete value.$entity;
					delete value.$relation;
					delete value.$id;
				}

				const symbols = Object.getOwnPropertySymbols(obj);
				symbols.forEach((symbol) => {
					delete value[symbol];
				});

				if (value.$excludedFields) {
					value.$excludedFields.forEach((field: any) => {
						delete value[field];
					});
					delete value.$excludedFields;
				}
			},

			/* if (Array.isArray(value) && value.length === 0) {
      value = null;
    } */
		),
	);

const filterChildrenEntities = (things: [string, Entity][], ids: string | string[], node: RawBQLQuery, path: string) =>
	things
		.map(([id, entity]) => {
			if (!ids) {
				return null;
			}
			if (!ids.includes(id)) {
				return null;
			}
			if (!node.$fields) {
				return id;
			}
			if (node.$fields.includes(path)) {
				return id;
			}
			const currentFieldConf = node.$fields.find((f) => isObject(f) && f.$path === path) as BQLFieldObj;

			if (currentFieldConf) {
				const onlyMetadataEntity = {
					...oFilter(entity, (k: string, _v) => k.startsWith('$')),
				};
				const withFieldsEntity = currentFieldConf.$fields
					? {
							...onlyMetadataEntity,
							$fields: currentFieldConf.$fields,
					  }
					: onlyMetadataEntity;
				// console.log('withFieldsEntity', withFieldsEntity);

				if (currentFieldConf.$id) {
					if (Array.isArray(currentFieldConf.$id)) {
						if (currentFieldConf.$id.includes(id)) {
							return withFieldsEntity;
						}
						return null;
					}
					if (currentFieldConf.$id === id) {
						return withFieldsEntity;
					}
				}
				// console.log('Main log: ', JSON.stringify(withFieldsEntity, null, 2));

				if (withFieldsEntity.$fields && withFieldsEntity.$fields.includes('id') && !withFieldsEntity.$show) {
					let returnVal = '';

					withFieldsEntity.$fields.forEach((field: string) => {
						if (field === 'id') {
							// @ts-expect-error - TODO description
							returnVal = withFieldsEntity.$id;
						} else {
							// @ts-expect-error - TODO description
							returnVal = withFieldsEntity;
						}
					});
					return returnVal;
				}
				// no id, then every entity
				// TODO: include other branch merge changes here
				return withFieldsEntity;
			}
			return null;
		})
		.filter((x) => x);

const replaceBzIds = (resItems: any[], things: any[]) => {
	const mapping = {};

	// Create a mapping from $bzId to $id
	things.forEach((thing: any) => {
		// @ts-expect-error - TODO description
		mapping[thing.$bzId] = thing.$id;
	});
	// Replace values in the first array
	resItems.forEach((item) => {
		Object.keys(item).forEach((key) => {
			// @ts-expect-error - TODO description
			if (mapping[item[key]] && key !== '$tempId') {
				// @ts-expect-error - TODO description

				item[key] = mapping[item[key]];
			}
		});
	});

	return resItems;
};

const hasMatches = (resItems: any[], things: any[]): boolean => {
	const bzIds = things.map((thing) => thing.$bzId);
	let found = false;

	resItems.forEach((item) => {
		Object.keys(item).forEach((key) => {
			if (bzIds.includes(item[key])) {
				found = true;
			}
		});
	});

	return found;
};

export const buildBQLTree: PipelineOperation = async (req, res) => {
	const { bqlRequest, config, schema } = req;
	// const queryConfig = config.query;
	const { cache } = res;
	// console.log('cache', cache);
	if (!bqlRequest) {
		throw new Error('BQL request not parsed');
	}

	const { query } = bqlRequest;
	if (!query) {
		// @ts-expect-error - TODO description
		const resItems = res.bqlRes[0] ? res.bqlRes : [res.bqlRes];
		const things = req.bqlRequest?.mutation?.things;
		// @ts-expect-error - TODO description
		const matchesFound = hasMatches(resItems, things);
		if (matchesFound) {
			// @ts-expect-error - TODO description
			const replaced = replaceBzIds(resItems, things);
			res.bqlRes = replaced[1] ? replaced : replaced[0];
		}
		// @ts-expect-error - TODO description
		const output = cleanOutput(res.bqlRes, config);
		// @ts-expect-error - TODO description
		res.bqlRes = output;

		return;
	}
	if (!cache) {
		return;
	}

	const thingSchema = '$entity' in query ? query.$entity : query.$relation;

	const entityMap = cache.entities.get(thingSchema.name);
	if (!entityMap) {
		res.bqlRes = null;
		return;
	}

	// todo:
	// @ts-expect-error - TODO description
	const filterFields = listify(query.$filter, (x) => x);
	const atLeastOneUnique = filterFields.some(
		(x) => thingSchema.dataFields?.find((y) => y.path === x)?.validations?.unique,
	);

	const monoOutput =
		!Array.isArray(bqlRequest.query) &&
		((bqlRequest.query?.$id && !Array.isArray(bqlRequest.query?.$id)) || atLeastOneUnique);
	// todo: add the other two cases
	// || bqlRequest.query?.$filter?.[filtered by an id field]);
	// || !bqlRequest.query.limit !== 1;

	if (Array.isArray(req.rawBqlRequest)) {
		throw new Error('Query arrays not implemented yet');
	}

	const rootThings = entityMap;
	// root element is not an array but we need it to be one so we can traverse it
	const structuredAnswer = [...rootThings].length
		? [...rootThings].map(([id, _entity]) => ({
				...req.rawBqlRequest,
				$id: id,
		  }))
		: req.rawBqlRequest;

	const bqlTree = produce(structuredAnswer, (draft) =>
		traverse(draft, ({ value: val }: TraversalCallbackContext) => {
			const value = val as RawBQLQuery;
			// @ts-expect-error - TODO description
			if (!value?.$entity && !value?.$relation) {
				return;
			}

			const thingName = '$entity' in value ? value.$entity : value.$relation;
			if (thingName) {
				// INIT
				const currentIds = Array.isArray(value.$id) ? value.$id : [value.$id];
				const currentSchema = '$relation' in value ? schema.relations[value.$relation] : schema.entities[value.$entity];

				const { dataFields, roleFields } = getCurrentFields(currentSchema);

				// #region DATAFIELDS
				const currentEntities = cache.entities.get(thingName);
				if (!currentEntities) {
					return;
				}

				[...currentEntities].forEach(([id, entity]) => {
					if (currentIds.includes(id)) {
						// if $fields is present, only return those fields, if not, everything
						const queriedDataFields = value.$fields ? value.$fields : dataFields;

						/// Virtual fields
						const { virtualFields } = currentSchema;
						//for each vitualFIelfd present in the queried datas print them
						virtualFields?.forEach((virtualField) => {
							// @ts-expect-error - No need to compute if it was received somehow from the DB or if it is not a virtual field
							if (queriedDataFields?.includes(virtualField) && value[virtualField] === undefined) {
								const fieldSchema = currentSchema.dataFields?.find((x) => x.path === virtualField);
								const computedValue = compute(entity, fieldSchema);

								// @ts-expect-error - TODO description
								value[virtualField] = computedValue;
							}
						});

						listify(entity, (k, v) => {
							if (k.startsWith('$')) {
								return;
							}
							if (!queriedDataFields?.includes(k)) {
								return;
							}
							// @ts-expect-error - TODO description
							value[k] = v;
						});

						// #endregion
						// #region ROLE FIELDS
						const links = cache.roleLinks.get(id);
						const flatRoleFields = value.$fields ? value.$fields.filter((x) => typeof x === 'string') : roleFields;

						const embeddedRoleFields =
							value.$fields
								?.filter((x) => typeof x === 'object')
								// @ts-expect-error already said it's an object 🤔
								?.map((y) => y.$path) || [];

						Object.entries(links || {}).forEach(([rolePath, linkedIds]) => {
							// if not listed, skip
							if (![...flatRoleFields, ...embeddedRoleFields].includes(rolePath)) {
								return;
							}
							if (!('roles' in currentSchema)) {
								throw new Error('No roles in schema');
							}
							const uniqueLinkedIds = !Array.isArray(linkedIds) ? [linkedIds] : [...new Set(linkedIds)];

							const { cardinality, playedBy } = currentSchema.roles[rolePath];

							const thingNames = [...new Set(playedBy?.map((x) => x.thing))];

							const children = thingNames?.flatMap((x) => {
								const thingEntities = cache.entities.get(x);
								if (!thingEntities) {
									return [];
								}
								return filterChildrenEntities([...thingEntities], uniqueLinkedIds, value, rolePath);
							});

							if (children?.length) {
								// if the only children is the current entity, don't return it
								if (children.length === 1 && children[0] === value.$id) {
									return;
								}

								if (cardinality === 'ONE') {
									// @ts-expect-error - TODO description
									// eslint-disable-next-line prefer-destructuring
									value[rolePath] = children[0];
									return;
								}
								// @ts-expect-error - TODO description
								value[rolePath] = children.filter((x) => typeof x === 'string' || (typeof x === 'object' && x?.$show));
							}
						});
					}
				});
				// #endregion
				// #region LINKFIELDS
				const currentLinkFields = currentSchema.linkFields;
				if (currentLinkFields) {
					currentLinkFields.forEach((linkField) => {
						// console.log('linkField', linkField);

						const currentRelation = cache.relations.get(linkField.relation) as
							| undefined
							| Map<string, { entityName: string; id: string }>[];
						// console.log('currentRelation', currentRelation);
						// FIX: show get the related entity, not the parent one
						const tunnel = linkField.oppositeLinkFieldsPlayedBy;
						if (!currentRelation) {
							return null;
						}

						// FIX: should be fixed to match new relation object type
						if (linkField.target === 'relation') {
							const linkedEntities = [...currentRelation].reduce((acc: Record<string, Set<string>>, relation) => {
								const id = relation.get(linkField.plays)?.id;
								if (id && id === currentIds[0]) {
									// TODO: should never undefined, relation implies at least 2 roles
									// check why some relations have size 1
									const opposingRole = relation.get(linkField.relation) as
										| {
												entityName: string;
												id: string;
										  }
										| undefined;
									if (!opposingRole) {
										return acc;
									}
									if (!acc[opposingRole.entityName]) {
										acc[opposingRole.entityName] = new Set();
									}
									acc[opposingRole.entityName].add(opposingRole.id);
								}
								return acc;
							}, {});

							Object.entries(linkedEntities).map(([key, linkedEntityVal]) => {
								const allCurrentLinkFieldThings = cache.entities.get(key);
								if (!allCurrentLinkFieldThings) {
									return null;
								}

								const children = filterChildrenEntities(
									[...allCurrentLinkFieldThings],
									[...linkedEntityVal.values()],
									value,
									linkField.path,
								)
									.filter(notNull)
									.filter(isStringOrHasShow);

								if (children.length === 0) {
									return null;
								}

								if (children && children.length) {
									if (linkField.cardinality === 'ONE') {
										// @ts-expect-error - TODO description
										// eslint-disable-next-line prefer-destructuring
										value[linkField.path] = children[0];
										return null;
									}
									// @ts-expect-error - TODO description
									value[linkField.path] = children;
								}
								return null;
							});

							// console.log('children', children);
							return null;
						}
						if (linkField.target === 'role') {
							// Maybe should iterate over role and then get opposing entityIds
							tunnel.forEach((t) => {
								if (!currentRelation) {
									return;
								}

								const linkedEntities = [...currentRelation].reduce((acc: Record<string, Set<string>>, relation) => {
									// Check why I need to use t.
									const id = relation.get(linkField.plays)?.id;
									if (id && id === currentIds[0]) {
										// TODO: should never undefined, relation implies at least 2 roles
										// check why some relations have size 1
										const opposingRole = relation.get(t.plays) as
											| {
													entityName: string;
													id: string;
											  }
											| undefined;
										if (!opposingRole) {
											return acc;
										}
										if (!acc[opposingRole.entityName]) {
											acc[opposingRole.entityName] = new Set();
										}
										acc[opposingRole.entityName].add(opposingRole.id);
									}

									return acc;
								}, {});

								Object.entries(linkedEntities).forEach(([key, linkedEntityVal]) => {
									const allCurrentLinkFieldThings = cache.entities.get(key);
									if (!allCurrentLinkFieldThings) {
										return;
									}
									const children = filterChildrenEntities(
										[...allCurrentLinkFieldThings],
										[...linkedEntityVal.values()],
										value,
										linkField.path,
									)
										.filter(notNull)
										.filter(isStringOrHasShow);
									if (children.length === 0) {
										return;
									}

									if (children && children.length) {
										if (linkField.cardinality === 'ONE') {
											// @ts-expect-error - TODO description
											// eslint-disable-next-line prefer-destructuring
											value[linkField.path] = children[0];
											return;
										}
										// @ts-expect-error - TODO description
										value[linkField.path] = children;

										let filtered: { $id?: string } | { $id?: string }[] = {};
										const filterFunc = (o: any): boolean => {
											if (o.$path === linkField.path) {
												filtered = o;
											}
											return o?.$fields?.forEach(filterFunc);
										};
										let pathAndIdMatch = '';
										query.$fields?.forEach(filterFunc);
										if (filtered) {
											if (!Array.isArray(filtered.$id)) {
												// @ts-expect-error - TODO description
												pathAndIdMatch = filtered.$id;

												// if (filtered.$id.length === 1) {
												//   const firstEl = filtered.$id[0];
												//   pathAndIdMatch = firstEl;
												// }
											}
										}
										// @ts-expect-error - TODO description
										value[linkField.path] = isOne(children, pathAndIdMatch);
									}
								});
								// const $id = $fieldConf ? $fieldConf.$id : null;
								// const childrenCurrentIds = Array.isArray($id) ? $id : [$id];
							});
						}
						return null;
					});
				}
				// #endregion
			}
			//   console.log('VALUE', isDraft(value) ? current(value) : value);
		}),
	);

	const withoutFieldFilters = cleanOutput(bqlTree, config);

	// res.bqlRes = monoOutput ? bqlRes[0] : bqlRes;
	// @ts-expect-error - TODO description
	res.bqlRes = monoOutput ? withoutFieldFilters[0] : withoutFieldFilters;
};
