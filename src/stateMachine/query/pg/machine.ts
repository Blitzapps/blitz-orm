import type { BormConfig, EnrichedBQLQuery, EnrichedBormSchema } from '../../../types';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../robot3';
import type { Q } from './build';
import { build } from './build';
import { run } from './run';
import { assertDefined } from '../../../helpers';
import type { Client } from 'pg';

export type PostgresDbMachineContext = {
	bql: {
		queries: EnrichedBQLQuery[];
		res?: any[];
	};
	postgres: {
		queries?: Q[];
		res?: any[];
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	client: Client;
	error?: string | null;
};

const errorTransition = transition(
	'error',
	'error',
	reduce((ctx: PostgresDbMachineContext, event: any): PostgresDbMachineContext => {
		return {
			...ctx,
			error: event.error,
		};
	}),
);

const postgresDbQueryMachine = createMachine(
	'build',
	{
		build: invoke(
			async (ctx: PostgresDbMachineContext) => {
				return build({ queries: ctx.bql.queries, schema: ctx.schema });
			},
			transition(
				'done',
				'run',
				reduce(
					(ctx: PostgresDbMachineContext, event: any): PostgresDbMachineContext => ({
						...ctx,
						postgres: {
							queries: event.data,
						},
					}),
				),
			),
			errorTransition,
		),
		run: invoke(
			async (ctx: PostgresDbMachineContext) => {
				return run({
					client: ctx.client,
					queries: assertDefined(ctx.postgres.queries),
					metadata: !ctx.config.query?.noMetadata,
				});
			},
			transition(
				'done',
				'success',
				reduce(
					(ctx: PostgresDbMachineContext, event: any): PostgresDbMachineContext => ({
						...ctx,
						postgres: {
							...ctx.postgres,
							res: event.data,
						},
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
	(ctx: PostgresDbMachineContext) => ctx,
);

const awaitQueryMachine = async (context: PostgresDbMachineContext) => {
	return new Promise<any[]>((resolve, reject) => {
		interpret(
			postgresDbQueryMachine,
			(service) => {
				if (service.machine.state.name === 'success') {
					//@ts-expect-error = todo
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

export const runPostgresSurrealDbQueryMachine = async (
	enrichedBql: EnrichedBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	client: Client,
) => {
	return awaitQueryMachine({
		bql: {
			queries: enrichedBql,
		},
		postgres: {},
		schema: schema,
		config: config,
		client,
		error: null,
	});
};
