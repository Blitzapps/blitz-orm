/* eslint-disable no-param-reassign */
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { EnrichedBQLMutationBlock } from '../../../../types';

export const dependenciesGuard = (blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]) => {
	if (!blocks) {
		throw new Error('[BQLE-M-PQ-1] No blocks found');
	}

	let hasFields = false;
	traverse(blocks, ({ parent, key, value }) => {
		if (parent && key && !key.includes('$') && isObject(parent)) {
			const values = Array.isArray(parent[key]) ? parent[key] : [parent[key]];
			// @ts-expect-error todo
			values.forEach((val) => {
				if (isObject(val)) {
					// @ts-expect-error todo
					if (val.$fields) {
						hasFields = true;
						return;
					}
				}
			});
		} else if (!parent && isObject(value)) {
			// @ts-expect-error todo
			if (value.$fields) {
				hasFields = true;
				return;
			}
		} else if (isObject(value)) {
			// @ts-expect-error todo
			if (value.$fields) {
				hasFields = true;
				return;
			}
		}
	});

	return hasFields;
};
