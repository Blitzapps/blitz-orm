import type { Surreal } from 'surrealdb.js';
import type { TypeDBDriver } from 'typedb-driver';
import { assertDefined, getSchemaByThing } from '../../helpers';
import type { BormConfig, DBHandles, EnrichedBormSchema, EnrichedBQLQuery, RawBQLQuery } from '../../types';
import { createMachine, interpret, invoke, reduce, state, transition } from '../robot3';
import { cleanQueryRes } from './bql/clean';
import { enrichBQLQuery } from './bql/enrich';
import { postHooks } from './postHook';
import { runSurrealDbQueryMachine } from './surql/machine';
import { runTypeDbQueryMachine } from './tql/machine';

type MachineContext = {
	bql: {
		raw: RawBQLQuery[];
		queries?: EnrichedBQLQuery[];
		res?: any[]; // TODO
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error: string | null;
};

const updateBqlReq = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, queries: event.data },
	};
};

const updateBqlRes = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const errorTransition = transition(
	'error',
	'error',
	reduce((ctx: MachineContext, event: any) => {
		return {
			...ctx,
			error: event.error,
		};
	}),
);

type TypeDBAdapter = {
	db: 'typeDB';
	client: TypeDBDriver;
	rawBql: RawBQLQuery[];
	bqlQueries: EnrichedBQLQuery[];
	indices: number[];
};

type SurrealDBAdapter = {
	db: 'surrealDB';
	client: Surreal;
	rawBql: RawBQLQuery[];
	bqlQueries: EnrichedBQLQuery[];
	indices: number[];
};

type Adapter = TypeDBAdapter | SurrealDBAdapter;

export const queryMachine = createMachine(
	'enrich',
	{
		enrich: invoke(
			async (ctx: MachineContext) => enrichBQLQuery(ctx.bql.raw, ctx.schema),
			transition('done', 'adapter', reduce(updateBqlReq)),
			errorTransition,
		),
		adapter: invoke(
			async (ctx: MachineContext) => {
				const adapters: Record<string, Adapter> = {};

				ctx.bql.queries?.forEach((q, i) => {
					const raw = ctx.bql.raw[i];
					const thing = getSchemaByThing(ctx.schema, q.$thing);
					const { id } = thing.defaultDBConnector;

					if (thing.db === 'typeDB') {
						if (!adapters[id]) {
							const client = ctx.handles.typeDB?.get(id)?.client;
							if (!client) {
								throw new Error(`TypeDB client with id "${thing.defaultDBConnector.id}" does not exist`);
							}
							adapters[id] = {
								db: 'typeDB',
								client,
								rawBql: [],
								bqlQueries: [],
								indices: [],
							};
						}
					} else if (thing.db === 'surrealDB') {
						if (!adapters[id]) {
							const client = ctx.handles.surrealDB?.get(id)?.client;
							if (!client) {
								throw new Error(`SurrealDB client with id "${thing.defaultDBConnector.id}" does not exist`);
							}
							adapters[id] = {
								db: 'surrealDB',
								client,
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
						return runTypeDbQueryMachine(a.rawBql, a.bqlQueries, ctx.schema, ctx.config, ctx.handles);
					}

					if (a.db === 'surrealDB') {
						return runSurrealDbQueryMachine(a.bqlQueries, ctx.schema, ctx.config, a.client);
					}

					throw new Error(`Unsupported DB "${a.db}"`);
				});
				const results = await Promise.all(proms);
				const orderedResults = adapterList.flatMap((a, i) => {
					const result = results[i];
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
			async (ctx: MachineContext) => postHooks(ctx.schema, assertDefined(ctx.bql.queries), assertDefined(ctx.bql.res)),
			transition('done', 'clean', reduce(updateBqlRes)),
			errorTransition,
		),
		clean: invoke(
			async (ctx: MachineContext) => cleanQueryRes(ctx.config, assertDefined(ctx.bql.res)),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
		),
		success: state(),
		error: state(),
	},
	(ctx: MachineContext) => ctx,
);

export const awaitQueryMachine = async (context: MachineContext) => {
	return new Promise<MachineContext>((resolve, reject) => {
		interpret(
			queryMachine,
			(service) => {
				if (service.machine.state.name === 'success') {
					resolve(service.context);
				}
				if (service.machine.state.name === 'error') {
					reject(service.context);
				}
			},
			context,
		);
	});
};

export const runQueryMachine = async (
	bql: RawBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitQueryMachine({
		bql: {
			raw: bql,
		},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};
