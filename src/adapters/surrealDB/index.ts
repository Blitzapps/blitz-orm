import { trainCase } from 'case-anything';
import type { Pipeline } from '../../types/pipeline/base';
import type { EnrichedBormSchema, PipelineOperation } from '../../types';
import { enrichBQLQuery } from '../../pipeline/preprocess/query/enrichBQLQuery';
import { cleanQueryRes } from './pipeline/postprocess/query/cleanQueryRes';
import { pascal, dash, mapEntries } from 'radash';
import { QueryPath } from '../../types/symbols';
import { produce } from 'immer';
import type {
	SurrealDbResponse,
	EnrichedBqlQuery,
	EnrichedBqlQueryEntity,
	EnrichedBqlQueryAttribute,
} from './types/base';

const getSubtype = (
  schema: EnrichedBormSchema,
  kind: 'entities' | 'relations',
  thing: string,
  result: Array<string> = [],
): Array<string> => {
  const subtypes = Object.values(schema[kind])
    .filter((itemSchema) => itemSchema.extends === thing)
    .map((itemSchema) => itemSchema.name);

  if (subtypes.length === 0) {
    return [...result];
  }

  return subtypes.reduce(
    (acc, subtype) => [...acc, subtype, ...getSubtype(schema, kind, subtype, acc)],
    result
  );
};

const convertEntityId = (attr: EnrichedBqlQueryAttribute) => {
	return attr['$path'] === 'id' ? `meta::id(${attr['$path']}) as id` : `${attr['$path']}`;
};

const handleCardinality = (schema: EnrichedBormSchema, query: EnrichedBqlQuery) => (obj: Record<string, unknown>) => {
	const thingType = query.$thingType;

	if (thingType === 'entity') {
		return obj;
	}

	const entitySchema = schema['relations'][query.$thing];

	return produce(obj, (payload) => {
		for (const [key, role] of Object.entries(entitySchema.roles)) {
			const value = payload[key];

			if (role.cardinality === 'ONE' && Array.isArray(value)) {
				payload[key] = value[0];
			}
		}
	});
};

const buildQuery = (thing: string, query: EnrichedBqlQuery) => {
	const attributes = query['$fields'].filter((q): q is EnrichedBqlQueryAttribute => q['$thingType'] === 'attribute');
	const entities = query['$fields'].filter((q): q is EnrichedBqlQueryEntity => q['$thingType'] === 'entity');
	const relations = query['$fields'].filter((q): q is EnrichedBqlQueryEntity => q['$thingType'] === 'relation');

	const relationsQuery = relations.map((relation) => {
		return `(SELECT VALUE meta::id(id) as id FROM <-${relation.$thing}_${relation.$plays}<-${relation.$thing}) as \`${relation.$as}\``;
	});

	const entitiesQuery = entities.map((entity) => {
		const role = pascal(entity['$playedBy'].relation);

		return query.$thingType === 'relation'
			? `(SELECT VALUE meta::id(id) as id FROM ->${role}_${entity['$playedBy']['plays']}.out) as ${entity['$as']}`
			: `(SELECT VALUE meta::id(id) as id FROM <-${role}_${entity['$playedBy']['path']}<-${role}->${role}_${entity['$playedBy']['plays']}.out) as ${entity['$as']}`;
	});

	const filterExpr = query['$filter']
		? `WHERE ${Object.entries(query['$filter'])
				.map(([key, value]) => `${key} = ${query['$thing']}:\`${value}\``)
				.join(',')}`
		: '';

	const result = `SELECT 
    ${[...attributes.map(convertEntityId), ...entitiesQuery, ...relationsQuery].join(',')}
  FROM ${thing} 
  ${filterExpr}
  FETCH ${entities.map((entity) => entity['$path']).join(',')} 
  PARALLEL`;

	return result;
};

const buildSurrealDbQuery: PipelineOperation<SurrealDbResponse> = async (req, res) => {
	const { dbHandles, enrichedBqlQuery, schema } = req;

	if (!enrichedBqlQuery) {
		throw new Error('BQL request not parsed');
	}
	if (!dbHandles.surrealDB) {
		throw new Error('missing SurrealDB in dbHandles');
	}

	const connector = req.config.dbConnectors.find((connector) => connector.provider === 'surrealDB');

	if (!connector) {
		throw new Error('missing SurrealDB config');
	}

	const mapItem = dbHandles.surrealDB.get(connector.id);

	if (!mapItem) {
		throw new Error(`missing SurrealDB client with id of ${connector.id}`);
	}

	const { client } = mapItem;

	const results = await Promise.all(
		(req.enrichedBqlQuery as Array<EnrichedBqlQuery>).map(async (query, idx) => {
			let queryResult: Array<Record<string, unknown>> | undefined;

			if (query['$thingType'] !== 'entity') {
				// NOTE relations from testSchema contains hyphen at the moment. Remove case transformation, once we use camelcase for all tables
				const thing = pascal(query.$thing);

				const generatedQuery = buildQuery(thing, query);

				const queryRes: Array<
					Record<string, unknown> & {
						id: string;
					}
				> = await client.query(generatedQuery);

				queryResult = queryRes.map((item) => ({
					$id: item.id,
					$thing: trainCase(thing),
					$thingType: 'relation',
					...item,
					id: item.id,
					[QueryPath]: enrichedBqlQuery[0][QueryPath],
				}));
			} else {
				const subtypes = [
					query['$thing'],
					...getSubtype(req.schema, query['$thingType'] === 'entity' ? 'entities' : 'relations', query['$thing']),
				];

				const payload = await Promise.all(
					subtypes.map(async (subtype) => {
						const queryRes: Array<
							Record<string, unknown> & {
								id: string;
							}
						> = await client.query(buildQuery(subtype, query));

						return queryRes.map((item) => ({
							$id: dash(item.id),
							$thing: subtype,
							$thingType: 'entity',
							...item,
							id: dash(item.id),
							[QueryPath]: enrichedBqlQuery[0][QueryPath],
						}));
					}),
				);

				queryResult = payload.flat();
			}

			if (!queryResult) {
				throw new Error('empty query result');
			}

			return queryResult.map(handleCardinality(schema, query));
		}),
	);

	if (req.enrichedBqlQuery.length > 1) {
		throw new Error('batch query unimplemented');
	}

	res.bqlRes = req.enrichedBqlQuery[0]?.$filter?.id ? results[0][0] : results[0];
};

export const SurrealDbPipelines: Record<string, Pipeline<SurrealDbResponse>> = {
	query: [enrichBQLQuery, buildSurrealDbQuery, cleanQueryRes],
	mutation: [],
};
