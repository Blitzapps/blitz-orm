import { isObject, isArray } from 'radash';
import type { BQLResponse, BormConfig, QueryConfig } from '../../../types';
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';

export const cleanMutationRes = (config: BormConfig, bqlRes: BQLResponse) => {
	if (!bqlRes) {
		return;
	}
	const cleanedMetadata = cleanOutput(bqlRes, config.query);
	return cleanedMetadata;
};

const cleanOutput = (blocks: any, config?: QueryConfig) => {
	return produce(blocks, (draft: any) =>
		traverse(draft, ({ value: val }: TraversalCallbackContext) => {
			if (isObject(val)) {
				const value = val as any;

				// UNDEFINED FIELDS
				Object.keys(value).forEach((k: string) => {
					if (value[k] === undefined || (isArray(value[k]) && value[k].length === 0)) {
						delete value[k];
					}
					if (value[k] === undefined) {
						delete value[k];
					}
				});

				// INTERNAL SYMBOLS
				Object.getOwnPropertySymbols(value).forEach((symbol) => {
					delete value[symbol];
				});

				/// USER FACING METADATA
				if (config?.noMetadata === true) {
					// eslint-disable-next-line no-param-reassign
					Object.keys(value).forEach((k: string) => {
						if (k.startsWith('$')) {
							delete value[k];
						}
					});
				}
			}
		}),
	);
};
