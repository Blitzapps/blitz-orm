import type {
	BQLMutationBlock,
	EnrichedBQLMutationBlock,
	EnrichedBormSchema,
	BormConfig,
	DBHandles,
	EnrichedBQLQuery,
	RawBQLQuery,
	BQLResponse,
	BQLResponseMulti,
} from '../types';

export type MutationMachineContext = {
	bql: {
		raw: BQLMutationBlock | BQLMutationBlock[];
		current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
		things: EnrichedBQLMutationBlock[];
		edges: (EnrichedBQLMutationBlock & { thingType: 'relation' })[];
		res: BQLResponseMulti;
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	depthLevel: number;
	error: string | null;
};

export type QueryMachineContext = {
	bql: {
		raw: RawBQLQuery[];
		queries: EnrichedBQLQuery[];
		res?: BQLResponse;
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error: string | null;
};
