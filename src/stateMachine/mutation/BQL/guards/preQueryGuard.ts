import type { EnrichedBQLMutationBlock } from '../../../../types';

const REQUIRES_PREQUERY = new Set(['update', 'link', 'unlink', 'replace', 'delete']);

export const preQueryGuard = (mut: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]) => {
	if (Array.isArray(mut)) {
		for (const m of mut) {
			if (preQueryGuard(m)) {
				return true;
			}
		}
		return false;
	}

	if (REQUIRES_PREQUERY.has(mut.$op)) {
		return true;
	}

	for (const key in mut) {
		if (key.startsWith('$')) {
			continue;
		}
		const value = mut[key];
		if (value && typeof value === 'object' && preQueryGuard(mut[key])) {
			return true;
		}
	}

	return false;
};
