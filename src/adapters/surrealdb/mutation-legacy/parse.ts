import { isArray, isObject, mapEntries } from 'radash';
import { oFilter } from '../../../helpers';
import type { BormConfig, EnrichedBormSchema } from '../../../types';

export type EnrichedSURQLMutationRes = {
  meta: Record<string, any>;
  input?: Record<string, any>;
  after?: Record<string, any>;
};

export const parseSURQLMutation = (props: {
  res: EnrichedSURQLMutationRes[][];
  schema: EnrichedBormSchema;
  config: BormConfig;
}) => {
  const { res, config } = props;
  //console.log('res!', JSON.stringify(res, null, 2));

  const result = res
    .flat() //Todo: try to get it flat instead of [][]
    .filter(Boolean)
    .flatMap((b: object) => {
      if (isArray(b)) {
        return b.filter((r) => isObject(r) && 'meta' in r).map((r) => parseRes(r as EnrichedSURQLMutationRes, config));
      }
      if (!isObject(b) || !('meta' in b)) {
        // Skip non-Delta results (e.g. intermediate record IDs from IF/UPDATE expressions)
        return [];
      }
      return parseRes(b as EnrichedSURQLMutationRes, config);
    });
  return result;
};

const parseRes = (block: EnrichedSURQLMutationRes, config: BormConfig) => {
  const thing = mapEntries(block.after || {}, (key, value) => [
    key,
    key === 'id' ? value.id : isArray(value) && value.length === 0 ? undefined : value,
  ]);

  const nulledAtts = oFilter(block.input || {}, (_k: string, v: any) => v === null);
  const withMetaAndId = { ...thing, ...block.meta, ...nulledAtts };

  if (!config.mutation?.noMetadata) {
    return withMetaAndId;
  }
  return oFilter(withMetaAndId, (k: string) => !k.startsWith('$'));
};
