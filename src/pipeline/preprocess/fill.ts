import produce, { current } from 'immer';
import { traverse, TraversalCallbackContext, getNodeByPath } from 'object-traversal';
import { isObject, listify } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { getCurrentFields, getCurrentSchema, oFind } from '../../helpers';
import {
  BQLMutationBlock,
  EnrichedBormRelation,
  EnrichedLinkField,
  EnrichedRoleField,
  FilledBQLMutationBlock,
} from '../../types';
import type { PipelineOperation } from '../pipeline';

// parseBQLQueryObjectives:
// 1) Validate the query (getRawBQLQuery)
// 2) Prepare it in a universally way for any DB (output an enrichedBQLQuery)

export const fillBQLMutation: PipelineOperation = async (req) => {
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

          if (value.$op === 'create' && value.$id) {
            throw new Error("Can't write to computed field $id. Try writing to the id field directly.");
          }
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

          const { usedLinkFields, usedRoleFields } = getCurrentFields(currentSchema, value);

          type RoleFieldMap = {
            fieldType: 'roleField';
            path: string;
            schema: EnrichedRoleField;
          };

          type LinkFieldMap = {
            fieldType: 'linkField';
            path: string;
            schema: EnrichedLinkField;
          };

          const usedLinkFieldsMap = usedLinkFields.map(
            (linkFieldPath): LinkFieldMap => ({
              fieldType: 'linkField',
              path: linkFieldPath,
              // @ts-expect-error
              schema: currentSchema.linkFields.find((y) => y.path === linkFieldPath),
            })
          );

          const usedRoleFieldsMap =
            currentSchema.thingType === 'relation'
              ? usedRoleFields.map(
                  (roleFieldPath): RoleFieldMap => ({
                    fieldType: 'roleField',
                    path: roleFieldPath,
                    schema: oFind(currentSchema.roles, (k) => k === roleFieldPath) as EnrichedRoleField,
                  })
                )
              : [];

          /// validations
          /// If the current value uses at least one linkfield with target === 'role' and at least another field with target === 'relation', throw an unsupported (yet) error
          if (
            usedLinkFieldsMap.some((x) => x.schema?.target === 'role') &&
            usedLinkFieldsMap.some((x) => x.schema?.target === 'relation')
          ) {
            throw new Error(
              `Unsupported: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.`
            );
          }

          /// multiple possible things in a role
          const multiplayedRoles = usedRoleFieldsMap.filter(
            (roleField) => [...new Set(roleField.schema.playedBy?.map((x) => x.thing))].length !== 1
          );
          if (multiplayedRoles.length > 1) {
            throw new Error(
              `Field: ${
                multiplayedRoles[0].path
              } - If a role can be played by multiple things, you must specify the thing in the mutation: ${JSON.stringify(
                multiplayedRoles[0].schema.playedBy
              )}. Schema: ${JSON.stringify(multiplayedRoles[0].schema)}`
            );
          }

          const currentPath = meta.nodePath;

          /// <---------------mutating children objects ---------------->
          [...usedLinkFieldsMap, ...usedRoleFieldsMap]?.forEach((currentField) => {
            const currentValue = value[currentField.path];
            /// ignore undefined
            if (currentValue === undefined) return;
            // console.log(':::', { currentField });

            const currentFieldSchema =
              currentField.fieldType === 'roleField' ? currentField.schema : currentField.schema;

            if (!currentFieldSchema) throw new Error(`Field ${currentField.path} not found in schema`);

            const currentEdgeSchema =
              // @ts-expect-error
              currentField.fieldType === 'roleField' ? currentFieldSchema?.playedBy[0] : currentFieldSchema;

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

            /// <-- VALIDATIONS -->
            if (!currentFieldSchema) {
              throw new Error(`Field ${currentField.path} not found in schema`);
            }

            const oppositeFields =
              currentField.fieldType === 'linkField'
                ? (currentFieldSchema as EnrichedLinkField)?.oppositeLinkFieldsPlayedBy
                : (currentFieldSchema as EnrichedRoleField)?.playedBy;

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

            if (currentFieldSchema.cardinality === 'ONE') {
              if (Array.isArray(currentValue)) {
                throw new Error(`Can't have an array in a cardinality === ONE link field`);
              }
              // if is only one object, current is not a create, and the object has no op, throw error
            }

            // cardinality many are always arrays, unless it's an object that specifies an arrayOp like
            if (
              currentFieldSchema.cardinality === 'MANY' &&
              currentValue !== null &&
              !Array.isArray(currentValue) &&
              !currentValue.$arrayOp
            ) {
              throw new Error(
                `${
                  // @ts-expect-error
                  currentField.fieldType === 'linkField' ? currentFieldSchema.path : currentFieldSchema.name
                } is a cardinality === MANY thing. Use an array or a $arrayOp object`
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
              [Symbol.for('relFieldSchema') as any]: currentFieldSchema,
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

            /// we already know it's 'MANY'
            if (Array.isArray(currentValue)) {
              // todo: check for arrays that are values and not vectors
              if (currentValue.every((x) => isObject(x))) {
                value[currentField.path] = currentValue.map((y) => {
                  /// when a tempId is specified, in a relation, same as with $id, is a link by default
                  if (y.$tempId && currentSchema.thingType === 'relation' && (y.$op === 'link' || !y.$op)) {
                    // throw new Error(`To be done (not allowed with current borm version)`);
                    return y.$tempId;
                  }
                  return {
                    ...childrenThingObj,
                    ...y,
                  };
                });
                // console.log('[obj-arr]value', value[field as string]);
              } else if (currentValue.every((x) => typeof x === 'string')) {
                value[currentField.path] = currentValue.map((y) => ({
                  ...childrenThingObj,
                  $op: value.$op === 'create' ? 'link' : 'replace',
                  $id: y,
                }));
              } else throw new Error(`Invalid array value for ${currentField.path}`);
            }

            /// we already know it's 'ONE'
            if (typeof currentValue === 'string') {
              value[currentField.path] = {
                ...childrenThingObj,
                $op: value.$op === 'create' ? 'link' : 'replace', // if the parent is being created, then is not a replace, is a new link
                $id: currentValue, // todo: now all strings are ids and not tempIds, but in the future this might change
              };
            }

            /// can be both MANY or ONE
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
  // console.log('withObjects', withObjects);

  const fill = (blocks: BQLMutationBlock | BQLMutationBlock[]): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
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
          // const currentTempId = value.$tempId || uuuiidv4();

          const nodePathArray = meta.nodePath?.split('.');

          const notRoot = nodePathArray?.filter((x) => Number.isNaN(parseInt(x, 10))).join('.');

          const currentPath = !notRoot
            ? meta.nodePath || '' /// keep the number in the root or set to root ''
            : Array.isArray(parent)
            ? nodePathArray?.slice(0, -1).join('.')
            : meta.nodePath;

          const currentSchema = getCurrentSchema(schema, value);
          // todo:
          const { unidentifiedFields, dataFields, roleFields, linkFields } = getCurrentFields(currentSchema, value);

          /// get parent node
          const parentMeta = current(value)[Symbol.for('parent') as any];
          const parentPath = notRoot && parentMeta.path;
          const parentNode = !parentPath ? draft : getNodeByPath(draft, parentPath); /// draft instead of blocks as the $op is computed
          const parentOp = parentNode?.$op;

          if (notRoot && !parentOp) {
            throw new Error('Error: Parent $op not detected');
          }

          const currentFieldSchema = value[Symbol.for('relFieldSchema') as any];

          /// Replaces are temporally unsupported, they should work tho when the currentValue is being created (so we are sure it is an add and not a replace)
          if (value.$op === 'replace') {
            if (parentOp !== 'create') {
              throw new Error('Unsupported: For replaces, please do an unlink + a link instead');
            } else value.$op = 'link';
          }

          // console.log('currentValue', isDraft(value) ? current(value) : value);

          const hasUpdatedDataFields = Object.keys(value).some((x) => dataFields?.includes(x));

          const hasUpdatedChildren = Object.keys(value).some((x) => [...roleFields, ...linkFields]?.includes(x));
          const getOp = () => {
            if (value.$op) return value.$op; // if there is an op, then thats the one
            /// nested objects are create by default, unless is too ambiguous
            if (
              notRoot &&
              !value.$id &&
              !value.$tempId &&
              parentOp !== 'create' &&
              currentFieldSchema.cardinality === 'ONE'
            ) {
              throw new Error(`Please specify if it is a create or an update: ${JSON.stringify(value)} `);
            }
            if (value.$tempId && notRoot) return 'link'; // if there is a tempId is always a link,or it's the root unless an unlink op has been set
            if (value.$tempId && !notRoot) return 'create';
            // todo: can move these to the first level traversal
            if ((value.$id || value.$filter) && hasUpdatedDataFields) return 'update'; // if there is an id or a filter, is an update. If it was a delete,it has been specified
            if ((value.$id || value.$filter) && notRoot && !hasUpdatedDataFields && !hasUpdatedChildren) return 'link';
            if (!value.$filter && !value.$id && !value.$tempId) return 'create'; // if it is not a delete, or an update, is a create (for this V0, missing link, unlink)
            if ((value.$id || value.$filter) && !hasUpdatedDataFields && hasUpdatedChildren) return 'match';
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
              if(!value.$tempId) {
                value.$tempId = `all-${uuidv4()}`;
              }
              /// if value.$idTemp id nothing to change, it keeps the current tempId
            }
          }

          if (unidentifiedFields.length > 0) {
            throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
          }
        }
      })
    );
  };

  const filledBQLMutation = fill(withObjects);

  // console.log('filledBQLMutation', filledBQLMutation);

  if (Array.isArray(filledBQLMutation)) {
    req.filledBqlRequest = filledBQLMutation as FilledBQLMutationBlock[];
  } else {
    req.filledBqlRequest = filledBQLMutation as FilledBQLMutationBlock;
  }
};
