import type { Pipeline } from '../../types/pipeline/base'
import type { BaseResponse, EnrichedBormSchema, PipelineOperation } from '../../types'
import { enrichBQLQuery } from '../../pipeline/preprocess/query/enrichBQLQuery';
import { postHooks } from '../../pipeline/postprocess/query/postHooks';
import { cleanQueryRes } from './pipeline/postprocess/query/cleanQueryRes';
import { pascal, snake, dash } from 'radash'
import { QueryPath } from '../../types/symbols';
import type { SurrealDbResponse } from './types/base'

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

type EnrichedBqlQueryEntity = {
  '$thingType': 'entity',
  '$plays': string,
  '$playedBy': {
    path: string,
    cardinality: string,
    relation: string,
    plays: string,
    target: string,
    thing: string,
    thingType: string,
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
}

type EnrichedBqlQueryAttribute = {
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
}

type EnrichedBqlQuery = {
  '$path': string,
  '$thing': string,
  '$thingType': string
  '$filter'?: { id: string },
  '$fields': Array<EnrichedBqlQueryAttribute | EnrichedBqlQueryEntity>
}

const convertEntityId = (attr: EnrichedBqlQueryAttribute) => {
  return attr['$path'] === 'id' ? `meta::id(${attr['$path']}) as id` : `${attr['$path']}`
}

// any now, wait for type from enrichedBqlQuery
const buildQuery = (thing: string, query: EnrichedBqlQuery, generated = "") => {
  const attributes = query["$fields"].filter((q): q is EnrichedBqlQueryAttribute => q["$thingType"] === "attribute")
  const entities = query["$fields"].filter((q): q is EnrichedBqlQueryEntity => q["$thingType"] === "entity")

  const entitiesQuery = entities.map((entity) => {
    const role = pascal(entity["$playedBy"].relation)

    return `(SELECT VALUE meta::id(id) as id FROM <-${role}_${entity['$playedBy']['path']}<-${role}->${role}_${entity['$playedBy']['plays']}.out) as ${entity['$as']}`
  })

  const filterExpr = query['$filter'] ? `WHERE ${Object.entries(query['$filter']).map(([key, value]) => `${key} = ${query['$thing']}:${value}`).join(",")}` : ""

  const x = `SELECT 
    ${[...attributes.map(convertEntityId), ...entitiesQuery].join(",")}
  FROM ${thing} 
  ${filterExpr}
  FETCH ${entities.map((entity) => entity["$path"]).join(",")} 
  PARALLEL`

  return x
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

  const results = await Promise.all((req.enrichedBqlQuery as Array<EnrichedBqlQuery>).map(async (query, idx) => {
    if (query["$thingType"] !== "entity") {
      throw new Error('unimplemented')
    }

    const subtypes = [query['$thing'], ...getSubtype(req.schema, query["$thingType"] === "entity" ? "entities" : "relations", query['$thing'])]

    const payload = await Promise.all(subtypes.map(async (subtype) => {
      const queryRes: Array<Record<string, unknown> & {
        id: string
      }> = await client.query(buildQuery(subtype, query))

      const transformed = queryRes.map((item) => ({
        "$id": dash(item.id),
        "$thing": subtype,
        "$thingType": "entity",
        ...item,
        id: dash(item.id),
        [QueryPath]: enrichedBqlQuery[0][QueryPath]
      }));

      return transformed
    }))

    return payload.flat()
  }))

  if(req.enrichedBqlQuery.length > 1){
    throw new Error('batch query unimplemented')
  }
  
  res.bqlRes = req.enrichedBqlQuery[0]?.$filter?.id ? results[0][0] : results[0]
}

export const SurrealDbPipelines: Record<string, Pipeline<SurrealDbResponse>> = {
  query: [
    enrichBQLQuery,
    buildSurrealDbQuery,
    postHooks,
    cleanQueryRes
  ],
  mutation: [

  ],
};