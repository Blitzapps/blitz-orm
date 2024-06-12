import type { BQLResponse } from '../../types';
import { interpret } from '../robot3';

export const awaitMachine = async <T>(machine: any, context: T) => {
	return new Promise<BQLResponse>((resolve, reject) => {
		// @ts-expect-error Bad type
		interpret(
			machine,
			// @ts-expect-error Bad type
			(service) => {
				if (service.machine.state.name === 'success') {
					resolve(service.context.bql.res);
				}
				if (service.machine.state.name === 'error') {
					reject(service.context.error);
				}
			},
			context,
		);
	});
};
