/* eslint-disable no-param-reassign */
import { clone, isArray, isObject } from 'radash';
import { deepCurrent, getCurrentSchema } from '../../../../helpers';
import type { BormConfig, EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../../../types';
import { DBNode } from '../../../../types/symbols';
import { getTriggeredActions } from '../shared/getTriggeredActions';

export const preHookValidations = (
  node: EnrichedBQLMutationBlock,
  field: string,
  schema: EnrichedBormSchema,
  config: BormConfig,
) => {
  const subNodes = isArray(node[field]) ? node[field] : [node[field]];
  for (const subNode of subNodes as EnrichedBQLMutationBlock[]) {
    if ('$thing' in subNode) {
      if (subNode.$fields) {
        // change machine context so we are sure we run preQueryDeps before coming back to here
        continue;
      }

      const { requiredFields, enumFields, fnValidatedFields, dataFields } = getCurrentSchema(schema, subNode);

      /// Required fields
      if ('$op' in subNode && subNode.$op === 'create') {
        for (const field of requiredFields) {
          if (!(field in subNode)) {
            throw new Error(`[Validations] Required field "${field}" is missing.`);
          }
        }
      }

      /// Enums
      if (('$op' in subNode && subNode.$op === 'update') || subNode.$op === 'create') {
        for (const field of enumFields) {
          if (field in subNode) {
            const enumOptions = dataFields?.find((df) => df.path === field)?.validations?.enum;
            if (!enumOptions) {
              throw new Error(`[Validations] Enum field "${field}" is missing enum options.`);
            }
            if (isArray(subNode[field])) {
              for (const val of subNode[field]) {
                if (val !== null && !enumOptions.includes(val)) {
                  throw new Error(`[Validations] Option "${val}" is not a valid option for field "${field}".`);
                }
              }
            } else if (enumOptions && !enumOptions.includes(subNode[field]) && !(subNode[field] === null)) {
              throw new Error(`[Validations] Option "${subNode[field]}" is not a valid option for field "${field}".`);
            }
          }
        }
      }

      /// fn
      if (('$op' in subNode && subNode.$op === 'update') || subNode.$op === 'create') {
        for (const field of fnValidatedFields as string[]) {
          if (field in subNode) {
            try {
              const fn = dataFields?.find((df) => df.path === field)?.validations?.fn;
              if (!fn) {
                throw new Error('Missing validation function.');
              }
              // @ts-expect-error - TODO
              if (!fn(subNode[field])) {
                throw new Error('Failed validation function.');
              }
            } catch (error: any) {
              throw new Error(`[Validations:attribute:${field}] ${error.message}`);
            }
          }
        }
      }

      /// Node validations
      if (isObject(subNode) && '$thing' in subNode) {
        const currentThing = subNode.$thing;
        const value = subNode as EnrichedBQLMutationBlock;

        const parentNode = clone(deepCurrent(node));
        const currentNode = clone(deepCurrent(value));
        const userContext = (config.mutation?.context || {}) as Record<string, any>;
        const dbNode = clone(deepCurrent<EnrichedBQLMutationBlock | Record<string, never>>(subNode[DBNode] || {})) as
          | EnrichedBQLMutationBlock
          | Record<string, never>;

        const triggeredActions = getTriggeredActions(value, schema);
        for (const action of triggeredActions) {
          if (action.type === 'validate') {
            if (action.severity !== 'error') {
              continue; // in borm we only use the errors
            }

            try {
              //! Todo: Sandbox the function in nodeCompute() instead of the existing fieldCompute()
              const validationResult = action.fn(currentNode, parentNode, userContext, dbNode);

              if (validationResult === false) {
                throw new Error(`${action.message}.`);
              }
              if (validationResult !== true) {
                throw new Error("Validation function's output is not a boolean value.");
              }
            } catch (error: any) {
              throw new Error(`[Validations:thing:${currentThing}] ${error.message}`);
            }
          }
        }
      }
    }
  }
};
