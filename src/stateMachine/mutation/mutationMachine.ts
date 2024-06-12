import type { BQLMutation, BormConfig, DBHandles, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../types';
import { enrichBQLMutation } from './bql/enrich';
import { parseBQLMutation } from './bql/parse';
import { mutationPreQuery } from './bql/preQuery';

import { createMachine, transition, reduce, guard, state, invoke } from '../robot3';
import { stringify } from './bql/stringify';
import { preHookDependencies } from './bql/enrichSteps/preHookDependencies';
import { dependenciesGuard } from './bql/guards/dependenciesGuard';
import type { MutationMachineContext } from '../types';
import { runTqlMutationMachine } from './tql/tqlMutationMachine';
import { cleanMutationRes } from './bql/clean';
import { errorTransition } from '../common/errorTransition';
import { awaitMachine } from '../common/awaitMachine';
import { Schema } from '../../types/symbols';
import { runSurqlMutationMachine } from './surql/surqlMutationMachine';
import { assertDefined } from '../../helpers';

const final = state;

// Reducer
// ============================================================================

const updateBqlReq = (ctx: MutationMachineContext, event: any) => {
	if (!event.data) {
		///when preQueries return nothing, that should not affect the ctx
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, current: event.data },
	};
};

const updateBqlRes = (ctx: MutationMachineContext, event: any) => {
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const updateThingsEdges = (ctx: MutationMachineContext, event: any) => {
	return {
		...ctx,
		bql: {
			...ctx.bql,
			things: event.data.mergedThings,
			edges: event.data.mergedEdges,
		},
	};
};

// Actors
// ============================================================================

const enrich = async (ctx: MutationMachineContext) => {
	return Object.keys(ctx.bql.current).length
		? enrichBQLMutation(ctx.bql.current, ctx.schema, ctx.config)
		: enrichBQLMutation(ctx.bql.raw, ctx.schema, ctx.config);
};

const preQuery = async (ctx: MutationMachineContext) => {
	return mutationPreQuery(ctx.bql.current, ctx.schema, ctx.config, ctx.handles);
};

const preQueryDependencies = async (ctx: MutationMachineContext) => {
	return preHookDependencies(ctx.bql.current, ctx.schema, ctx.config, ctx.handles);
};

const parseBQL = async (ctx: MutationMachineContext) => {
	return parseBQLMutation(ctx.bql.current, ctx.schema);
};

// Guards
// ============================================================================
const requiresPreQuery = () => {
	return true;
};

const requiresPreHookDependencies = (ctx: MutationMachineContext) => {
	return dependenciesGuard(ctx.bql.current);
};

// Transitions
// ============================================================================

export const machine = createMachine(
	'stringify',
	{
		stringify: invoke(
			async (ctx: MutationMachineContext) => stringify(ctx.bql.raw, ctx.schema),
			transition('done', 'enrich', reduce(updateBqlReq)),
			errorTransition,
		),
		enrich: invoke(
			enrich,
			transition('done', 'preQuery', guard(requiresPreQuery), reduce(updateBqlReq)),
			transition('done', 'parseBQL', reduce(updateBqlReq)),
			errorTransition,
		),
		preHookDependencies: invoke(
			preQueryDependencies,
			transition('done', 'enrich', reduce(updateBqlReq)),
			errorTransition,
		),
		preQuery: invoke(
			preQuery,
			transition('done', 'preHookDependencies', guard(requiresPreHookDependencies), reduce(updateBqlReq)),
			transition('done', 'parseBQL', reduce(updateBqlReq)),
			errorTransition,
		),
		parseBQL: invoke(parseBQL, transition('done', 'runAdapter', reduce(updateThingsEdges)), errorTransition),
		runAdapter: invoke(
			async (ctx: MutationMachineContext) => {
				const databases = ctx.config.dbConnectors.map((connector) => {
					const dbId = connector.id;
					const { provider } = connector;
					const things = ctx.bql.things.filter((t) => t[Schema].defaultDBConnector.id === dbId);
					const edges = ctx.bql.edges.filter((e) => e[Schema].defaultDBConnector.id === dbId);
					const handler = ctx.handles[provider]?.get(connector.id);
					if (!handler) {
						throw new Error(`TypeDB client with id "${connector.id}" does not exist`);
					}
					return { things, edges, dbId, connector, provider, handler };
				});

				const promises = databases.map((db) => {
					if (db.provider === 'typeDB') {
						return runTqlMutationMachine(db.things, db.edges, ctx.config, ctx.schema, db.handler);
					} else if (db.provider === 'surrealDB') {
						return runSurqlMutationMachine(db.things, db.edges, ctx.config, ctx.schema, db.handler);
					} else {
						throw new Error(`Unsupported DB "${db.provider}"`);
					}
				});

				const results = await Promise.all(promises);

				// 2 Then we send each group of mutations to the right machine
				return results[0];
			},
			transition('done', 'clean', reduce(updateBqlRes)),
			errorTransition,
		),
		clean: invoke(
			async (ctx: MutationMachineContext) => cleanMutationRes(ctx.config, assertDefined(ctx.bql.res)),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
		),
		success: final(),
		error: final(),
	},
	// @ts-expect-error Bad type
	(ctx: MutationMachineContext) => ctx,
);

export const runMutationMachine = async (
	mutation: BQLMutation,
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitMachine<MutationMachineContext>(machine, {
		bql: {
			raw: mutation,
			current: {} as EnrichedBQLMutationBlock,
			things: [],
			edges: [],
			res: [],
		},
		schema: schema as EnrichedBormSchema,
		config: config,
		handles: handles,
		depthLevel: 0,
		error: null,
	});
};
