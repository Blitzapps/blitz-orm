/* eslint-disable no-param-reassign */
import { traverse } from 'object-traversal';
import { isObject } from 'radash';
import type { BormConfig, EnrichedBQLMutationBlock } from '../../../../types';

export const preQueryPathSeparator = '___';

export const preQueryGuard = (blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[], config: BormConfig) => {
	if (!blocks) {
		throw new Error('[BQLE-M-PQ-1] No blocks found');
	}

	if (config.mutation?.preQuery === false) {
		return false;
	}

	const ops: string[] = [];

	traverse(blocks, ({ parent, key, value }) => {
		if (parent && key && !key.includes('$') && isObject(parent)) {
			const values = Array.isArray(parent[key]) ? parent[key] : [parent[key]];
			// @ts-expect-error todo
			values.forEach((val) => {
				if (isObject(val)) {
					if (parent.$op !== 'create') {
						// @ts-expect-error todo
						if (!ops.includes(val.$op)) {
							// @ts-expect-error todo
							ops.push(val.$op);
						}
					} else {
						// @ts-expect-error todo
						if (val.$op === 'delete' || val.$op === 'unlink') {
							// @ts-expect-error todo
							throw new Error(`Cannot ${val.$op} under a create`);
						}
					}
				}
			});
		} else if (!parent && isObject(value)) {
			// @ts-expect-error todo
			if (!ops.includes(value.$op)) {
				// @ts-expect-error todo
				ops.push(value.$op);
			}
		}
	});

	if (
		!ops.includes('delete') &&
		!ops.includes('unlink') &&
		!ops.includes('replace') &&
		!ops.includes('update') &&
		!ops.includes('link')
	) {
		return false;
	}
	return true;
};
