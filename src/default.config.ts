import type { BormConfig } from './types';

export const defaultConfig: Partial<BormConfig> = {
	query: {
		noMetadata: false,
		simplifiedLinks: true,
		debugger: false,
	},

	mutation: {},
};
