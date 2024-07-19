import { isArray } from 'radash';
import type { BQLMutationBlock, EnrichedBormSchema } from '../../../../types';
import { getOp } from '../shared/getOp';
import { getThingType } from '../../../../helpers';
import { nanoid } from 'nanoid';

export const setRootMeta = (node: { $root: BQLMutationBlock | BQLMutationBlock[] }, schema: EnrichedBormSchema) => {
	const rootArray = isArray(node.$root) ? node.$root : [node.$root];

	const withMetadataRootArray = rootArray.map((rootNode) => {
		const rootOp = getOp(rootNode, rootNode, schema);

		const withMetadata = {
			...(rootNode.$thing ? {} : { $thing: rootNode.$entity || rootNode.$relation }),
			...(rootNode.$thingType ? {} : { $thingType: getThingType(rootNode, schema) }),
			...(rootNode.$op ? {} : { $op: rootOp }),
			...(rootNode.$bzId ? {} : { $bzId: `R_${nanoid()}` }),
		};
		// eslint-disable-next-line no-param-reassign
		return { ...withMetadata, ...rootNode };
	});
	// eslint-disable-next-line no-param-reassign
	node.$root = isArray(node.$root) ? withMetadataRootArray : withMetadataRootArray[0];
};
