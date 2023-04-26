import produce from 'immer';
import { getNodeByPath, TraversalCallbackContext, traverse } from 'object-traversal';
import { isObject, listify, mapEntries, pick, shake } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { oFilter, getCurrentFields, getCurrentSchema, oFind } from '../../helpers';
import type { BQLMutationBlock, EnrichedBormRelation, EnrichedRoleField, FilledBQLMutationBlock } from '../../types';
import type { PipelineOperation } from '../pipeline';

export const parseBQLMutation: PipelineOperation = async (req) => {
  const { rawBqlRequest, schema } = req;

  const stringToObjects = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
    return produce(blocks, (draft) =>
      traverse(draft, ({ value: val, meta, key }: TraversalCallbackContext) => {
        if (isObject(val)) {
          // <---------------mutating all objects---------------->
          // @ts-expect-error
          if (val.$arrayOp) {
            throw new Error('Array op not supported yet');
          }
          /// ignore filters. In the future maybe transform the shortcuts of filters here (like $eq being a default)
          if (key === '$filter' || meta.nodePath?.includes('.$filter.')) {
            return;
          }
          const value = val as BQLMutationBlock;

          /* console.log(
            '<---------------------value',
            isDraft(value) ? current(value) : value
          );
          */
          const currentSchema = getCurrentSchema(schema, val);

          const nodePathArray = meta.nodePath?.split('.');

          const notRoot = nodePathArray?.filter((x) => Number.isNaN(parseInt(x, 10))).join('.');

          if (!currentSchema) {
            throw new Error(
              // @ts-expect-error
              `Schema not found for ${val.$entity || val.$relation}`
            );
          }
          value[Symbol.for('bzId') as any] = uuidv4();
          if (!notRoot) {
            // value[Symbol.for('dependencies') as any] = [];
          }
          value[Symbol.for('schema') as any] = currentSchema;
          value[Symbol.for('dbId') as any] = currentSchema.defaultDBConnector.id;

          const { linkFields, roleFields } = getCurrentFields(currentSchema);
          // console.log('linkFields', linkFields);
          // console.log('roleFields', roleFields);

          const currentPath = meta.nodePath;

          // <---------------mutating children objects ---------------->
          [
            ...linkFields.map((x) => ({ fieldType: 'linkField', path: x })),
            ...roleFields.map((x) => ({ fieldType: 'roleField', path: x })),
          ]?.forEach((currentField) => {
            const currentLinkFieldSchema = currentSchema.linkFields?.find((x) => x.path === currentField.path);
            const currentValue = value[currentField.path];
            // ignore undefined
            if (currentValue === undefined) return;
            // console.log(':::', { currentField });

            const currentRoleFieldSchema =
              'roles' in currentSchema
                ? (oFind(currentSchema.roles, (k) => k === currentField.path) as EnrichedRoleField)
                : null;

            const currentFieldSchema = currentLinkFieldSchema || currentRoleFieldSchema;

            if (
              currentRoleFieldSchema &&
              [...new Set(currentRoleFieldSchema.playedBy?.map((x) => x.thing))].length !== 1
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
              relation === '$self' ? (currentSchema as EnrichedBormRelation) : schema.relations[relation];

            // console.log('relationSchema', relationSchema);

            const currentFieldRole = oFind(relationSchema.roles, (k, _v) => k === currentField.path);

            // console.log('currentFieldRole', currentFieldRole);

            if (currentFieldRole?.playedBy?.length === 0)
              throw new Error(`unused role: ${currentPath}.${currentField.path}`);

            // <-- VALIDATIONS -->
            if (!currentFieldSchema) {
              throw new Error(`Field ${currentField.path} not found in schema`);
            }
            const oppositeFields =
              currentLinkFieldSchema?.oppositeLinkFieldsPlayedBy || currentRoleFieldSchema?.playedBy;

            if (!oppositeFields) {
              throw new Error(`No opposite fields found for ${JSON.stringify(currentFieldSchema)}`);
            }

            if ([...new Set(oppositeFields?.map((x) => x.thing))].length > 1)
              throw new Error(
                `Field: ${
                  currentField.path
                } - If a role can be played by multiple things, you must specify the thing in the mutation: ${JSON.stringify(
                  oppositeFields
                )}. Schema: ${JSON.stringify(currentFieldSchema)}`
              );

            if (currentFieldSchema.cardinality === 'ONE' && Array.isArray(currentValue)) {
              throw new Error(`Can't have an array in a cardinality === ONE link field`);
            }
            // cardinality many are always arrays, unless it's an object that specifies an arrayOp like
            if (
              currentFieldSchema.cardinality === 'MANY' &&
              currentValue !== null &&
              !Array.isArray(currentValue) &&
              !currentValue.$arrayOp
            ) {
              throw new Error(
                `${currentFieldSchema.name} is a cardinality === MANY thing. Use an array or a $arrayOp object`
              );
            }
            // ignore those properly configured. Todo: migrate to $thing
            if (currentValue?.$entity || currentValue?.$relation) return;

            const childrenLinkField = oppositeFields[0];

            /// now we have the parent, so we can add the dependencies
            // const parentMeta = value[Symbol.for('parent') as any];
            // const parentPath = parentMeta.path;
            // const parentNode = !parentPath ? blocks : getNodeByPath(blocks, parentPath);

            /// this is the child object, so these Symbol.for... don't belong to the current node
            const childrenThingObj = {
              [`$${childrenLinkField.thingType}`]: childrenLinkField.thing,
              // [Symbol.for('dependencies')]: [value[Symbol.for('bzId') as any],...value[Symbol.for('dependencies') as any],],
              [Symbol.for('relation') as any]: relation,
              [Symbol.for('edgeType') as any]: 'plays' in currentFieldSchema ? 'linkField' : 'roleField',
              [Symbol.for('parent') as any]: {
                path: currentPath,
                ...(value.$id ? { $id: value.$id } : {}),
                ...(value.$tempId ? { $tempId: value.$tempId } : {}),
                ...(value.filter ? { filter: value.filter } : {}),
                links: oppositeFields,
              },
              [Symbol.for('role') as any]: childrenLinkField.plays, // this is the currentChildren
              // this is the parent
              [Symbol.for('oppositeRole') as any]: 'plays' in currentFieldSchema ? currentFieldSchema.plays : undefined, // todo
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
            // todo: this does not allow the case accounts: ['id1','id2',{$tempId:'temp1'}] ideally tempIds should have some indicator like :_temp1 later so we can do ['id1','id2',':_tempid'] instead
            if (Array.isArray(currentValue) && currentValue.every((x) => isObject(x))) {
              value[currentField.path] = currentValue.map((y) => {
                /// when a tempId is specified, in a relation, same as with $id, is a link by default
                if (y.$tempId && currentSchema.thingType === 'relation' && (y.$op === 'link' || !y.$op)) {
                  return y.$tempId;
                }
                return {
                  ...childrenThingObj,
                  ...y,
                };
              });
              // console.log('[obj-arr]value', value[field as string]);
            }
            if (typeof currentValue === 'string') {
              value[currentField.path] = {
                ...childrenThingObj,
                $op: 'link',
                $id: currentValue, // todo: now all strings are ids and not tempIds, but in the future this might change
              };
            }
            if (Array.isArray(currentValue) && currentValue.every((x) => typeof x === 'string')) {
              value[currentField.path] = currentValue.map((y) => ({
                ...childrenThingObj,
                $op: 'link',
                $id: y,
              }));
            }
            if (currentValue === null) {
              const neutralObject = {
                ...childrenThingObj,
                $op: 'unlink', // todo: embedded => delete
              };
              value[currentField.path] = currentFieldSchema.cardinality === 'MANY' ? [neutralObject] : neutralObject;
            }
          });

          // console.log('value', current(value));

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
  // console.log('withObjects', JSON.stringify(withObjects, null, 2));

  const fillBlocks = (
    blocks: BQLMutationBlock | BQLMutationBlock[]
  ): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
    // @ts-expect-error
    return produce(blocks, (draft) =>
      traverse(draft, ({ parent, key, value: val, meta }: TraversalCallbackContext) => {
        if (isObject(val)) {
          if (Object.keys(val).length === 0) {
            throw new Error('Empty object!');
          }
          if (key === '$filter' || meta.nodePath?.includes('.$filter.')) {
            return;
          }
          const value = val as BQLMutationBlock;
          // console.log('value', value);
          // const currentTempId = value.$tempId || uuidv4();

          const nodePathArray = meta.nodePath?.split('.');

          const notRoot = nodePathArray?.filter((x) => Number.isNaN(parseInt(x, 10))).join('.');

          const currentPath = !notRoot
            ? meta.nodePath || '' /// keep the number in the root or set to root ''
            : Array.isArray(parent)
            ? nodePathArray?.slice(0, -1).join('.')
            : meta.nodePath;

          const currentSchema = getCurrentSchema(schema, value);
          // todo:
          // @ts-expect-error
          const { unidentifiedFields, dataFields, roleFields, linkFields } = getCurrentFields(currentSchema, value);

          const hasUpdatedDataFields = Object.keys(value).some((x) => dataFields?.includes(x));

          const hasUpdatedChildren = Object.keys(value).some((x) => [...roleFields, ...linkFields]?.includes(x));
          const getOp = () => {
            if (value.$op) return value.$op; // if there is an op, then thats the one
            if (value.$tempId && notRoot) return 'link'; // if there is a tempId is always a link,or it's the root unless an unlink op has been set
            if (value.$tempId && !notRoot) return 'create';
            // todo: can move these to the first level traversal
            if ((value.$id || value.$filter) && hasUpdatedDataFields) return 'update'; // if there is an id or a filter, is an update. If it was a delete,it has been specified
            if ((value.$id || value.$filter) && notRoot && !hasUpdatedDataFields && !hasUpdatedChildren) return 'link';
            if (!value.$filter && !value.$id && !value.$tempId) return 'create'; // if it is not a delete, or an update, is a create (for this V0, missing link, unlink)
            if ((value.$id || value.$filter) && !hasUpdatedDataFields && hasUpdatedChildren) return 'noop';
            throw new Error('Wrong op');
          };
          // if (!value.$tempId && !value.$id) value.$tempId = currentTempId;
          if (!value.$op) value.$op = getOp();
          if (!parent) value.$parentKey = ''; // root

          // console.log('value', current(value));
          // errors
          /* if (!(value.$id || value.$tempId || value.$filter) && ['delete', 'link', 'update'].includes(value.$op)) {
            throw new Error('Targeted operations (update, delete, link) require an $id or a $filter');
          } */
          if (typeof parent === 'object') {
            // spot rights conflicts

            // modify current
            const ArParent = Array.isArray(parent);
            if (ArParent) value[Symbol.for('index') as any] = key; // nodePathArray.at(-1);
            value[Symbol.for('path') as any] = currentPath;
            value[Symbol.for('isRoot') as any] = !notRoot;
            value[Symbol.for('depth') as any] = notRoot?.split('.').length;
          }

          if (!value.$entity && !value.$relation) {
            throw new Error(`Node ${JSON.stringify(value)} without $entity/$relation`);
          }

          const { idFields, computedFields } = currentSchema;
          // todo: composite ids
          if (!idFields) throw new Error('No idFields found');
          const idField = idFields[0];
          // console.log('computedFields', computedFields);

          const filledFields = listify(value, (attKey, v) => (v ? attKey : undefined));
          const missingComputedFields = computedFields.filter((x) => !filledFields.includes(x));

          // fill computed values
          missingComputedFields.forEach((fieldPath) => {
            // console.log('fieldPath', fieldPath);

            const currentFieldDef = currentSchema.dataFields?.find((x) => x.path === fieldPath);
            const currentLinkDef = currentSchema.linkFields?.find((x) => x.path === fieldPath);
            // todo: multiple playedBy
            const currentLinkedDef = currentLinkDef?.oppositeLinkFieldsPlayedBy[0];

            const currentRoleDef =
              'roles' in currentSchema ? oFind(currentSchema.roles, (k, _v) => k === fieldPath) : undefined;
            const currentDef = currentFieldDef || currentLinkedDef || currentRoleDef;
            if (!currentDef) {
              throw new Error(`no field Def for ${fieldPath}`);
            }

            // We generate id fields when needed
            if (fieldPath === idField && value.$op === 'create' && !value[fieldPath]) {
              const defaultValue = 'default' in currentDef ? currentDef.default?.value() : undefined;
              if (!defaultValue) {
                throw new Error(`No default value for ${fieldPath}`);
              }
              value[fieldPath] = defaultValue; // we already checked that this value has not been defined
              value.$id = defaultValue;
            }
          });

          // if a valid id is setup, move it to $id
          if (!value.$id) {
            if (value[idField]) {
              /// this is in creation when adding an id
              value.$id = value[idField];
            } else {
              if (value.$op === 'create') {
                throw new Error(`No id found for ${JSON.stringify(value)}`);
              }
              /// link, update, unlink or delete, without id, it gets a generic
              value.$tempId = `all-${uuidv4()}`;
            }
          }

          if (unidentifiedFields.length > 0) {
            throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
          }
        }
      })
    );
  };

  const filledBQLMutation = fillBlocks(withObjects);
  // console.log('filledBQLMutation', JSON.stringify(filledBQLMutation, null, 2));
  // console.log('filledBQLMutation', filledBQLMutation);

  const listNodes = (blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[]) => {
    // todo: make immutable

    const nodes: BQLMutationBlock[] = [];
    const edges: BQLMutationBlock[] = [];

    const toNodes = (node: BQLMutationBlock) => {
      if (node.$op === 'create' && nodes.find((x) => x.$id === node.$id)) throw new Error(`Duplicate id ${node.$id}`);
      nodes.push(node);
    };
    const listOp = ({ value }: TraversalCallbackContext) => {
      if (value.$entity || value.$relation) {
        if (!value.$id && !value.$tempId && !['link', 'unlink'].includes(value.$op)) {
          throw new Error(
            'An id must be specified either in the mutation or has tu have a default value in the schema'
          );
        }
        /// this is used to group the right delete/unlink operations with the involved things

        const currentThingSchema = getCurrentSchema(schema, value);
        const {
          dataFields: dataFieldPaths,
          roleFields: roleFieldPaths,
          linkFields: linkFieldPaths,
          // @ts-expect-error
          usedFields,
        } = getCurrentFields(currentThingSchema, value);

        const getChildOp = () => {
          if (value.$op === 'create' || value.$op === 'delete') {
            return value.$op;
          }
          // if its un update because linkfields or rolefields updated, but no attributes, then it a noop
          if (value.$op === 'update') {
            const usedDataFields = usedFields.filter((x: string) => dataFieldPaths?.includes(x));
            const usedRoleFields = usedFields.filter((x: string) => roleFieldPaths?.includes(x));
            const usedLinkFields = usedFields.filter((x: string) => linkFieldPaths?.includes(x));
            if (usedDataFields.length > 0) {
              return 'update';
            }
            if (usedRoleFields.length > 0 || usedLinkFields.length > 0) {
              return 'noop';
            }
            throw new Error(`No fields on an $op:"update" for node ${JSON.stringify(value)}`);
          }

          return 'noop';
        };

        const dataObj = {
          ...(value.$entity && { $entity: value.$entity }),
          ...(value.$relation && { $relation: value.$relation }),
          ...(value.$id && { $id: value.$id }),
          ...(value.$tempId && { $tempId: value.$tempId }),
          ...(value.$filter && { $filter: value.$filter }),
          ...shake(pick(value, dataFieldPaths || [''])),
          $op: getChildOp(),
          [Symbol.for('bzId')]: value[Symbol.for('bzId')],
          [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
          // [Symbol.for('dependencies')]: value[Symbol.for('dependencies')],
          [Symbol.for('path')]: value[Symbol.for('path')],
          [Symbol.for('parent')]: value[Symbol.for('parent')],
          [Symbol.for('isRoot')]: value[Symbol.for('isRoot')],
        };

        /// split nodes with multiple ids
        // ? maybe as todo, to enhance the reasoner parsedBQL to consider multiple ids there, and use "like a|b|c" instead of repeating a lot of ids
        if (Array.isArray(dataObj.$id)) {
          dataObj.$id.forEach((id: string) => {
            toNodes({ ...dataObj, $id: id });
          });
        } else {
          toNodes(dataObj);
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
                throw new Error("can't specify a existing and a new element at once. Use an id/filter or a tempId");
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

          const linkTempId = ownRelation ? value.$id || value.$tempId : uuidv4();

          const parentMeta = value[Symbol.for('parent')];
          const parentPath = parentMeta.path;
          const parentNode = !parentPath ? blocks : getNodeByPath(blocks, parentPath);
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
          const edgeType1 = {
            $relation: value[Symbol.for('relation')],
            $op: getLinkObjOp(),
            ...(value.$op === 'unlink' ? { $tempId: linkTempId } : { $id: linkTempId }), // assigning in the parse a temp Id for every linkObj
            [value[Symbol.for('role')]]: value.$tempId || value.$id,
            [value[Symbol.for('oppositeRole')]]: parentId,
            [Symbol.for('bzId')]: uuidv4(),
            // [Symbol.for('dependencies')]: [parentNode[Symbol.for('path')], ...parentNode[Symbol.for('dependencies')]],
            // [Symbol.for('isRoot')]: false,
            [Symbol.for('dbId')]: schema.relations[value[Symbol.for('relation')]].defaultDBConnector.id,
            [Symbol.for('edgeType')]: 'linkField',
            [Symbol.for('path')]: value[Symbol.for('path')],
            [Symbol.for('parent')]: value[Symbol.for('parent')],
          };
          // todo: stuff 😂
          edges.push(edgeType1);
        }

        // CASE 2: IS RELATION AND HAS THINGS IN THEIR ROLES
        if (value.$relation) {
          const val = value as BQLMutationBlock;

          // @ts-expect-error
          const rolesObjFiltered = oFilter(val, (k, _v) => roleFieldPaths.includes(k)) as BQLMutationBlock;

          // console.log('rolesObjFiltered', rolesObjFiltered);

          /// we don't manage cardinality MANY for now, its managed differently if we are on a create/delete op or nested link/unlink op
          const rolesObjOnlyIds = mapEntries(rolesObjFiltered, (k, v) => {
            return [k, v];
          });

          // console.log('rolesObjOnlyIds', rolesObjOnlyIds);
          const objWithMetaDataOnly = oFilter(val, (k, _v) => {
            // @ts-expect-error
            return k.startsWith('$') || k.startsWith('Symbol');
          });

          if (Object.keys(rolesObjFiltered).filter((x) => !x.startsWith('$')).length > 0) {
            // #region 2.1) relations on creation/deletion
            if (val.$op === 'create' || val.$op === 'delete') {
              /// if the relation is being created, then all objects in the roles are actually add
              const getEdgeOp = () => {
                if (val.$op === 'create') return 'link';
                if (val.$op === 'delete') return 'unlink';
                throw new Error('Unsupported parent of edge op');
              };

              /// group ids when cardinality MANY
              const rolesObjOnlyIdsGrouped = mapEntries(rolesObjOnlyIds, (k, v) => {
                if (Array.isArray(v)) {
                  /// Replace the array of objects with an array of ids
                  return [k, v.map((vNested: any) => vNested.$id || vNested)];
                }
                return [k, v.$id || v];
              });

              // todo: validations
              /// 1) each ONE role has only ONE element // 2) no delete ops // 3) no arrayOps, because it's empty (or maybe yes and just consider it an add?) ...
              const edgeType2 = {
                ...objWithMetaDataOnly,
                $relation: val.$relation,
                $op: getEdgeOp(),
                ...rolesObjOnlyIdsGrouped, // override role fields by ids or tempIDs
                [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                [Symbol.for('path')]: value[Symbol.for('path')],
                [Symbol.for('info')]: 'coming from created or deleted relation',
              };
              edges.push(edgeType2);
              return;
            }
            // #endregion
            // region 2.2 relations on nested stuff
            // todo: probably remove the noop here
            if (val.$op === 'noop' || (val.$op === 'update' && Object.keys(rolesObjFiltered).length > 0)) {
              const rolesWithLinks = oFilter(rolesObjOnlyIds, (_k, v) => {
                const currentRoleObj = Array.isArray(v) ? v : [v];
                return currentRoleObj.some(
                  (
                    x: BQLMutationBlock // string arrays are always replaces
                  ) => x.$op === 'link' || x.$op === 'create'
                );
              });
              const rolesWithLinksIds = mapEntries(rolesWithLinks, (k, v: BQLMutationBlock[]) => {
                const currentRoleObj = Array.isArray(v) ? v : [v];
                return [
                  k,
                  currentRoleObj
                    .filter((x) => x.$op === 'link' || x.$op === 'create')
                    .flatMap((y) => y.$id || y.$tempId),
                ];
              });
              const rolesWithUnlinks = oFilter(rolesObjOnlyIds, (_k, v) => {
                const currentRoleObj = Array.isArray(v) ? v : [v]; /// cardinality is tested in previous steps
                return currentRoleObj.some((x: BQLMutationBlock) => x.$op === 'unlink' || x.$op === 'delete');
              });
              // filters the array of objects, taking only those where x.$op === 'unlink'
              const rolesWithUnlinksIds = mapEntries(rolesWithUnlinks, (k, v: BQLMutationBlock[]) => {
                const currentRoleObj = Array.isArray(v) ? v : [v];
                return [
                  k,
                  currentRoleObj
                    .filter((x) => x.$op === 'unlink' || x.$op === 'delete')
                    .flatMap((y) => y.$id || y.$tempId),
                ];
              });
              const rolesWithReplaces = {};
              [
                { op: 'link', obj: rolesWithLinksIds },
                { op: 'unlink', obj: rolesWithUnlinksIds },
                { op: 'replace', obj: rolesWithReplaces }, // todo
              ].forEach((x) => {
                if (Object.keys(x.obj).length) {
                  if (x.op === 'unlink' && Object.keys(x.obj).length > 1)
                    throw new Error(
                      'Not supported yet: Cannot unlink more than one role at a time, please split into two mutations'
                    );

                  const edgeType3 = {
                    ...objWithMetaDataOnly,
                    $relation: val.$relation,
                    $op: x.op,
                    ...x.obj, // override role fields by ids or tempIDs
                    // [Symbol.for('context')]: context,
                    [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                    [Symbol.for('parent')]: value[Symbol.for('parent')],
                    [Symbol.for('path')]: value[Symbol.for('path')],
                    [Symbol.for('info')]: 'updating roleFields',
                  };
                  edges.push(edgeType3);
                }
              });
              // return;
            }
            // #endregion
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
    const existingEdge = acc.find((r) => r.$id === curr.$id && r.$relation === curr.$relation);
    if (existingEdge) {
      const newRelation = {
        ...existingEdge,
        ...curr,
      };
      const newAcc = acc.filter((r) => r.$id !== curr.$id || r.$relation !== curr.$relation);
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
