import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';
import type { BormConfig, BQLResponse, QueryConfig } from '../../../types';

export const cleanQueryRes = (config: BormConfig, bqlRes: BQLResponse) => {
  if (!bqlRes) {
    return;
  }
  const withPostHooks = queryPostHooks(bqlRes);
  const cleanedMetadata = cleanOutput(withPostHooks, config.query);
  return cleanedMetadata;
};

const queryPostHooks = (blocks: any) => {
  return produce(blocks, (draft: any) =>
    traverse(draft, ({ value: val }: TraversalCallbackContext) => {
      if (isObject(val)) {
        // eslint-disable-next-line no-param-reassign
      }
    }),
  );
};

const cleanOutput = (blocks: any, config?: QueryConfig) => {
  return produce(blocks, (draft: any) =>
    traverse(draft, ({ value: val }: TraversalCallbackContext) => {
      if (isObject(val)) {
        const value = val as any;

        // UNDEFINED FIELDS
        Object.keys(value).forEach((k: string) => {
          if (value[k] === undefined || value[k] === null || (isArray(value[k]) && value[k].length === 0)) {
            if (config?.returnNulls) {
              value[k] = null;
            } else {
              delete value[k];
            }
          }
          if (value[k] === undefined) {
            delete value[k];
          }
        });

        // INTERNAL SYMBOLS
        Object.getOwnPropertySymbols(value).forEach((symbol) => {
          delete value[symbol];
        });

        /// USER FACING METADATA
        if (config?.noMetadata === true) {
          // eslint-disable-next-line no-param-reassign
          Object.keys(value).forEach((k: string) => {
            if (k.startsWith('$')) {
              delete value[k];
            }
          });
        }
      }
    }),
  );
};
