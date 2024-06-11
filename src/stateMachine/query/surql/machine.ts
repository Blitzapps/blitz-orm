import type { Surreal } from 'surrealdb.js';
import type { BormConfig, EnrichedBQLQuery, EnrichedBormSchema } from '../../../types';
import { createMachine, invoke, reduce, state, transition } from '../../robot3';
import { build } from './build';
import { run } from './run';
import { assertDefined } from '../../../helpers';
import { parse } from './parse';
import { errorTransition } from '../../common/errorTransition';
import { awaitMachine } from '../../common/awaitMachine';
import type { QueryMachineContext } from '../../types';

export type SurrealDbQueryMachineContext = Omit<QueryMachineContext, 'handles'> & {
	surql: {
		queries?: string[];
		res?: any[];
	};
	handler: { client: Surreal };
};

const surrealDbQueryMachine = createMachine(
	'build',
	{
		build: invoke(
			async (ctx: SurrealDbQueryMachineContext) => build({ queries: ctx.bql.queries, schema: ctx.schema }),
			transition(
				'done',
				'run',
				reduce(
					(ctx: SurrealDbQueryMachineContext, event: any): SurrealDbQueryMachineContext => ({
						...ctx,
						surql: {
							...ctx.surql,
							queries: event.data,
						},
					}),
				),
			),
			errorTransition,
		),
		run: invoke(
			async (ctx: SurrealDbQueryMachineContext) => {
				return run({ client: ctx.handler.client, queries: assertDefined(ctx.surql.queries) });
			},
			transition(
				'done',
				'parse',
				reduce(
					(ctx: SurrealDbQueryMachineContext, event: any): SurrealDbQueryMachineContext => ({
						...ctx,
						surql: {
							...ctx.surql,
							res: event.data,
						},
					}),
				),
			),
			errorTransition,
		),
		parse: invoke(
			async (ctx: SurrealDbQueryMachineContext) => {
				return parse({
					res: assertDefined(ctx.surql.res),
					queries: ctx.bql.queries,
					schema: ctx.schema,
					config: ctx.config,
				});
			},
			transition(
				'done',
				'success',
				reduce(
					(ctx: SurrealDbQueryMachineContext, event: any): SurrealDbQueryMachineContext => ({
						...ctx,
						bql: {
							...ctx.bql,
							res: event.data,
						},
					}),
				),
			),
			errorTransition,
		),
		success: state(),
		error: state(),
	},
	// @ts-expect-error Bad type
	(ctx: SurrealDbQueryMachineContext) => ctx,
);

export const runSurrealDbQueryMachine = async (
	enrichedBql: EnrichedBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handler: { client: Surreal },
) => {
	return awaitMachine<SurrealDbQueryMachineContext>(surrealDbQueryMachine, {
		bql: {
			raw: [],
			queries: enrichedBql,
		},
		surql: {},
		schema: schema,
		config: config,
		handler,
		error: null,
	});
};
