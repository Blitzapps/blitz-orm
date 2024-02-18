import type { BQLMutationBlock, EnrichedBormSchema } from '../../../../types';
import { getOp } from './getOp';

export const setRootMeta = (node: BQLMutationBlock, parentBzId: string, schema: EnrichedBormSchema) => {
	const rootOp = getOp({} as BQLMutationBlock, node.$root, schema);

	const withMetadata = {
		...(node.$root.$thing ? {} : { $thing: node.$root.$entity || node.$relation }),
		...(node.$root.$thingType ? {} : { $thingType: node.$root.$entity ? 'entity' : 'relation' }),
		...(node.$root.$op ? {} : { $op: rootOp }),
		...(node.$root.$bzId ? {} : { $bzId: parentBzId }),
	};
	// eslint-disable-next-line no-param-reassign
	node.$root = { ...withMetadata, ...node.$root };
};
