import type { Surreal } from 'surrealdb.js';
import type { BormConfig, EnrichedBQLQuery, EnrichedBormSchema } from '../../../types';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../robot3';
import { build } from './build';
import { run } from './run';
import { assertDefined } from '../../../helpers';
import { parse } from './parse';

export type SurrealDbMachineContext = {
	bql: {
		queries: EnrichedBQLQuery[];
		res?: any[];
	};
	surql: {
		queries?: string[];
		res?: any[];
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	client: Surreal;
	error?: string | null;
};

const errorTransition = transition(
	'error',
	'error',
	reduce((ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => {
		return {
			...ctx,
			error: event.error,
		};
	}),
);

const surrealDbQueryMachine = createMachine(
	'build',
	{
		build: invoke(
			async (ctx: SurrealDbMachineContext) => build({ queries: ctx.bql.queries, schema: ctx.schema }),
			transition(
				'done',
				'run',
				reduce(
					(ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => ({
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
			async (ctx: SurrealDbMachineContext) => {
				return run({ client: ctx.client, queries: assertDefined(ctx.surql.queries) });
			},
			transition(
				'done',
				'parse',
				reduce(
					(ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => ({
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
			async (ctx: SurrealDbMachineContext) => {
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
					(ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => ({
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
	(ctx: SurrealDbMachineContext) => ctx,
);

const awaitQueryMachine = async (context: SurrealDbMachineContext) => {
	return new Promise<any[]>((resolve, reject) => {
		// @ts-expect-error Bad type
		interpret(
			surrealDbQueryMachine,
			// @ts-expect-error Bad type
			(service) => {
				if (service.machine.state.name === 'success') {
					resolve(service.context.bql.res);
				}
				if (service.machine.state.name === 'error') {
					reject(service.context.error);
				}
			},
			context,
		);
	});
};

export const runSurrealDbQueryMachine = async (
	enrichedBql: EnrichedBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	client: Surreal,
) => {
	return awaitQueryMachine({
		bql: {
			queries: enrichedBql,
		},
		surql: {},
		schema: schema,
		config: config,
		client,
		error: null,
	});
};
