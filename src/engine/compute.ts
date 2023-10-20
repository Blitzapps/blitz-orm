import type { BQLMutationBlock, EnrichedDataField } from '../types';
import { getParamNames } from './helpers';

export const compute = (currentThing: BQLMutationBlock, fieldSchema?: EnrichedDataField) => {
	if (!fieldSchema || !fieldSchema.default || !fieldSchema.default.value) {
		throw new Error('Virtual field: No field schema found, or wrongly configured');
	}
	const fn = fieldSchema.default.value;

	const args = getParamNames(fn);

	//check if all the args are in the entity, if not, throw a missing error with all the not present ones
	const missingArgs = args.filter((arg) => !(arg in currentThing));
	if (missingArgs.length) {
		throw new Error(`Virtual field: Missing arguments ${missingArgs.join(', ')}`);
	}
	const computedValue = 'default' in fieldSchema ? fieldSchema.default?.value(currentThing) : undefined;
	return computedValue;
};
