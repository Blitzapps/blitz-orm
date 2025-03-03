import type {
  ParsedBQLMutation as BQLMutation,
  EnrichedBQLQuery as BQLQuery,
  BQLResponse,
  BormConfig,
  DBHandles,
  EnrichedBormSchema,
  FilledBQLMutationBlock,
  RawBQLQuery as RawBQLRequest,
  TQLRequest,
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
  res: Res;
  pipeline: Pipeline<Res>;
};

export type PipelineOperation<Res extends BaseResponse> = (
  req: Request,
  res: Res,
) => Promise<undefined | NextPipeline<Res>[]>;

export type Pipeline<Res extends BaseResponse> = PipelineOperation<Res>[];
