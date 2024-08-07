import { isArray, mapEntries } from 'radash';
import type { BormConfig, EnrichedBormSchema } from '../../../types';
import { oFilter } from '../../../helpers';

export const parseSURQLMutation = (props: {
	res: Record<string, any>[][];
	schema: EnrichedBormSchema;
	config: BormConfig;
}) => {
	const { res, config } = props;
	console.log('res!', JSON.stringify(res, null, 2));

	const result = res[0].flatMap((b) => {
		if (isArray(b.result)) {
			return b.result.map((r) => parseRes(r, config));
		}
		return parseRes(b.result, config);
	});
	console.log('result', result);
	return result;
};

const parseRes = (
	block: { after: Record<string, any>; meta: Record<string, any>; input: Record<string, any> },
	config: BormConfig,
) => {
	//console.log('current', block);
	const thing = mapEntries(block.after, (key, value) => [
		key,
		isArray(value) && value.length === 0 ? undefined : value,
	]);

	const nulledAtts = oFilter(block.input, (k: string, v: any) => v === null);
	const withMetaAndId = { ...thing, ...block.meta, ...nulledAtts };

	if (!config.mutation?.noMetadata) {
		return withMetaAndId;
	} else {
		return oFilter(withMetaAndId, (k: string) => !k.startsWith('$'));
	}
};
