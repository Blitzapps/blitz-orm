import type {
	BQLMutation,
	BQLMutationBlock,
	BormConfig,
	DBHandles,
	EnrichedBQLMutationBlock,
	EnrichedBormSchema,
} from '../../types';
import { enrichBQLMutation } from './bql/enrich';
import type { TqlMutation } from './tql/run';
import { runTQLMutation } from './tql/run';
import type { TqlRes } from './tql/parse';
import { parseTQLMutation } from './tql/parse';
import { parseBQLMutation } from './bql/parse';
import { buildTQLMutation } from './tql/build';
import { mutationPreQuery } from './bql/preQuery';

import { createMachine, transition, reduce, guard, interpret, state, invoke } from 'robot3';
import { stringify } from './bql/stringify';
import { preHookDependencies } from './bql/enrichSteps/preHookDependencies';
import { dependenciesGuard } from './bql/guards/dependenciesGuard';

const final = state;
type MachineContext = {
	bql: {
		raw: BQLMutationBlock | BQLMutationBlock[];
		current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
		things: any[];
		edges: any[];
		res: any[];
	};
	typeDB: {
		tqlMutation: TqlMutation;
		tqlRes: TqlRes;
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	depthLevel: number;
	error: string | null;
};

// Reducer
// ============================================================================

const updateBqlReq = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		///when preQueries return nothing, that should not affect the ctx
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, current: event.data },
	};
};

const updateBqlRes = (ctx: MachineContext, event: any) => {
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const updateThingsEdges = (ctx: MachineContext, event: any) => {
	return {
		...ctx,
		bql: {
			...ctx.bql,
			things: event.data.mergedThings,
			edges: event.data.mergedEdges,
		},
	};
};

const updateTQLMutation = (ctx: MachineContext, event: any) => {
	return {
		...ctx,
		typeDB: {
			...ctx.typeDB,
			tqlMutation: event.data,
		},
	};
};

const updateTQLRes = (ctx: MachineContext, event: any) => {
	return {
		...ctx,
		typeDB: {
			...ctx.typeDB,
			tqlRes: event.data,
		},
	};
};

// Actors
// ============================================================================

const enrich = async (ctx: MachineContext) => {
	return Object.keys(ctx.bql.current).length
		? enrichBQLMutation(ctx.bql.current, ctx.schema, ctx.config)
		: enrichBQLMutation(ctx.bql.raw, ctx.schema, ctx.config);
};

const preQuery = async (ctx: MachineContext) => {
	return mutationPreQuery(ctx.bql.current, ctx.schema, ctx.config, ctx.handles);
};

const preQueryDependencies = async (ctx: MachineContext) => {
	return preHookDependencies(ctx.bql.current, ctx.schema, ctx.config, ctx.handles);
};

const parseBQL = async (ctx: MachineContext) => {
	return parseBQLMutation(ctx.bql.current, ctx.schema);
};

const buildMutation = async (ctx: MachineContext) => {
	return buildTQLMutation(ctx.bql.things, ctx.bql.edges, ctx.schema);
};

const runMutation = async (ctx: MachineContext) => {
	return runTQLMutation(ctx.typeDB.tqlMutation, ctx.handles, ctx.config);
};

const parseMutation = async (ctx: MachineContext) => {
	return parseTQLMutation(ctx.typeDB.tqlRes, ctx.bql.things, ctx.bql.edges, ctx.schema, ctx.config);
};

// Guards
// ============================================================================
const requiresPreQuery = () => {
	return true;
};

const requiresPreHookDependencies = (ctx: MachineContext) => {
	return dependenciesGuard(ctx.bql.current);
};

// Transitions
// ============================================================================

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

export const machine = createMachine(
	'stringify',
	{
		stringify: invoke(
			async (ctx: MachineContext) => stringify(ctx.bql.raw, ctx.schema),
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
		parseBQL: invoke(parseBQL, transition('done', 'buildMutation', reduce(updateThingsEdges)), errorTransition),
		buildMutation: invoke(buildMutation, transition('done', 'runMutation', reduce(updateTQLMutation)), errorTransition),
		runMutation: invoke(runMutation, transition('done', 'parseMutation', reduce(updateTQLRes)), errorTransition),
		parseMutation: invoke(parseMutation, transition('done', 'success', reduce(updateBqlRes)), errorTransition),
		success: final(),
		error: final(),
	},
	(ctx: MachineContext) => ctx,
);

export const awaitMachine = async (context: MachineContext) => {
	return new Promise<MachineContext>((resolve, reject) => {
		interpret(
			machine,
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

export const runMutationMachine = async (
	mutation: BQLMutation,
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitMachine({
		bql: {
			raw: mutation,
			current: {} as EnrichedBQLMutationBlock,
			things: [],
			edges: [],
			res: [],
		},
		typeDB: {
			tqlMutation: {} as TqlMutation,
			tqlRes: {} as TqlRes,
		},
		schema: schema as EnrichedBormSchema,
		config: config,
		handles: handles,
		depthLevel: 0,
		error: null,
	});
};
