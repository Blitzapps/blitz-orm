import type {
	BormConfig,
	BQLResponse,
	DBHandles,
	EnrichedBormSchema,
	ParsedBQLMutation as BQLMutation,
	ParsedBQLQuery as BQLQuery,
	RawBQLQuery as RawBQLRequest,
	TQLRequest,
	FilledBQLMutationBlock,
	BQLResponseMulti,
} from '../../types';

export type Request = {
	rawBqlRequest: RawBQLRequest;
	filledBqlRequest?: FilledBQLMutationBlock[] | FilledBQLMutationBlock; // todo: transform into filledBQLRequest with queries as well
	bqlRequest?: { query?: BQLQuery; mutation?: BQLMutation };
	schema: EnrichedBormSchema;
	config: BormConfig;
	tqlRequest?: TQLRequest;
	dbHandles: DBHandles;
	// todo: define type
	enrichedBqlQuery?: any;
};

export type BaseResponse = {
  bqlRes?: BQLResponse | null;
};

type NextPipeline<Res extends BaseResponse> = {
	req: Request;
	res: Res,
	pipeline: Pipeline<Res>
};

export type PipelineOperation<Res extends BaseResponse> = (req: Request, res: Res) => Promise<void | NextPipeline<Res>[]>;

export type Pipeline<Res extends BaseResponse> = PipelineOperation<Res>[];