import produce from 'immer';
import {
  getNodeByPath,
  TraversalCallbackContext,
  traverse,
} from 'object-traversal';
import { isObject, listify, mapEntries, pick, shake } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { getCurrentFields, getCurrentSchema, oFind } from '../../helpers';
import type {
  BQLMutationBlock,
  EnrichedBormRelation,
  EnrichedRoleField,
  FilledBQLMutationBlock,
} from '../../types';
import type { PipelineOperation } from '../pipeline';

export const parseBQLMutation: PipelineOperation = async (req) => {
  const { rawBqlRequest, schema } = req;

  const stringToObjects = (
    blocks: BQLMutationBlock | BQLMutationBlock[]
  ): BQLMutationBlock | BQLMutationBlock[] => {
    return produce(blocks, (draft) =>
      traverse(draft, ({ value: val, meta }: TraversalCallbackContext) => {
        if (isObject(val)) {
          // <---------------mutating all objects---------------->
          // @ts-expect-error
          if (val.$arrayOp) {
            throw new Error('Array op not supported yet');
          }
          const value = val as BQLMutationBlock;

          /* console.log(
            '<---------------------value',
            isDraft(value) ? current(value) : value
          );
          */
          const currentSchema = getCurrentSchema(schema, val);

          if (!currentSchema) {
            throw new Error(
              // @ts-expect-error
              `Schema not found for ${val.$entity || val.$relation}`
            );
          }

          value[Symbol.for('thingType') as any] = currentSchema.thingType;
          value[Symbol.for('schema') as any] = currentSchema;
          value[Symbol.for('dbId') as any] =
            currentSchema.defaultDBConnector.id;

          const { linkFields, roleFields } = getCurrentFields(currentSchema);
          // console.log('linkFields', linkFields);
          // console.log('roleFields', roleFields);

          const currentPath = meta.nodePath;

          // <---------------mutating children objects ---------------->
          [
            ...linkFields.map((x) => ({ fieldType: 'linkField', path: x })),
            ...roleFields.map((x) => ({ fieldType: 'roleField', path: x })),
          ]?.forEach((currentField) => {
            const currentLinkFieldSchema = currentSchema.linkFields?.find(
              (x) => x.path === currentField.path
            );
            const currentValue = value[currentField.path];
            // ignore undefined
            if (currentValue === undefined) return;
            // console.log(':::', { currentField });

            const currentRoleFieldSchema =
              'roles' in currentSchema
                ? (oFind(
                    currentSchema.roles,
                    // @ts-expect-error
                    ([k]) => k === currentField.path
                  ) as EnrichedRoleField)
                : null;

            const currentFieldSchema =
              currentLinkFieldSchema || currentRoleFieldSchema;

            if (
              currentRoleFieldSchema &&
              [...new Set(currentRoleFieldSchema.playedBy?.map((x) => x.thing))]
                .length !== 1
            ) {
              throw new Error(
                `Field: ${
                  currentField.path
                } - If a role can be played by multiple things, you must specify the thing in the mutation: ${JSON.stringify(
                  currentRoleFieldSchema.playedBy
                )}. Schema: ${JSON.stringify(currentFieldSchema)}`
              );
            }
            const currentEdgeSchema = currentRoleFieldSchema?.playedBy
              ? currentRoleFieldSchema?.playedBy[0]
              : currentLinkFieldSchema;

            const getCurrentRelation = () => {
              if (
                currentFieldSchema &&
                'relation' in currentFieldSchema &&
                currentEdgeSchema?.relation === value.$relation
              ) {
                return '$self';
              }
              if (currentEdgeSchema?.relation) {
                return currentEdgeSchema?.relation;
              }
              return '$self';
            };

            const relation = getCurrentRelation();
            const relationSchema =
              relation === '$self'
                ? (currentSchema as EnrichedBormRelation)
                : schema.relations[relation];

            // console.log('relationSchema', relationSchema);

            const currentFieldRole = oFind(
              relationSchema.roles,
              ([k, _v]) => k === currentField.path
            );

            // console.log('currentFieldRole', currentFieldRole);

            if (currentFieldRole?.playedBy?.length === 0)
              throw new Error(
                `unused role: ${currentPath}.${currentField.path}`
              );

            // <-- VALIDATIONS -->
            if (!currentFieldSchema) {
              throw new Error(`Field ${currentField.path} not found in schema`);
            }
            const oppositeFields =
              currentLinkFieldSchema?.oppositeLinkFieldsPlayedBy ||
              currentRoleFieldSchema?.playedBy;

            if (!oppositeFields) {
              throw new Error(
                `No opposite fields found for ${JSON.stringify(
                  currentFieldSchema
                )}`
              );
            }

            if ([...new Set(oppositeFields?.map((x) => x.thing))].length > 1)
              throw new Error(
                `Field: ${
                  currentField.path
                } - If a role can be played by multiple things, you must specify the thing in the mutation: ${JSON.stringify(
                  oppositeFields
                )}. Schema: ${JSON.stringify(currentFieldSchema)}`
              );

            // null means unlink everything
            if (currentValue === null) {
              value[currentField.path] = { $op: 'unlink' };
            }

            if (
              currentFieldSchema.cardinality === 'ONE' &&
              Array.isArray(currentValue)
            ) {
              throw new Error(
                `Can't have an array in a cardinality === ONE link field`
              );
            }
            // ignore those properly configured. Todo: migrate to $thing
            if (currentValue.$entity || currentValue.$relation) return;

            const childrenLinkField = oppositeFields[0];

            const childrenThingObj = {
              [`$${childrenLinkField.thingType}`]: childrenLinkField.thing,
              [Symbol.for('relation') as any]: relation,
              [Symbol.for('edgeType') as any]:
                'plays' in currentFieldSchema ? 'linkField' : 'roleField',
              [Symbol.for('parent') as any]: {
                path: currentPath,
                id: value.$id || value.$tempId,
                links: oppositeFields,
              },
              [Symbol.for('role') as any]: childrenLinkField.plays, // this is the currentChildren
              // this is the parent
              [Symbol.for('oppositeRole') as any]:
                'plays' in currentFieldSchema
                  ? currentFieldSchema.plays
                  : undefined, // todo
            };

            // console.log('childrenThingObj', childrenThingObj);

            if (isObject(currentValue)) {
              if (
                currentSchema.thingType === 'relation' &&
                // @ts-expect-error
                currentValue.$tempId
              ) {
                // @ts-expect-error
                value[currentField.path] = currentValue.$tempId;
              } else {
                value[currentField.path] = {
                  ...childrenThingObj,
                  ...currentValue,
                };
              }

              // console.log('[obj]value', value[field as string]);
            }
            if (
              Array.isArray(currentValue) &&
              currentValue.every((x) => isObject(x))
            ) {
              value[currentField.path] = currentValue.map((y) => ({
                ...childrenThingObj,
                ...y,
              }));
              // console.log('[obj-arr]value', value[field as string]);
            }
            if (typeof currentValue === 'string') {
              value[currentField.path] = {
                ...childrenThingObj,
                $op: 'link',
                $id: currentValue, // todo: now all strings are ids and not tempIds, but in the future this might change
              };
            }
            if (
              Array.isArray(currentValue) &&
              currentValue.every((x) => typeof x === 'string')
            ) {
              value[currentField.path] = currentValue.map((y) => ({
                ...childrenThingObj,
                $op: 'link',
                $id: y,
              }));
            }
          });

          // console.log('value', current(value));

          const nodePathArray = meta.nodePath?.split('.');

          const notRoot = nodePathArray
            ?.filter((x) => Number.isNaN(parseInt(x, 10)))
            .join('.');

          if (!notRoot && !value.$entity && !value.$relation) {
            throw new Error('Root things must specify $entity or $relation');
          }
          if (!notRoot) {
            // no need to do nothing with root objects or objects that already
          }
          // we will get the $entity/$relation of the nonRoot that don't have it
        }
      })
    );
  };

  const withObjects = stringToObjects(rawBqlRequest);
  // console.log('withObjects', JSON.stringify(withObjects, null, 2);

  const fillBlocks = (
    blocks: BQLMutationBlock | BQLMutationBlock[]
  ): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
    // @ts-expect-error
    return produce(blocks, (draft) =>
      traverse(
        draft,
        ({ parent, key, value: val, meta }: TraversalCallbackContext) => {
          if (isObject(val)) {
            if (Object.keys(val).length === 0) {
              throw new Error('Empty object!');
            }
            const value = val as BQLMutationBlock;
            // console.log('value', value);
            // const currentTempId = value.$tempId || uuidv4();

            const nodePathArray = meta.nodePath?.split('.');

            const notRoot = nodePathArray
              ?.filter((x) => Number.isNaN(parseInt(x, 10)))
              .join('.');

            const currentSchema = getCurrentSchema(schema, value);
            // todo:
            // @ts-expect-error
            const { unidentifiedFields, dataFields, roleFields, linkFields } =
              getCurrentFields(currentSchema, value);

            const hasUpdatedDataFields = Object.keys(value).some((x) =>
              dataFields?.includes(x)
            );

            const hasUpdatedChildren = Object.keys(value).some((x) =>
              [...roleFields, ...linkFields]?.includes(x)
            );
            const getOp = () => {
              if (value.$op) return value.$op; // if there is an op, then thats the one
              // todo: can move these to the first level traversal
              if ((value.$id || value.$filter) && hasUpdatedDataFields)
                return 'update'; // if there is an id or  afilter, is an update. If it was a delete,it has been specified
              if (
                (value.$id || value.$filter) &&
                notRoot &&
                !hasUpdatedDataFields &&
                !hasUpdatedChildren
              )
                return 'link'; // if there is an id or  afilter, is an update. If it was a delete,it has been specified
              if (!value.$filter && !value.$id) return 'create'; // if it is not a delete, or an update, is a create (for this V0, missing link, unlink)
              if (
                (value.$id || value.$filter) &&
                !hasUpdatedDataFields &&
                hasUpdatedChildren
              )
                return 'noop';
              throw new Error('Wrong op');
            };
            // if (!value.$tempId && !value.$id) value.$tempId = currentTempId;
            if (!value.$op) value.$op = getOp();
            if (!parent) value.$parentKey = ''; // root

            // console.log('value', current(value));
            // errors
            if (
              !(value.$id || value.$tempId || value.$filter) &&
              ['delete', 'link', 'update', 'unlink'].includes(value.$op)
            ) {
              throw new Error(
                'Targeted operations (update, delete, link & unlink) require an $id or a $filter'
              );
            }
            if (typeof parent === 'object') {
              // spot rights conflicts

              // modify current
              const ArParent = Array.isArray(parent);
              if (ArParent) value[Symbol.for('index') as any] = key; // nodePathArray.at(-1);
              value[Symbol.for('path') as any] = meta.nodePath;
              value[Symbol.for('isRoot') as any] = !notRoot;
              value[Symbol.for('depth') as any] = notRoot?.split('.').length;
            }

            if (!value.$entity && !value.$relation) {
              throw new Error(
                `Node ${JSON.stringify(value)} without $entity/$relation`
              );
            }

            const { idFields, computedFields } = currentSchema;
            // todo: composite ids
            if (!idFields) throw new Error('No idFields found');
            const idField = idFields[0];
            // console.log('computedFields', computedFields);

            // if a valid id is setup, move it to $id
            if (value[idField] && !value.$id) {
              value.$id = value[idField];
            }

            const filledFields = listify(value, (attKey, v) =>
              v ? attKey : undefined
            );
            const missingComputedFields = computedFields.filter(
              (x) => !filledFields.includes(x)
            );

            // fill computed values
            missingComputedFields.forEach((fieldPath) => {
              // console.log('fieldPath', fieldPath);

              const currentFieldDef = currentSchema.dataFields?.find(
                (x) => x.path === fieldPath
              );
              const currentLinkDef = currentSchema.linkFields?.find(
                (x) => x.path === fieldPath
              );
              // todo: multiple playedBy
              const currentLinkedDef =
                currentLinkDef?.oppositeLinkFieldsPlayedBy[0];

              const currentRoleDef =
                'roles' in currentSchema
                  ? oFind(currentSchema.roles, ([k, _v]) => k === fieldPath)
                  : undefined;
              const currentDef =
                currentFieldDef || currentLinkedDef || currentRoleDef;
              if (!currentDef) {
                throw new Error(`no field Def for ${fieldPath}`);
              }

              // We generate id fields when needed
              if (
                fieldPath === idField &&
                value.$op === 'create' &&
                !value[fieldPath]
              ) {
                const defaultValue =
                  'default' in currentDef
                    ? currentDef.default?.value()
                    : undefined;
                if (!defaultValue) {
                  throw new Error(`No default value for ${fieldPath}`);
                }
                value[fieldPath] = defaultValue; // we already checked that this value has not been defined
                value.$id = defaultValue;
              }
            });

            if (unidentifiedFields.length > 0) {
              throw new Error(
                `Unknown fields: [${unidentifiedFields.join(
                  ','
                )}] in ${JSON.stringify(value)}`
              );
            }
          }
        }
      )
    );
  };

  const filledBQLMutation = fillBlocks(withObjects);
  // console.log('filledBQLMutation', JSON.stringify(filledBQLMutation, null, 2));

  const listNodes = (
    blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[]
  ) => {
    // todo: make immutable

    const nodes: BQLMutationBlock[] = [];
    const edges: BQLMutationBlock[] = [];
    const listOp = ({ value }: TraversalCallbackContext) => {
      if (value.$entity || value.$relation) {
        if (!value.$id && !['link', 'unlink'].includes(value.$op)) {
          throw new Error(
            'An id must be specified either in the mutation or has tu have a default value in the schema'
          );
        }
        const currentThingSchema = getCurrentSchema(schema, value);
        const { dataFields: dataFieldPaths, roleFields: roleFieldPaths } =
          getCurrentFields(currentThingSchema);

        const dataObj = {
          ...(value.$entity && { $entity: value.$entity }),
          ...(value.$relation && { $relation: value.$relation }),
          ...(value.$id && { $id: value.$id }),
          ...(value.$tempId && { $tempId: value.$tempId }),
          ...shake(pick(value, dataFieldPaths || [''])),
          $op: value.$op,
          [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
          [Symbol.for('isRoot')]: value[Symbol.for('isRoot')],
        };

        if (
          value.$op === 'create' ||
          value.$op === 'update' ||
          value.$op === 'delete'
        ) {
          nodes.push(dataObj);
        } else {
          // link and unlink are added as no-op in order to be included in the matches
          nodes.push({ ...dataObj, $op: 'noop' });
        }

        // console.log('value', isDraft(value) ? current(value) : value);

        // CASE 1: HAVE A PARENT THROUGH LINKFIELDS
        if (
          value[Symbol.for('relation')] &&
          value[Symbol.for('edgeType')] === 'linkField'
          // value[Symbol.for('relation')] !== '$self'
        ) {
          if (value.$op === 'link' || value.$op === 'unlink') {
            if (value.$id || value.$filter) {
              if (value.$tempId) {
                throw new Error(
                  "can't specify a existing and a new element at once. Use an id/filter or a tempId"
                );
              }
              nodes.push({ ...value, $op: 'noop' });
            }
            // we add a "linkable" version of it so we can query it in the insertion
          }

          // this linkObj comes from nesting, which means it has no properties and no ID
          // relations explicitely created are not impacted by this, and they get the $id from it's actual current value

          const ownRelation = value[Symbol.for('relation')] === value.$relation;

          if (ownRelation && !(value.$id || value.$tempId)) {
            throw new Error('No id or tempId found for complex link');
          }

          const linkTempId = ownRelation
            ? value.$id || value.$tempId
            : uuidv4();

          const parentMeta = value[Symbol.for('parent')];
          const parentPath = parentMeta.path;
          const parentNode = !parentPath
            ? blocks
            : getNodeByPath(blocks, parentPath);
          const parentId = parentNode.$id || parentNode.$tempId;
          if (!parentId) throw new Error('No parent id found');
          if (value[Symbol.for('relation')] === '$self') return;

          const getLinkObjOp = () => {
            if (value.$op === 'unlink' || value.$op === 'delete') {
              if (ownRelation) return 'unlink'; // delete already present in the nodes array
              return 'delete';
            }
            if (value.$op === 'link' || value.$op === 'create') {
              if (ownRelation) return 'link'; // create already present in the nodes array
              return 'create';
            }
            return 'noop';
          };
          const linkObj = {
            $relation: value[Symbol.for('relation')],
            $op: getLinkObjOp(),
            ...(value.$op === 'unlink'
              ? { $tempId: linkTempId }
              : { $id: linkTempId }), // assigning in the parse a temp Id for every linkObj
            [value[Symbol.for('role')]]: value.$tempId || value.$id,
            [value[Symbol.for('oppositeRole')]]: parentId,
            [Symbol.for('isRoot')]: false,
            [Symbol.for('dbId')]:
              schema.relations[value[Symbol.for('relation')]].defaultDBConnector
                .id,
            [Symbol.for('edgeType')]: 'linkField',
          };
          // todo: stuff 😂
          edges.push(linkObj);
        }

        // CASE 2: IS RELATION AND HAS THINGS IN THEIR ROLES
        if (value.$relation) {
          const val = value as BQLMutationBlock;
          if (!val.$id && !['link', 'unlink'].includes(value.$op)) {
            throw new Error(
              'An id must be specified either in the mutation or has tu have a default value in the schema'
            );
          }

          // @ts-expect-error
          const rolesObjFiltered = oFilter(val, ([k, _v]) =>
            roleFieldPaths.includes(k)
          ) as BQLMutationBlock;

          // console.log('rolesObjFiltered', rolesObjFiltered);

          const rolesObjOnlyIds = mapEntries(rolesObjFiltered, (k, v) => {
            // todo cardinality = MANY
            return [k, v.$id || v];
          });

          // console.log('rolesObjOnlyIds', rolesObjOnlyIds);
          // @ts-expect-error
          const objWithMetaDataOnly = oFilter(val, ([k, _v]) => {
            return k.startsWith('$') || k.startsWith('Symbol');
          });

          if (
            Object.keys(rolesObjFiltered).filter((x) => !x.startsWith('$'))
              .length > 0
          ) {
            if (val.$op === 'create' || val.$op === 'delete') {
              // if the relation is being created, then all objects in the roles are actually add
              const getEdgeOp = () => {
                if (val.$op === 'create') return 'link';
                if (val.$op === 'delete') return 'unlink';
                throw new Error('Unsupported parent of edge op');
              };

              // todo: validations
              // 1) each ONE role has only ONE element // 2) no delete ops // 3) no arrayOps, because it's empty (or maybe yes and just consider it an add?) ...
              edges.push({
                ...objWithMetaDataOnly,
                $relation: val.$relation,
                $op: getEdgeOp(),
                ...rolesObjOnlyIds, // override role fields by ids or tempIDs
                [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                [Symbol.for('info')]: 'coming from created or deleted relation',
              });
              return;
            }
            if (val.$op === 'noop') {
              // @ts-expect-error
              const rolesWithLinks = oFilter(rolesObjOnlyIds, ([_k, v]) =>
                v.some(
                  (
                    x: BQLMutationBlock // string arrays are always replaces
                  ) => x.$op === 'link' || x.$op === 'create'
                )
              );
              const rolesWithLinksFiltered = mapEntries(
                rolesWithLinks,
                (k, v: BQLMutationBlock[]) => [
                  k,
                  v
                    .filter((x) => x.$op === 'link' || x.$op === 'create')
                    .map((y) => y.$id),
                ]
              );
              // @ts-expect-error
              const rolesWithUnlinks = oFilter(rolesObjOnlyIds, ([_k, v]) =>
                v.some(
                  (x: BQLMutationBlock) =>
                    x.$op === 'unlink' || x.$op === 'delete'
                )
              );
              // filters the array of objects, taking only those where x.$op === 'unlink'
              const rolesWithUnlinksFiltered = mapEntries(
                rolesWithUnlinks,
                (k, v: BQLMutationBlock[]) => [
                  k,
                  v
                    .filter((x) => x.$op === 'unlink' || x.$op === 'delete')
                    .map((y) => y.$id),
                ]
              );
              const rolesWithReplaces = {};
              [
                { op: 'link', obj: rolesWithLinksFiltered },
                { op: 'unlink', obj: rolesWithUnlinksFiltered },
                { op: 'replace', obj: rolesWithReplaces }, // todo
              ].forEach((x) => {
                if (Object.keys(x.obj).length) {
                  edges.push({
                    ...objWithMetaDataOnly,
                    $relation: val.$relation,
                    $op: x.op,
                    ...x.obj, // override role fields by ids or tempIDs
                    [Symbol.for('dbId')]:
                      currentThingSchema.defaultDBConnector.id,
                    [Symbol.for('info')]: 'updating roleFields',
                  });
                }
              });
              // return;
            }
            // throw new Error('Unsupported direct relation operation');
          }
        }
      }
    };
    // console.log('[blocks]', JSON.stringify(blocks, null, 3));
    // console.log('[blocks]', blocks);

    traverse(blocks, listOp);
    return [nodes, edges];
  };

  const [parsedThings, parsedEdges] = listNodes(filledBQLMutation);
  // console.log('parsedThings', parsedThings);
  // console.log('parsedEdges', parsedEdges);

  // merge attributes of relations that share the same $id
  // WHY => because sometimes we get the relation because of having a parent, and other times because it is specified in the relation's properties
  // todo: dont merge if ops are different!
  const mergedEdges = parsedEdges.reduce((acc, curr) => {
    const existingEdge = acc.find(
      (r) => r.$id === curr.$id && r.$relation === curr.$relation
    );
    if (existingEdge) {
      const newRelation = {
        ...existingEdge,
        ...curr,
      };
      const newAcc = acc.filter(
        (r) => r.$id !== curr.$id || r.$relation !== curr.$relation
      );
      return [...newAcc, newRelation];
    }
    return [...acc, curr];
  }, [] as BQLMutationBlock[]);

  req.bqlRequest = {
    mutation: {
      things: parsedThings,
      edges: mergedEdges,
    },
  };
};
