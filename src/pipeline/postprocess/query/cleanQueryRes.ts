import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { PipelineOperation } from '../../../types';

//import type { TypeDbResponse } from '../../pipeline.ts.old';
type TypeDbResponse = any;

//@ts-expect-error todo: fix this
export const cleanQueryRes: PipelineOperation<TypeDbResponse> = async (req, res) => {
  const { config } = req;
  const { bqlRes } = res;

  if (!bqlRes) {
    return;
  }

  const queryPostHooks = (blocks: any) => {
    return produce(blocks, (draft: any) =>
      traverse(draft, ({ value: val }: TraversalCallbackContext) => {
        if (isObject(val)) {
          // eslint-disable-next-line no-param-reassign
        }
      }),
    );
  };

  const withPostHooks = queryPostHooks(bqlRes);

  const cleanOutput = (blocks: any) => {
    return produce(blocks, (draft: any) =>
      traverse(draft, ({ value: val }: TraversalCallbackContext) => {
        if (isObject(val)) {
          const value = val as any;

          // UNDEFINED FIELDS
          Object.keys(value).forEach((k: string) => {
            if (value[k] === undefined) {
              delete value[k];
            }
          });

          // INTERNAL SYMBOLS
          Object.getOwnPropertySymbols(value).forEach((symbol) => {
            delete value[symbol];
          });

          /// USER FACING METADATA
          if (config.query?.noMetadata === true) {
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

  const cleanedMetadata = cleanOutput(withPostHooks);

  // console.log('parsedTqlRes', JSON.stringify(parsedTqlRes, null, 2));
  res.bqlRes = cleanedMetadata;
  // console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));
};
