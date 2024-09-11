import { isArray, isObject, mapEntries } from 'radash';
import type { BormConfig, EnrichedBormSchema } from '../../../types';
import { oFilter } from '../../../helpers';

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
				return b.map((r) => {
					if (!isObject(r) || !('meta' in r)) {
						throw new Error(`Internal error: Invalid response from DB: ${JSON.stringify(r)}`);
					}
					return parseRes(r as EnrichedSURQLMutationRes, config);
				});
			}
			if (!isObject(b) || !('meta' in b)) {
				throw new Error(`Internal error: Invalid response from DB: ${JSON.stringify(b)}`);
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

	const nulledAtts = oFilter(block.input || {}, (k: string, v: any) => v === null);
	const withMetaAndId = { ...thing, ...block.meta, ...nulledAtts };

	if (!config.mutation?.noMetadata) {
		return withMetaAndId;
	} else {
		return oFilter(withMetaAndId, (k: string) => !k.startsWith('$'));
	}
};
