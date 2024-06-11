import { transition, reduce } from '../robot3';

export const errorTransition = transition(
	'error',
	'error',
	reduce((ctx: any, event: any) => {
		return {
			...ctx,
			error: event.error,
		};
	}),
);
