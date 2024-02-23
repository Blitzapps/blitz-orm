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

type EnrichedBqlQuery = {
  '$path': string,
  '$thing': string,
  '$thingType': string
  '$fields': Array<{
    '$path': string,
    '$dbPath': string,
    '$thingType': 'attribute'
    '$as': string,
    '$var': string,
    '$fieldType': 'data',
    '$excludedFields': undefined,
    '$justId': boolean,
    '$id': undefined,
    '$filter': undefined,
    '$isVirtual': undefined,
    '$filterProcessed': boolean,
  } | {
    '$thingType': 'entity',
    '$plays': string,
    '$playedBy': {
      path: string,
      cardinality: string,
      relation: string,
      plays: string,
      target: string,
      thing: string,
      thingType:string,
    },
    '$path': string,
    '$dbPath': undefined,
    '$as': string,
    '$var': string,
    '$thing': string,
    '$fields': Array<any>
    '$excludedFields': undefined,
    '$fieldType': string,
    '$target': string,
    '$intermediary': string,
    '$justId': boolean
    '$id': undefined,
    '$filter': {},
    '$idNotIncluded': boolean,
    '$filterByUnique': boolean,
    '$filterProcessed': boolean
  }>
}

// any now, wait for type from enrichedBqlQuery
const buildQuery = (query: EnrichedBqlQuery) => {

  const attributes =  query["$fields"].filter((q) => q["$thingType"] === "attribute")

  // console.log('hi', attributes.map((attr) => `${attr['$path']}` ).join(','))

  const entities = query["$fields"].filter((q) => q["$thingType"] === "entity")

  console.log('bye entities', entities)

  // console.log('hi entities', JSON.stringify(entities, null, 2))

}

const buildSurrealDbQuery: PipelineOperation<SurrealDbResponse> = async (req, res) => {
  const { dbHandles, enrichedBqlQuery, schema } = req;

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

    // console.log('what is schema', schema)

    console.log('byeee query', buildQuery(query))

    return [query['$thing'], ...getSubtype(req.schema, query["$thingType"] === "entity" ? "entities" : "relations", query['$thing'])]
  })

  if(allEntities.length > 1){
    throw new Error('multiple qureies unimplemented')
  }

  const queryRes = await Promise.all(allEntities[0].map(async (entity: string) => {
    return await client.query(`
    SELECT
      *,
      <-SpaceUser_users<-SpaceUser->SpaceUser_spaces.out.id as spaces,
      <-UserAccounts_user<-UserAccounts->UserAccounts_accounts.out as accounts
    FROM ${entity} FETCH Space, Account PARALLEL;
    `)
  }))

  const result = queryRes.flat()

  res.bqlRes = result
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