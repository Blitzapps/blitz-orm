import type { Pipeline } from '../../types/pipeline/base'
import type { BaseResponse, EnrichedBormSchema, PipelineOperation } from '../../types'
import { enrichBQLQuery } from '../../pipeline/preprocess/query/enrichBQLQuery';
import { postHooks } from '../../pipeline/postprocess/query/postHooks';
import { cleanQueryRes } from '../../pipeline/postprocess/query/cleanQueryRes';

type SurrealDbResponse = {

} & BaseResponse;

const getSubtype = (schema: EnrichedBormSchema, kind: "entities" | "relations", thing: string, result: Array<string> = []): Array<string> => {
  const subtypes = Object.values(schema[kind])
    .filter((itemSchema) => itemSchema.extends === thing)
    .map((itemSchema) => itemSchema.name)

  if (subtypes.length === 0) return result

  for (const subtype of subtypes) {
    result.push(subtype)
    getSubtype(schema, kind, subtype, result)
  }

  return result
}

const buildSurrealDbQuery: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  const { dbHandles, enrichedBqlQuery, schema } = req;

  console.log('what is schema', schema)

  if (!enrichedBqlQuery) {
    throw new Error('BQL request not parsed');
  }
  if (!dbHandles.surrealDB) {
    throw new Error('missing SurrealDB in dbHandles');
  }

  const connector = req.config.dbConnectors.find((connector) => connector.provider === "surrealDB")

  if (!connector) {
    throw new Error('missing SurrealDB config')
  }

  const mapItem = dbHandles.surrealDB.get(connector.id)

  if (!mapItem) {
    throw new Error(`missing SurrealDB client with id of ${connector.id}`)
  }

  const { client } = mapItem

  // @ts-expect-error enrichedBqlQuery is any
  const allEntities = req.enrichedBqlQuery.map((query) => {
    if (query["$thingType"] !== "entity") {
      throw new Error('unimplemented')
    }

    return [query['$thing'], ...getSubtype(req.schema, query["$thingType"] === "entity" ? "entities" : "relations", query['$thing'])]
  })

  console.log('check entities', allEntities)

  res.bqlRes = []
}

export const SurrealDbPipelines: Record<string, Pipeline<SurrealDbResponse>> = {
  query: [enrichBQLQuery,
    buildSurrealDbQuery,
    postHooks,
    cleanQueryRes
  ],
  mutation: [

  ],
};