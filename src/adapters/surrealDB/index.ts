import type { Pipeline } from '../../types/pipeline/base'
import type { BaseResponse, PipelineOperation } from '../../types'
import { enrichBQLQuery } from '../../pipeline/preprocess/query/enrichBQLQuery';
import { postHooks } from '../../pipeline/postprocess/query/postHooks';
import { cleanQueryRes } from '../../pipeline/postprocess/query/cleanQueryRes';

type SurrealDbResponse = {

} & BaseResponse;

const buildSurrealDbQuery: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  const { dbHandles, enrichedBqlQuery } = req;
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not parsed');
	}
  if(!dbHandles.surrealDB){
    throw new Error('missing SurrealDB in dbHandles');
  }

  const connector = req.config.dbConnectors.find((connector) => connector.provider === "surrealDB")

  if(!connector){
    throw new Error('missing SurrealDB config')
  }

  const mapItem = dbHandles.surrealDB.get(connector.id)

  if(!mapItem){
    throw new Error(`missing SurrealDB client with id of ${connector.id}`)
  }

  const { client } = mapItem


  for(const query of req.enrichedBqlQuery) {
    console.log('check query', query)
  }
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