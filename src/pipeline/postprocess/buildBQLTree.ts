import produce from 'immer';
import { TraversalCallbackContext, traverse } from 'object-traversal';
import { isObject, listify } from 'radash';

import { getCurrentFields, notNull, oFilter } from '../../helpers';
import { BormConfig, BQLFieldObj, BQLMutationBlock, RawBQLQuery } from '../../types';
import type { Entity, PipelineOperation } from '../pipeline';

const cleanOutput = (obj: RawBQLQuery | BQLMutationBlock | BQLMutationBlock[], config: BormConfig) =>
  produce(obj, (draft) =>
    traverse(
      draft,
      ({ value }: TraversalCallbackContext) => {
        // if it is an array or an object, then return
        if (Array.isArray(value) || !(typeof value === 'object')) return;
        if (value.$fields) {
          delete value.$fields;
        }
        if (value.$filter) {
          delete value.$filter;
        }
        if (value.$show) {
          delete value.$show;
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
      }

      /* if (Array.isArray(value) && value.length === 0) {
      value = null;
    } */
    )
  );

const filterChildrenEntities = (things: [string, Entity][], ids: string | string[], node: RawBQLQuery, path: string) =>
  things
    .map(([id, entity]) => {
      if (!ids) return null;
      if (!ids.includes(id)) return null;
      if (!node.$fields) return id;
      if (node.$fields.includes(path)) return id;
      const currentFieldConf = node.$fields.find((f) => isObject(f) && f.$path === path) as BQLFieldObj;

      if (currentFieldConf) {
        const onlyMetadataEntity = {
          ...oFilter(entity, (k, _v) => k.startsWith('$')),
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
            if (currentFieldConf.$id.includes(id)) return withFieldsEntity;
            return null;
          }
          if (currentFieldConf.$id === id) return withFieldsEntity;
        }
        // no id, then every entity
        return withFieldsEntity;
      }
      return null;
    })
    .filter((x) => x);

export const buildBQLTree: PipelineOperation = async (req, res) => {
  const { bqlRequest, config, schema } = req;
  // const queryConfig = config.query;
  const { cache } = res;
  if (!bqlRequest) {
    throw new Error('BQL request not parsed');
  }

  const { query } = bqlRequest;
  if (!query) {
    // @ts-expect-error
    res.bqlRes = cleanOutput(res.bqlRes, config);
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
  // @ts-expect-error
  const filterFields = listify(query.$filter, (x) => x);
  const atLeastOneUnique = filterFields.some(
    (x) => thingSchema.dataFields?.find((y) => y.path === x)?.validations?.unique
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
      // @ts-expect-error
      if (!value?.$entity && !value?.$relation) return;

      const thingName = '$entity' in value ? value.$entity : value.$relation;
      if (thingName) {
        // INIT
        const currentIds = Array.isArray(value.$id) ? value.$id : [value.$id];
        const currentSchema = '$relation' in value ? schema.relations[value.$relation] : schema.entities[value.$entity];

        const { dataFields, roleFields } = getCurrentFields(currentSchema);

        // #region DATAFIELDS
        const currentEntities = cache.entities.get(thingName);
        if (!currentEntities) return;

        [...currentEntities].forEach(([id, entity]) => {
          if (currentIds.includes(id)) {
            // if $fields is present, only return those fields, if not, everything
            const queriedDataFields = value.$fields ? value.$fields : dataFields;

            listify(entity, (k, v) => {
              if (k.startsWith('$')) return;
              if (!queriedDataFields?.includes(k)) return;
              // @ts-expect-error
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
              if (!('roles' in currentSchema)) throw new Error('No roles in schema');
              const uniqueLinkedIds = !Array.isArray(linkedIds) ? [linkedIds] : [...new Set(linkedIds)];

              const { cardinality, playedBy } = currentSchema.roles[rolePath];

              const thingNames = [...new Set(playedBy?.map((x) => x.thing))];

              const children = thingNames?.flatMap((x) => {
                const thingEntities = cache.entities.get(x);
                if (!thingEntities) return [];
                return filterChildrenEntities([...thingEntities], uniqueLinkedIds, value, rolePath);
              });

              if (children?.length) {
                // if the only children is the current entity, don't return it
                if (children.length === 1 && children[0] === value.$id) {
                  return;
                }

                if (cardinality === 'ONE') {
                  // @ts-expect-error
                  // eslint-disable-next-line prefer-destructuring
                  value[rolePath] = children[0];
                  return;
                }
                // @ts-expect-error
                value[rolePath] = children.filter(
                  (x) =>
                    // @ts-expect-error
                    typeof x === 'string' || (typeof x === 'object' && x?.$show)
                );
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

            const currentRelation = cache.relations.get(linkField.relation);
            // console.log('currentRelation', currentRelation);
            // FIX: show get the related entity, not the parent one
            const tunnel = linkField.oppositeLinkFieldsPlayedBy;

            if (linkField.target === 'relation') {
              const targetRelation = tunnel[0];
              const targetRelationThings = cache.relations.get(linkField.relation);
              // console.log('currentIds', currentIds);
              const matchedLinks = !targetRelationThings
                ? []
                : [...targetRelationThings]
                    .filter((link) => {
                      // console.log('link', link);
                      // console.log('currentIds', currentIds);
                      return currentIds.includes(link.get(thingName));
                    })
                    .map((x) => x.get(targetRelation.thing));
              // console.log('matchedLinks', matchedLinks);
              const targetRelationEntities = cache.entities.get(targetRelation.thing);

              if (!targetRelationEntities) return null;
              const children = filterChildrenEntities(
                [...targetRelationEntities],
                // @ts-expect-error
                matchedLinks,
                value,
                linkField.path
              );
              // console.log('children', children);

              if (children.length) {
                // if the only children is the current entity, don't return it
                if (children.length === 1 && children[0] === value.$id) {
                  return null;
                }

                if (linkField.cardinality === 'ONE') {
                  // @ts-expect-error
                  // eslint-disable-next-line prefer-destructuring
                  value[linkField.path] = children[0];
                  return null;
                }
                // @ts-expect-error
                value[linkField.path] = children.filter(
                  (x) =>
                    // @ts-expect-error
                    typeof x === 'string' || (typeof x === 'object' && x?.$show)
                );
              }
              return null;
            }
            if (linkField.target === 'role') {
              const linkFieldPlayers = tunnel
                .flatMap((t) => {
                  const childEntities = Object.values(schema.entities).reduce((acc: string[], schemaEntity) => {
                    if (schemaEntity.extends === t.thing) {
                      acc.push(schemaEntity.name);
                    }
                    return acc;
                  }, []);
                  return [t.thing, ...childEntities]
                    .flatMap((entityThing) => {
                      // FIX: this creates an issue with self referential relationship. Because
                      // we don't know which entity is playing each role
                      const allCurrentLinkFieldThings = cache.entities.get(entityThing);
                      const linkedIds = currentRelation
                        ? [...currentRelation]
                            .filter((rel) => rel.get(thingName) === currentIds[0])
                            .map((x) => x.get(entityThing))
                        : [];
                      // Remove if id is refers to the same entity
                      const uniqueLinkedIds = [...new Set(linkedIds)].filter((id) => !currentIds.includes(id));
                      if (!allCurrentLinkFieldThings) return null;

                      // const $id = $fieldConf ? $fieldConf.$id : null;
                      // const childrenCurrentIds = Array.isArray($id) ? $id : [$id];
                      const children = filterChildrenEntities(
                        [...allCurrentLinkFieldThings],
                        // todo:
                        // @ts-expect-error
                        uniqueLinkedIds,
                        value,
                        linkField.path
                      );

                      if (children.length) {
                        return children.filter(
                          (x) =>
                            typeof x === 'string' ||
                            // @ts-expect-error
                            (typeof x === 'object' && x?.$show)
                        );
                      }
                      return null;
                    })
                    .filter(notNull);
                })
                .filter(notNull);

              if (linkFieldPlayers && linkFieldPlayers.length) {
                if (linkField.cardinality === 'ONE') {
                  // @ts-expect-error
                  // eslint-disable-next-line prefer-destructuring
                  value[linkField.path] = linkFieldPlayers[0];
                  return null;
                }
                // @ts-expect-error
                value[linkField.path] = linkFieldPlayers;
              }
              return null;
            }
            return null;
          });
        }
        // #endregion
      }
      //   console.log('VALUE', isDraft(value) ? current(value) : value);
    })
  );

  const withoutFieldFilters = cleanOutput(bqlTree, config);

  // res.bqlRes = monoOutput ? bqlRes[0] : bqlRes;
  // @ts-expect-error
  res.bqlRes = monoOutput ? withoutFieldFilters[0] : withoutFieldFilters;
};
