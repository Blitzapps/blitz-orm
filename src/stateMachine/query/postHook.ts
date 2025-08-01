import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { getNodeByPath, traverse } from 'object-traversal';
import { isObject } from 'radash';
import { computeField } from '../../engine/compute';
import { getCurrentSchema } from '../../helpers';
import type { BQLResponseMulti, EnrichedBormSchema, EnrichedBQLQuery } from '../../types';
import { QueryPath } from '../../types/symbols';

export const postHooks = async (
  schema: EnrichedBormSchema,
  enrichedBqlQuery: EnrichedBQLQuery[],
  bqlRes: BQLResponseMulti,
) => {
  if (!bqlRes) {
    return;
  }

  const queryPostHooks = (blocks: any) => {
    //console.log('queryPostHooks', blocks[0]);
    return produce(blocks, (draft: any) =>
      traverse(draft, ({ value: val }: TraversalCallbackContext) => {
        if (isObject(val)) {
          const value = val as Record<string, any>;

          if (!value.$thing) {
            // JSON object.
            return;
          }
          if (value.$thing) {
            const currentSchema = getCurrentSchema(schema, value);
            const { virtualFields } = currentSchema;

            const queryPath = value[QueryPath as any];
            if (!queryPath) {
              throw new Error(`[Internal] QueryPath is missing. Value: ${JSON.stringify(value)}`);
            }

            const originalNode = getNodeByPath(enrichedBqlQuery, queryPath);
            if (originalNode.$fieldType === 'ref') {
              return; // Not supported with refFields
            }
            const queriedFields = originalNode.$fields.map((f: any) => f.$path);
            const excludedFields = originalNode.$excludedFields;

            /// ADD VIRTUAL FIELDS
            virtualFields.forEach((virtualFieldPath) => {
              if (
                excludedFields?.includes(virtualFieldPath) ||
                (queriedFields.length > 0 && !queriedFields.includes(virtualFieldPath))
              ) {
                return;
              }
              const field = currentSchema.dataFields?.find((f) => f.path === virtualFieldPath);

              if (!field?.default) {
                ///then is a virtual field and should be computed from the DB already
                if (value[virtualFieldPath] === undefined) {
                  throw new Error(`[Internal] Virtual field: No db value found for virtual field: ${virtualFieldPath}`);
                }
              } else {
                const computedValue = computeField({
                  currentThing: value,
                  fieldSchema: field,
                  mandatoryDependencies: true,
                });
                value[virtualFieldPath] = computedValue;
              }
            });

            //EXCLUDE FIELDS
            if (excludedFields) {
              //this should only happen for id fields, as we query them always. Might remove also dependencies in the future
              //todo: move this as a last step of the machine, as a cleaner. Note: we are skipping it now for reference fields but we should not
              excludedFields.forEach((excludedField: string) => {
                if (typeof excludedField !== 'string') {
                  throw new Error('[Internal] ExcludedField is not a string');
                }
                delete value[excludedField];
              });
            }
          }
        }
      }),
    );
  };

  const postHooksBqlRes = queryPostHooks(bqlRes);
  return postHooksBqlRes;
};
