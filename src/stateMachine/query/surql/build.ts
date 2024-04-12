import { trainCase } from 'case-anything';
import { pascal, dash } from 'radash';
import type { Surreal } from 'surrealdb.node';
import type { BormConfig, DBHandles, EnrichedAttributeQuery, EnrichedBQLQuery, EnrichedBormEntity, EnrichedBormRelation, EnrichedBormSchema, EnrichedEntityQuery, EnrichedFieldQuery, EnrichedLinkField, EnrichedLinkQuery, EnrichedRoleField, EnrichedRoleQuery, Filter, PositiveFilter } from '../../../types';
import { QueryPath } from '../../../types/symbols';
import type {
	EnrichedBqlQueryEntity,
	EnrichedBqlQueryAttribute,
} from './types';
import { getThing, indent } from '../../../helpers';

// const getSubtype = (
// 	schema: EnrichedBormSchema,
// 	kind: 'entities' | 'relations',
// 	thing: string,
// 	result: Array<string> = [],
// ): Array<string> => {
// 	const subtypes = Object.values(schema[kind])
// 		.filter((itemSchema) => itemSchema.extends === thing)
// 		.map((itemSchema) => itemSchema.name);

// 	if (subtypes.length === 0) {
// 		return [...result];
// 	}

// 	return subtypes.reduce((acc, subtype) => [...acc, subtype, ...getSubtype(schema, kind, subtype, acc)], result);
// };

// const convertEntityId = (attr: EnrichedAttributeQuery) => {
// 	return attr.$dbPath === 'id' ? `meta::id(${attr.$path}) as id` : `${attr.$path}`;
// };

// const handleCardinality = (schema: EnrichedBormSchema, query: EnrichedBQLQuery) => (obj: Record<string, unknown>) => {
// 	const thingType = query.$thingType;

// 	if (thingType === 'entity') {
// 		return obj;
// 	}

// 	const entitySchema = schema.relations[query.$thing];

// 	return Object.entries(entitySchema.roles).reduce((acc, [key, role]) => {
// 		const value = acc[key];

// 		if (role.cardinality === 'ONE' && Array.isArray(value)) {
// 			return { ...acc, [key]: value[0] };
// 		}

// 		return acc;
// 	}, obj);
// };

// const buildQuery = (thing: string, query: EnrichedBQLQuery) => {
// 	const attributes = query.$fields.filter((q): q is EnrichedAttributeQuery => q.$thingType === 'attribute');
// 	const entities = query.$fields.filter((q): q is EnrichedEntityQuery => q.$thingType === 'entity');
// 	const relations = query.$fields.filter((q): q is EnrichedBqlQueryEntity => q.$thingType === 'relation');

//   const attributeQuery = attributes.map(convertEntityId);

// 	const relationsQuery = relations.map((relation) => {
// 		return `(SELECT VALUE meta::id(id) as id FROM <-${relation.$thing}_${relation.$plays}<-${relation.$thing}) as \`${relation.$as}\``;
// 	});

// 	const entitiesQuery = entities.map((entity) => {
// 		const role = pascal(entity.$playedBy.relation);

// 		return query.$thingType === 'relation'
// 			? `(SELECT VALUE meta::id(id) as id FROM ->${role}_${entity.$playedBy.plays}.out) as ${entity.$as}`
// 			: `(SELECT VALUE meta::id(id) as id FROM <-${role}_${entity.$playedBy.path}<-${role}->${role}_${entity.$playedBy.plays}.out) as ${entity.$as}`;
// 	});

// 	const filterExpr = query['$filter']
// 		? `WHERE ${Object.entries(query.$filter)
// 				.map(([key, value]) => `${key} = ${query.$thing}:\`${value}\``)
// 				.join(',')}`
// 		: '';

// 	const result = `SELECT 
//     ${[...attributeQuery, ...entitiesQuery, ...relationsQuery].join(', ')}
//   FROM ${thing} 
//   ${filterExpr}
//   FETCH ${entities.map((entity) => entity['$path']).join(',')} 
//   PARALLEL`;

// 	return result;
// };

// // TODO: Break it into multiple steps
// export const buildSurrealDbQuery = async (props: {
//   dbHandles: any;
//   queries: EnrichedBQLQuery[];
//   schema: EnrichedBormSchema;
//   config: BormConfig;
// }) => {
// 	const { dbHandles, queries, schema, config } = props;

// 	if (!queries) {
// 		throw new Error('BQL request not parsed');
// 	}
// 	if (!dbHandles.surrealDB) {
// 		throw new Error('missing SurrealDB in dbHandles');
// 	}

// 	const connector = config.dbConnectors.find((connector) => connector.provider === 'surrealDB');

// 	if (!connector) {
// 		throw new Error('missing SurrealDB config');
// 	}

// 	const mapItem = dbHandles.surrealDB.get(connector.id);

// 	if (!mapItem) {
// 		throw new Error(`missing SurrealDB client with id of ${connector.id}`);
// 	}

// 	const { client } = mapItem;

// 	const results = await Promise.all(
// 		queries.map(async (query) => {
// 			let queryResult: Record<string, unknown>[] | undefined;

// 			if (query['$thingType'] === 'relation') {
// 				// NOTE relations from testSchema contains hyphen at the moment. Remove case transformation, once we use camelcase for all tables
// 				const thing = pascal(query.$thing);

// 				const generatedQuery = buildQuery(thing, query);

// 				const queryRes: (Record<string, unknown> & { id: string })[] = await client.query(generatedQuery);

// 				queryResult = queryRes.map((item) => ({
// 					$id: item.id,
// 					$thing: trainCase(thing),
// 					$thingType: 'relation',
// 					...item,
// 					id: item.id,
// 					[QueryPath]: queries[0][QueryPath],
// 				}));
// 			} else {
// 				// retrieve all subtype entities, and we query them one by one. At the end we flatten the result.
// 				const subtypes = [query.$thing, ...getSubtype(schema, 'entities', query.$thing)];

// 				const payload = await Promise.all(
// 					subtypes.map(async (subtype) => {
// 						const queryRes: Array<
// 							Record<string, unknown> & {
// 								id: string;
// 							}
// 						> = await client.query(buildQuery(subtype, query));

// 						return queryRes.map((item) => ({
// 							$id: dash(item.id),
// 							$thing: subtype,
// 							$thingType: 'entity',
// 							...item,
// 							id: dash(item.id),
// 							[QueryPath]: queries[0][QueryPath],
// 						}));
// 					}),
// 				);

// 				queryResult = payload.flat();
// 			}

// 			if (!queryResult) {
// 				throw new Error('empty query result');
// 			}

// 			return queryResult.map(handleCardinality(schema, query));
// 		}),
// 	);

// 	if (queries.length > 1) {
// 		throw new Error('batch query unimplemented');
// 	}

// 	return (queries[0]?.$filter as PositiveFilter)?.$id ? results[0][0] : results[0];
// };

export const run = async (props: {
  client: Surreal;
  query: string;
}) => {
  const { client, query } = props;
  return client.query(query);
};

export const build = (props: {
  query: EnrichedBQLQuery;
  schema: EnrichedBormSchema;
}): string | null => {
  const { query, schema } = props;

  if (query.$fields.length === 0) {
    return null;
  }

  const thingSchema = getThing(schema, query.$thing);

  const lines: string[] = [];

  lines.push('SELECT');

  query.$fields.forEach((i) => {
    const fieldLines = buildFieldQuery({ query: i, level: 1, schema, thingSchema }) || [];
    lines.push(...fieldLines);
  });

  const filter = query.$filter && buildFilter(query.$filter, 0) || [];
  lines.push(...filter);

  lines.push(`FROM ${query.$thing}`);

  return lines.join('\n');
};

const buildFieldQuery = (props: {
  query: EnrichedFieldQuery;
  schema: EnrichedBormSchema;
  thingSchema: EnrichedBormEntity | EnrichedBormRelation;
  level: number;
}) => {
  const { query, schema, thingSchema, level } = props;

  if (query.$fieldType === 'data') {
    return buildAttributeQuery({ query, level });
  }
  if (query.$fieldType === 'link') {
    return buildLinkQuery({ query, level, schema });
  }
  if (query.$fieldType === 'role') {
    return buildRoleQuery({ query, level, schema });
  }
};

// $thingType: 'attribute';
// $path: string;
// $dbPath: string;
// $as: string;
// $var: string;
// $fieldType: 'data';
// $justId: boolean;
// $id: string,
// $isVirtual?: boolean;
const buildAttributeQuery = (props: {
  query: EnrichedAttributeQuery;
  level: number;
}): string[] => {
  const { query, level } = props;
  if (query.$isVirtual) {
    return [];
  }
  const line = indent(query.$dbPath, level);
  return [line];
};

// $thingType: 'entity' | 'relation';
// $thing: string;
// $plays: string;
// $playedBy: PlayedBy;
// $path: string;
// $dbPath: string;
// $as: string;
// $var: string;
// $fields: EnrichedFieldQuery[];
// $fieldType: 'link';
// $target: 'relation' | 'role';
// $intermediary?: string;
// $justId: boolean;
// $id: string,
// $filter?: Filter;
// $idNotIncluded: boolean;
// $filterByUnique: boolean;
// $filterProcessed: boolean;
// $sort?: Sorter[];
// $offset?: number;
// $limit?: number;
// [QueryPath]: string;
const buildLinkQuery = (props: {
  query: EnrichedLinkQuery;
  schema: EnrichedBormSchema;
  level: number;
}): string[] => {
  const { query, schema, level } = props;

  if (query.$fields.length === 0) {
    return [];
  }

  const lines: string[] = [];

  lines.push(indent('(', level));

  const queryLevel = level + 1;
  lines.push(indent('SELECT', queryLevel));

  const thingSchema = getThing(schema, query.$playedBy.thing);
  const fieldLevel = queryLevel + 1;
  query.$fields.forEach((i) => {
    const fieldLines = buildFieldQuery({ query: i, level: fieldLevel, schema, thingSchema }) || [];
    lines.push(...fieldLines);
  });

  const things = [query.$playedBy.thing, ...getSubtypeRecursive(schema, query.$playedBy.thingType, query.$playedBy.thing)];
  let from: string;
  if (query.$target === 'relation') {
    // [Space]<-SpaceObj_spaces<-SpaceObj
    // NOTE:
    // Convention: The thing that owns the role has "out"-ward arrow
    // and the thing that has the linkField has "in"-ward arrow.
    from = things.map((thing) => `<-\`${query.$playedBy.relation}_${query.$plays}\`<-\`${thing}\``).join(', ');
  } else {
    // [Space]<-Space-User_spaces<-Space-User->Space-User_users->User
    from = things.map((thing) => `<-\`${query.$playedBy.relation}_${query.$plays}\`<-\`${query.$playedBy.relation}\`->\`${query.$playedBy.relation}_${query.$playedBy.plays}\`->\`${query.$playedBy.thing}\``).join(', ');
  }
  lines.push(indent(`FROM ${from}`, queryLevel));

  lines.push(indent(')', level));

  return lines;
};

// $thingType: 'relation';
// $thing: string,
// $path: string,
// $dbPath: string,
// $as: string,
// $var: string,
// $fields: EnrichedFieldQuery[],
// $fieldType: 'role',
// $intermediary: string,
// $justId: string,
// $id: string,
// $filter?: Filter,
// $idNotIncluded: boolean,
// $filterByUnique: boolean,
// $playedBy: PlayedBy,
// $filterProcessed: boolean,
// $sort?: Sorter[];
// $offset?: number,
// $limit?: number,
// [QueryPath]: string;
const buildRoleQuery = (props: {
  query: EnrichedRoleQuery;
  schema: EnrichedBormSchema;
  level: number;
}): string[] => {
  const { query, schema, level } = props;

  if (query.$fields.length === 0) {
    return [];
  }

  const lines: string[] = [];

  lines.push(indent('(', level));

  const queryLevel = level + 1;
  lines.push(indent('SELECT', queryLevel));

  const thingSchema = getThing(schema, query.$playedBy.relation);
  const fieldLevel = queryLevel + 1;
  query.$fields.forEach((i) => {
    const fieldLines = buildFieldQuery({ query: i, level: fieldLevel, schema, thingSchema }) || [];
    lines.push(...fieldLines);
  });

  const things = [query.$playedBy.thing, ...getSubtypeRecursive(schema, query.$thingType, query.$thing)];
  const from = things.map((thing) => `->\`${query.$playedBy.relation}_${query.$playedBy.plays}\`->\`${thing}\``).join(', ');
  lines.push(indent(`FROM ${from}`, queryLevel));

  if (query.$filter) {
    lines.push(...buildFilter(query.$filter, queryLevel));
  }

  lines.push(indent(')', level));

  return lines;
};

const buildFilter = (filter: Filter, level: number): string[] => {
  const conditions: string[] = [];
  const { $not, ...f } = filter;
  const conditionLevel = level + 1;
  Object.entries(f).forEach(([key, value]) => {
    conditions.push(indent(`${key}=${JSON.stringify(value)}`, conditionLevel));
  });
  if ($not) {
    Object.entries($not as PositiveFilter).forEach(([key, value]) => {
      conditions.push(`${key}!=${JSON.stringify(value)}`);
    });
  }
  const [firstCondition, ...restConditions] = conditions;
  if (firstCondition) {
    return [
      indent('WHERE (', level),
      indent(firstCondition, conditionLevel),
      ...restConditions.map((i) => indent(`AND ${i}`, conditionLevel)),
      indent(')', level),
    ];
  }
  return conditions;
};

const getSubtypeRecursive = (
	schema: EnrichedBormSchema,
	thingType: 'entity' | 'relation',
	thing: string,
): string[] => {
  const subTypes = getSubtype2(schema, thingType, thing);
  let i = 0;
  while (subTypes[i]) {
    subTypes.push(...getSubtype2(schema, thingType, subTypes[i]));
    i++;
  }
  return subTypes;
}

const getSubtype2 = (
	schema: EnrichedBormSchema,
	thingType: 'entity' | 'relation',
	thing: string,
): string[] => {
	const subtypes = Object.values(thingType === 'entity' ? schema.entities : schema.relations)
		.filter((itemSchema) => itemSchema.extends === thing)
		.map((itemSchema) => itemSchema.name as string);
    return subtypes;
};