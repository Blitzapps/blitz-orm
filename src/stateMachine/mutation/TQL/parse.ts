/* eslint-disable no-param-reassign */
import type { BQLMutationBlock, BormConfig } from '../../../types';
import { mapEntries } from 'radash';

export type TqlRes = any;

export const parseTQLMutation = async (tqlRes: TqlRes, reqThings: any[], reqEdges: any[], config: BormConfig) => {
	// todo: check if something weird happened
	const expected = [...reqThings, ...reqEdges];

	const result = expected
		.map((exp) => {
			//! reads all the insertions and gets the first match. This means each id must be unique
			// @ts-expect-error - TODO description
			const currentNode = tqlRes.insertions?.find((y) => y.get(`${exp.$bzId}`))?.get(`${exp.$bzId}`);

			// console.log('current:', JSON.stringify(x));

			if (exp.$op === 'create' || exp.$op === 'update' || exp.$op === 'link') {
				const dbIdd = currentNode?.asThing().iid;
				if (config.mutation?.noMetadata) {
					return mapEntries(exp, (k: string, v) => [
						k.toString().startsWith('$') ? Symbol.for(k) : k,
						v,
					]) as BQLMutationBlock;
				}
				return { $dbId: dbIdd, ...exp, ...{ [exp.path]: exp.$id } } as BQLMutationBlock;
			}
			if (exp.$op === 'delete' || exp.$op === 'unlink') {
				// todo when typeDB confirms deletions, check them here
				return exp as BQLMutationBlock;
			}
			if (exp.$op === 'match') {
				return undefined;
			}
			throw new Error(`Unsupported op ${exp.$op}`);

			// console.log('config', config);
		})
		.filter((z) => z);

	//console.log('ParseTQLResultNew', result);
	return result;
};
