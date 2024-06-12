import type { Surreal } from 'surrealdb.js';
import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import { assertDefined, getSchemaByThing } from '../../helpers';
import type { BormConfig, DBHandles, EnrichedBormSchema, EnrichedBQLQuery, RawBQLQuery } from '../../types';
import { createMachine, invoke, reduce, state, transition } from '../robot3';
import { cleanQueryRes } from './bql/clean';
import { enrichBQLQuery } from './bql/enrich';
import { postHooks } from './postHook';
import { runSurrealDbQueryMachine } from './surql/machine';
import { runTypeDbQueryMachine } from './tql/machine';
import { errorTransition } from '../common/errorTransition';
import { awaitMachine } from '../common/awaitMachine';
import type { QueryMachineContext } from '../types';

const updateBqlReq = (ctx: QueryMachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, queries: event.data },
	};
};

const updateBqlRes = (ctx: QueryMachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

type TypeDBAdapter = {
	db: 'typeDB';
	handler: { client: TypeDBDriver; session: TypeDBSession };
	rawBql: RawBQLQuery[];
	bqlQueries: EnrichedBQLQuery[];
	indices: number[];
};

type SurrealDBAdapter = {
	db: 'surrealDB';
	handler: { client: Surreal };
	rawBql: RawBQLQuery[];
	bqlQueries: EnrichedBQLQuery[];
	indices: number[];
};

type Adapter = TypeDBAdapter | SurrealDBAdapter;

export const queryMachine = createMachine(
	'enrich',
	{
		enrich: invoke(
			async (ctx: QueryMachineContext) => enrichBQLQuery(ctx.bql.raw, ctx.schema),
			transition('done', 'adapter', reduce(updateBqlReq)),
			errorTransition,
		),
		adapter: invoke(
			async (ctx: QueryMachineContext) => {
				const adapters: Record<string, Adapter> = {};

				ctx.bql.queries?.forEach((q, i) => {
					const raw = ctx.bql.raw[i];
					const thing = getSchemaByThing(ctx.schema, q.$thing);
					const { id } = thing.defaultDBConnector;
					if (thing.db === 'typeDB') {
						if (!adapters[id]) {
							const handler = ctx.handles.typeDB?.get(id);
							if (!handler) {
								throw new Error(`TypeDB client with id "${thing.defaultDBConnector.id}" does not exist`);
							}
							adapters[id] = {
								db: 'typeDB',
								handler: handler,
								rawBql: [],
								bqlQueries: [],
								indices: [],
							};
						}
					} else if (thing.db === 'surrealDB') {
						if (!adapters[id]) {
							const handler = ctx.handles.surrealDB?.get(id);
							if (!handler) {
								throw new Error(`SurrealDB client with id "${thing.defaultDBConnector.id}" does not exist`);
							}
							adapters[id] = {
								db: 'surrealDB',
								handler: handler,
								rawBql: [],
								bqlQueries: [],
								indices: [],
							};
						}
					} else {
						throw new Error(`Unsupported DB "${thing.db}"`);
					}
					const adapter = adapters[id];
					adapter.rawBql.push(raw);
					adapter.bqlQueries.push(q);
					adapter.indices.push(i);
				});
				const adapterList = Object.values(adapters);
				const proms = adapterList.map((a) => {
					if (a.db === 'typeDB') {
						// TODO: Replace DBHandles with TypeDBAdapter
						return runTypeDbQueryMachine(a.rawBql, a.bqlQueries, ctx.schema, ctx.config, a.handler);
					}
					return runSurrealDbQueryMachine(a.bqlQueries, ctx.schema, ctx.config, a.handler);
				});
				const results = await Promise.all(proms);
				const orderedResults = adapterList.flatMap((a, i) => {
					const result = results[i];
					//@ts-expect-error - todo: simplify and make immutable like mutationMachine
					return a.indices.map((index, j) => ({ index, result: result[j] }));
				});
				orderedResults.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
				const result = orderedResults.map(({ result }) => result);
				return result;
			},
			transition('done', 'postHooks', reduce(updateBqlRes)),
			errorTransition,
		),
		postHooks: invoke(
			async (ctx: QueryMachineContext) =>
				postHooks(ctx.schema, assertDefined(ctx.bql.queries), assertDefined(ctx.bql.res)),
			transition('done', 'clean', reduce(updateBqlRes)),
			errorTransition,
		),
		clean: invoke(
			async (ctx: QueryMachineContext) => cleanQueryRes(ctx.config, assertDefined(ctx.bql.res)),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
		),
		success: state(),
		error: state(),
	},
	// @ts-expect-error Bad type
	(ctx: QueryMachineContext) => ctx,
);

export const runQueryMachine = async (
	bql: RawBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitMachine<QueryMachineContext>(queryMachine, {
		bql: {
			raw: bql,
			queries: [],
		},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};
