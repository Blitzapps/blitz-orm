import { produce } from 'immer';
import type { BormConfig, BQLResponseSingle, PipelineOperation, Request } from '../../../../../types';
import type { EnrichedBqlQuery, SurrealDbResponse } from '../../../types/base';

// expecting mutation, therefore disable reassign rule here
/* eslint-disable no-param-reassign */
const processNull = (config: BormConfig, obj: Record<string, unknown>) => {
  for (const key in obj) {
    const value = obj[key];

    if (config.query?.returnNulls) {
      if (Array.isArray(value) && value.length === 0) {
        obj[key] = null;
      }
    } else {
      if (value === null) {
        delete obj[key];
        continue;
      }

      if (Array.isArray(value) && value.length === 0) {
        delete obj[key];
      }
    }
  }
};

const cleanUpObj = ({
  config,
  item,
  query,
  schema,
}: {
  schema: Request['schema'];
  query: EnrichedBqlQuery;
  config: BormConfig;
  item: BQLResponseSingle;
}) => {
  const thingSchema = schema[query.$thingType === 'entity' ? 'entities' : 'relations'][query.$thing];

  processNull(config, item);

  // INTERNAL SYMBOLS
  for (const symbol of Object.getOwnPropertySymbols(item)) {
    delete item[symbol];
  }

  /// USER FACING METADATA
  if (config.query?.noMetadata === true) {
    // eslint-disable-next-line no-param-reassign
    for (const k of Object.keys(item)) {
      if (k.startsWith('$')) {
        delete item[k];
      }
    }
  }

  // filter out id
  if (query.$idNotIncluded) {
    const idField = thingSchema.idFields?.[0];
    delete item[idField ?? 'id'];
  }
};

//@ts-expect-error todo: fix this
export const cleanQueryRes: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  const { config, enrichedBqlQuery, schema } = req;
  const { bqlRes } = res;

  if (!bqlRes) {
    return;
  }

  const querySet = enrichedBqlQuery as Array<EnrichedBqlQuery>;

  // TODO handle batch queries
  if (querySet.length > 1) {
    throw new Error('batch query unimplemented');
  }

  const [query] = enrichedBqlQuery;

  const cleanedMetadata = produce(bqlRes, (payload) => {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        cleanUpObj({
          config,
          item,
          query,
          schema,
        });
      }
    } else {
      cleanUpObj({
        config,
        item: payload,
        query,
        schema,
      });
    }
  });

  res.bqlRes = cleanedMetadata;
};
