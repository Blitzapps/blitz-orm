import { isSet } from 'util/types';
import { StepPrint } from '../../../../types/symbols';

export const doAction = (stepName: string, block: Record<string | symbol | number, any>) => {
	const current = block[StepPrint];
	if (!isSet(current)) {
		Reflect.set(block, StepPrint, new Set(['clean']));
		return true;
	} else if (!current.has('clean')) {
		return false;
	} else {
		Reflect.set(block, StepPrint, current.add('clean'));
		return true;
	}
};
