import { isObject } from 'radash';
import type { PipelineOperation, BQLResponseSingle, BormConfig } from '../../../../../types';
import { produce } from 'immer';
import type { SurrealDbResponse, EnrichedBqlQuery, EnrichedBqlQueryRelation, EnrichedBqlQueryEntity, EnrichedBqlQueryAttribute } from '../../../types/base'

const processNull = (config: BormConfig, obj: Record<string, unknown>) => {
  for (const key in obj) {
    const value = obj[key]

    if (config.query?.returnNulls) {
      if (Array.isArray(value) && value.length === 0) {
        obj[key] = null
        continue
      }
    } else {
      if (value === null) {
        delete obj[key]
        continue
      }

      if (Array.isArray(value) && value.length === 0) {
        delete obj[key]
        continue
      }
    }
  }
}

const cleanUpObj = ({ config, item, query }: {
  query: EnrichedBqlQuery,
  config: BormConfig, item: BQLResponseSingle
}) => {
  processNull(config, item)

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

  // filter out id
  if (query.$idNotIncluded) {
    delete item["id"]
  }
}

export const cleanQueryRes: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  const { config, enrichedBqlQuery } = req;
  const { bqlRes } = res;

  if (!bqlRes) {
    return;
  }

  const querySet = enrichedBqlQuery as Array<EnrichedBqlQuery>

  if (querySet.length > 1) {
    throw new Error('unimplemented')
  }

  const query = enrichedBqlQuery[0]

  const cleanedMetadata = produce(bqlRes, (payload) => {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        cleanUpObj({
          config, item, query
        })
      }
    } else {
      cleanUpObj({
        config, item: payload, query
      })
    }
  })

  res.bqlRes = cleanedMetadata;
};
