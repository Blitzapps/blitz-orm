import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import { assertDefined } from '../../../helpers';
import type { BormConfig, EnrichedBormSchema, EnrichedBQLQuery, RawBQLQuery } from '../../../types';
import { awaitMachine } from '../../common/awaitMachine';
import { errorTransition } from '../../common/errorTransition';
import { createMachine, invoke, reduce, state, transition } from '../../robot3';
import type { QueryMachineContext } from '../../types';
import { buildTQLQuery } from './build';
import { parseTQLQuery } from './parse';
import { runTQLQuery } from './run';

export type TypeDbQueryMachineContext = Omit<QueryMachineContext, 'handles'> & {
	tql: {
		queries?: string[];
		res?: any[];
	};
	handler: { client: TypeDBDriver; session: TypeDBSession };
};

const updateBqlRes = (ctx: TypeDbQueryMachineContext, event: any): TypeDbQueryMachineContext => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const updateTqlReq = (ctx: TypeDbQueryMachineContext, event: any): TypeDbQueryMachineContext => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		tql: { ...ctx.tql, queries: event.data },
	};
};

const updateTqlRes = (ctx: TypeDbQueryMachineContext, event: any): TypeDbQueryMachineContext => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		tql: { ...ctx.tql, res: event.data },
	};
};

export const typeDbQueryMachine = createMachine(
	'build',
	{
		build: invoke(
			async (ctx: TypeDbQueryMachineContext) => buildTQLQuery({ queries: ctx.bql.queries, schema: ctx.schema }),
			transition('done', 'run', reduce(updateTqlReq)),
			errorTransition,
		),
		run: invoke(
			async (ctx: TypeDbQueryMachineContext) => {
				return runTQLQuery({
					handler: ctx.handler,
					tqlRequest: assertDefined(ctx.tql.queries),
					config: ctx.config,
				});
			},
			transition('done', 'parse', reduce(updateTqlRes)),
			errorTransition,
		),
		parse: invoke(
			async (ctx: TypeDbQueryMachineContext) =>
				parseTQLQuery({
					rawBqlRequest: ctx.bql.raw,
					enrichedBqlQuery: ctx.bql.queries,
					schema: ctx.schema,
					config: ctx.config,
					rawTqlRes: assertDefined(ctx.tql.res),
				}),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
		),
		success: state(),
		error: state(),
	},
	// @ts-expect-error Bad type
	(ctx: TypeDbQueryMachineContext) => ctx,
);

export const runTypeDbQueryMachine = async (
	bql: RawBQLQuery[],
	enrichedBql: EnrichedBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handler: { client: TypeDBDriver; session: TypeDBSession },
) =>
	awaitMachine<TypeDbQueryMachineContext>(typeDbQueryMachine, {
		bql: {
			raw: bql,
			queries: enrichedBql,
		},
		tql: {},
		schema: schema,
		config: config,
		handler,
		error: null,
	});
