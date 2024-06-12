import type { BQLResponseMulti, BormConfig, MutationConfig } from '../../../types';
import { oFilter } from '../../../helpers';

export const cleanMutationRes = (config: BormConfig, bqlRes: BQLResponseMulti) => {
	if (!bqlRes) {
		return;
	}

	const cleanedMetadata = cleanOutput(bqlRes, config.mutation);
	return cleanedMetadata;
};

const cleanOutput = (blocks: BQLResponseMulti, config?: MutationConfig) => {
	const cleaned = blocks.map((block) =>
		oFilter(block, (k: string | symbol, v) => {
			if (typeof k === 'symbol') {
				return false;
			}
			if (config?.noMetadata === true && k.startsWith('$')) {
				return false;
			}
			if (v === undefined) {
				return false;
			}
			return true;
		}),
	);

	return cleaned;
};
