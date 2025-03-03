/* eslint-disable no-param-reassign */
import { current, isDraft, produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';
import { getCurrentFields, getCurrentSchema, getFieldSchema } from '../../../helpers';
import type { BQLMutationBlock, BormConfig, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { SharedMetadata } from '../../../types/symbols';
import { enrichFilter } from '../../query/bql/enrich';
import { computeFields } from './enrichSteps/computeFields';
import { enrichChildren } from './enrichSteps/enrichChildren';
import { preHookTransformations } from './enrichSteps/preHookTransformations';
import { preHookValidations } from './enrichSteps/preHookValidations';
import { preValidate } from './enrichSteps/preValidate';
import { replaceToObj, replaceToObjRef } from './enrichSteps/replaces';
import { setRootMeta } from './enrichSteps/rootMeta';
import { splitMultipleIds } from './enrichSteps/splitIds';
import { unlinkAll } from './enrichSteps/unlinkAll';
import { dependenciesGuard } from './guards/dependenciesGuard';
import { doAction } from './shared/doActions';
import { validateChildren } from './shared/validateOp';

const cleanStep = (node: BQLMutationBlock, field: string) => {
  if (node[field] === undefined) {
    delete node[field];
  }

  if (field === '$tempId') {
    if (doAction('set_tempId', node)) {
      if (node.$tempId?.startsWith('_:')) {
        const tempId = node.$tempId.substring(2);
        node.$tempId = tempId;
        node.$bzId = tempId;
      } else {
        throw new Error('[Wrong format] TempIds must start with "_:"');
      }
    } else {
      throw new Error('[Internal] TempId already modified');
    }
  }

  if (field === '$filter') {
    if (node.$filter && Object.keys(node.$filter).length === 0) {
      node.$filter = undefined;
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dataFieldStep = (_node: BQLMutationBlock, _field: string) => {};

export const enrichBQLMutation = (
  blocks: BQLMutationBlock | BQLMutationBlock[] | EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
  schema: EnrichedBormSchema,
  config: BormConfig,
): EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[] => {
  const rootBlock = { $rootWrap: { $root: blocks } };
  // @ts-expect-error todo
  const has$Fields = dependenciesGuard(Array.isArray(blocks) ? blocks : [blocks]);

  const result = produce(rootBlock, (draft) =>
    traverse(draft, ({ value, parent, key, meta }: TraversalCallbackContext) => {
      if (!parent || !key) {
        return;
      }

      if (isObject(value)) {
        const paths = meta.nodePath?.split('.') || [];
        if (paths.some((p) => p.startsWith('%'))) {
          //we don't go inside %vars even if they are objects
          return;
        }

        if ('$root' in value) {
          // This is hte $root object, we will split the real root if needed in this iteration
        } else if (!('$thing' in value || '$entity' in value || '$relation' in value)) {
          const toIgnore = ['$fields', '$dbNode', '$filter'];
          const lastPath = paths.at(-1);
          const secondToLastPath = paths.at(-2);
          if (key === '$root') {
            throw new Error('Root things must specify $entity or $relation');
          }
          if (
            !toIgnore.includes(lastPath || '') &&
            !toIgnore.includes(secondToLastPath || '') &&
            !lastPath?.startsWith('%') &&
            !secondToLastPath?.startsWith('%')
          ) {
            throw new Error(
              `[Internal] This object has not been initiated with a $thing: ${JSON.stringify(isDraft(value) ? current(value) : value)}`,
            );
          }
        }

        const node = value as EnrichedBQLMutationBlock;
        const isFilter = paths.includes('$filter');

        if ('$filter' in node && node.$filter) {
          node.$filter = enrichFilter(node.$filter, node.$thing, schema);
        }

        Object.keys(node).forEach((field) => {
          ///1. Clean step
          cleanStep(node, field);
          if (field !== '$root' && isFilter) {
            return;
          }

          if (field !== '$root' && (field.startsWith('$') || field.startsWith('%'))) {
            return;
          }

          const fieldSchema =
            field !== '$root'
              ? getFieldSchema(schema, node, field)
              : ({ [SharedMetadata]: { fieldType: 'rootField' } } as any);
          if (!fieldSchema) {
            throw new Error(`[Internal] Field ${field} not found in schema`);
          }

          //console.log('field1', field, fieldSchema);

          const { fieldType } = fieldSchema[SharedMetadata];
          const relField = ['linkField', 'roleField'].includes(fieldType);
          const refField = fieldType === 'refField';
          const rootField = fieldType === 'rootField';

          //console.log('field2', field, fieldType);
          ///2.DATAFIELD STEP
          if (fieldType === 'dataField') {
            return dataFieldStep(node, field);
          }

          ///3.NESTED OBJECTS: RoleFields and linkFields

          // 3.1 splitIds

          ///3.2$thing => linkField or roleField or references

          ///In the next steps we have (isArray(node[field]) ? node[field] : [node[field]]) multiple times, because it might mutate, can't replace by a var

          /// 3.2.1 replaces
          if (relField || refField) {
            if (node[field] === null) {
              relField ? unlinkAll(node, field, fieldSchema) : undefined;
            } else {
              //todo: replaceObj in refFields, as we are just doing some validation
              relField ? replaceToObj(node, field) : replaceToObjRef(node, field, fieldSchema);
            }
          }

          //3.2.2 root $thing
          if (rootField) {
            if (!('$root' in node)) {
              throw new Error(`[Internal] Field ${field} is a rootField but the object is not a root`);
            }
            const rootNode = node as unknown as { $root: BQLMutationBlock | BQLMutationBlock[] };
            setRootMeta(rootNode, schema);
          }

          if (relField || refField) {
            // 3.2.3 BQL pre-validations => All validations should happen on subNode, if else, leaves are skipped
            preValidate(node, field, fieldSchema, paths);
          }
          /// 3.2.4 children enrichment
          //redefining childrenArray as it might have changed

          if (relField || refField) {
            enrichChildren(node, field, fieldSchema, schema);

            //validateChildren
            validateChildren(node, node[field], schema);
          }

          if (relField || rootField) {
            //3.2.5 splitIds()
            //this simplifies typeDB mutations
            splitMultipleIds(node, field, schema);

            /// 3.2.6 Field computes on nested created nodes. It only runs in CREATE operations.
            computeFields(node, field, schema);

            // 3.2.7
            //#region BQL validations
            //Ideally, in updates we could not demand the $thing, but then we need to check that the field belongs to all the potential $things
            const toValidate = isArray(node[field]) ? node[field] : [node[field]];

            toValidate.forEach((subNode: BQLMutationBlock) => {
              const subNodeSchema = getCurrentSchema(schema, subNode);
              const { unidentifiedFields, usedLinkFields, usedFields, fields } = getCurrentFields(
                subNodeSchema,
                subNode,
              );

              //Check that every used field is in the fields array
              usedFields.forEach((uf) => {
                if (!fields.includes(uf)) {
                  throw new Error(`[Schema] Field ${uf} not found in the schema`);
                }
              });

              if (unidentifiedFields.length > 0) {
                throw new Error(`Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(value)}`);
              }
              //Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.
              if (usedLinkFields.length > 1) {
                const usedLinkFieldsSchemas = subNodeSchema.linkFields?.filter((lf) =>
                  usedLinkFields.includes(lf.path),
                );
                /// Check if at least two of the usedLinkFields schemas, share same relation and have different targets
                usedLinkFieldsSchemas?.some((lf1, i) => {
                  return usedLinkFieldsSchemas.some((lf2, j) => {
                    if (i !== j && lf1.target !== lf2.target && lf1.relation === lf2.relation) {
                      throw new Error(
                        "[Wrong format]: Can't use a link field with target === 'role' and another with target === 'relation' in the same mutation.",
                      );
                    }
                  });
                });
              }
            });

            if (!has$Fields) {
              //if it has $field, it has dependencies so its still not ready for transformation
              //#endregion BQL validations

              // 3.3.8
              //#region pre-hook transformations
              preHookTransformations(node, field, schema, config);
              //#endregion pre-hook transformations

              // 3.2.9
              //#region pre-hook validations
              preHookValidations(node, field, schema, config);
              //#endregion pre-hook validations
            }
          }
        });
      }
    }),
  );

  if (isArray(result.$rootWrap.$root)) {
    return result.$rootWrap.$root as EnrichedBQLMutationBlock[];
  }
  return result.$rootWrap.$root as EnrichedBQLMutationBlock;
};
