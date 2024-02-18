import { isArray, isObject } from 'radash';
import type { BQLMutationBlock } from '../../../../types';

export const replaceToObj = (node: BQLMutationBlock, field: string) => {
	if ((isArray(node[field]) ? node[field] : [node[field]]).every((child: unknown) => typeof child === 'string')) {
		if (isArray(node[field]) ? node[field] : [node[field]].some((child: unknown) => !isObject(child))) {
			throw new Error('[Internal] At least one child is not an object');
		}
	}
};
