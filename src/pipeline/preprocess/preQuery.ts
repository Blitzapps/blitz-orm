import type { PipelineOperation } from '../pipeline';

// parseBQLQueryObjectives:
// 1) Validate the query (getRawBQLQuery)
// 2) Prepare it in a universally way for any DB (output an enrichedBQLQuery)

export const preQuery: PipelineOperation = async (req) => {
  const { filledBqlRequest } = req;
  // todo skip this step in the DBs where it's not needed

  /* const pruneMonoMutation = (query: FilledBQLMutationBlock | FilledBQLMutationBlock[]): RawBQLMutation => {
    return query;
  };
  const pruneMultiMutation = () => {};

  if (Array.isArray(filledBqlRequest) && filledBqlRequest.length > 1) {
    pruneMultiMutation();
  } else pruneMonoMutation(filledBqlRequest);

  const prunedBQLMutation = {}; */

  req.filledBqlRequest = filledBqlRequest;
};
