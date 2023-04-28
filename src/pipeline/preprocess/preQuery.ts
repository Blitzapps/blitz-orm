import { RawBQLMutation } from '../../types';
import type { PipelineOperation } from '../pipeline';

// parseBQLQueryObjectives:
// 1) Validate the query (getRawBQLQuery)
// 2) Prepare it in a universally way for any DB (output an enrichedBQLQuery)

export const preQuery: PipelineOperation = async (req) => {
  const { rawBqlRequest } = req;

  const pruneMonoMutation = (query: RawBQLMutation): RawBQLMutation => {
    return query;
  };
  const pruneMultiMutation = () => {};

  if (Array.isArray(rawBqlRequest) && rawBqlRequest.length > 1) {
    pruneMultiMutation();
  } else pruneMonoMutation(rawBqlRequest);

  const prunedBQLMutation = {};

  // @ts-expect-error
  req.rawBqlRequest = prunedBQLMutation;
};
