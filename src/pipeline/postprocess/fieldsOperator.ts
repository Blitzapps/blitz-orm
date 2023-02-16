import { isObject } from 'radash';

import type { BormConfig, BQLField, BQLResponseSingle } from '../../types';
import type { PipelineOperation } from '../pipeline';

const filterBQLRes = (row: BQLResponseSingle, config: BormConfig, fields: BQLField[] | undefined) =>
  row === null || typeof row === 'string'
    ? row
    : Object.entries(row).reduce((acc, [k, v]): any => {
        const isMetadataDisabled = !!(config.query?.noMetadata || config.mutation?.noMetadata);
        const isWhitelisted = !fields || fields.length === 0 || fields.includes(k);
        const nestedFields = fields?.find((f) => isObject(f) && f.$path === k);
        const isMetadata = k.startsWith('$');
        const isSymbol = typeof k === 'symbol';
        if (isSymbol || (isMetadataDisabled && isMetadata) || (!isMetadata && !isWhitelisted && !nestedFields)) {
          // * Drop property
          return acc;
        }
        if (Array.isArray(v)) {
          // * Recurse into array
          return {
            ...acc,
            [k]: v.map((vChild: BQLResponseSingle) =>
              // @ts-expect-error if nestedFields is string, it's undefined and will be ignored
              filterBQLRes(vChild, config, nestedFields?.$fields)
            ),
          };
        }
        if (isObject(v)) {
          // * Recurse into object
          return {
            ...acc,
            [k]: filterBQLRes(
              v as BQLResponseSingle,
              config,
              // @ts-expect-error if nestedFields is string, it's undefined and will be ignored
              nestedFields?.$fields
            ),
          };
        }
        // * Keep property as is
        return { ...acc, [k]: v };
      }, {});

export const processFieldsOperator: PipelineOperation = async (req, res) => {
  const { bqlRequest, config } = req;
  if (!res.bqlRes) {
    throw new Error('BQL response not parsed');
  }
  let filtered = res.bqlRes;
  if (filtered === null) {
    return;
  }

  const initialFields = bqlRequest?.query?.$fields;
  filtered = Array.isArray(filtered)
    ? // @ts-expect-error - isArray checks for array
      res.bqlRes.map((r: BQLResponseSingle) => filterBQLRes(r, config, initialFields))
    : filterBQLRes(filtered, config, initialFields);

  res.bqlRes = filtered;
};
