import type { Pipeline } from '../../types/pipeline/base'
import type { BaseResponse, PipelineOperation } from '../../types'
import { enrichBQLQuery } from '../../pipeline/preprocess/query/enrichBQLQuery';
import { postHooks } from '../../pipeline/postprocess/query/postHooks';
import { cleanQueryRes } from '../../pipeline/postprocess/query/cleanQueryRes';

type SurrealDbResponse = {

} & BaseResponse;

const buildSurrealDbQuery: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  console.log('check req and res', req.enrichedBqlQuery, JSON.stringify(req.enrichedBqlQuery))
}

export const SurrealDbPipelines: Record<string, Pipeline<SurrealDbResponse>> = {
  query: [enrichBQLQuery,
    buildSurrealDbQuery,
    // postHooks,
    // cleanQueryRes
  ],
  mutation: [

  ],
};