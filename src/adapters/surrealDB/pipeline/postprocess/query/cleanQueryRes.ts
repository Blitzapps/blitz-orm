import { isObject } from 'radash';
import type { PipelineOperation, BQLResponseSingle, BormConfig } from '../../../../../types';
import { produce } from 'immer';
import type { SurrealDbResponse } from '../../../types/base'

const mutateItem = (config: BormConfig, item: BQLResponseSingle) => {
  // INTERNAL SYMBOLS
  Object.getOwnPropertySymbols(item).forEach((symbol) => {
    delete item[symbol];
  });

  /// USER FACING METADATA
  if (config.query?.noMetadata === true) {
    // eslint-disable-next-line no-param-reassign
    Object.keys(item).forEach((k: string) => {
      if (k.startsWith('$')) {
        delete item[k];
      }
    });
  }
}

export const cleanQueryRes: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  const { config } = req;
  const { bqlRes } = res;

  if (!bqlRes) {
    return;
  }

  const cleanedMetadata = produce(bqlRes, (payload) => {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        mutateItem(config, item)
      }
    } else {
      mutateItem(config, payload)
    }
  })

  res.bqlRes = cleanedMetadata;
};
