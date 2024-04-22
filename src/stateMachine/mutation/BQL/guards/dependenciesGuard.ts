import type { EnrichedBQLMutationBlock } from '../../../../types';

export const dependenciesGuard = (mut: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]) => {
	if (Array.isArray(mut)) {
		for (const o of mut) {
			if (dependenciesGuard(o)) {
				return true;
			}
		}
		return false;
	}

	if (mut.$fields) {
		return true;
	}

	for (const key in mut) {
		if (key.startsWith('$')) {
			continue;
		}
		const value = mut[key];
		if (value && typeof value === 'object' && dependenciesGuard(mut[key])) {
			return true;
		}
	}

	return false;
}
