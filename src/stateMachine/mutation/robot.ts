import { createMachine, guard, interpret, invoke, state, transition, reduce } from 'robot3';
import type { EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../types';
import { enrichBQLMutation } from './BQL/enrich';
import { isArray } from 'radash';
import { getCurrentSchema } from '../../helpers';
import type { TqlMutation } from './TQL/run';
import { runTQLMutation } from './TQL/run';
import type { TqlRes } from './TQL/parse';
import { parseTQLMutation } from './TQL/parse';
import { addIntermediaryRelationsBQLMutation } from './BQL/intermediary';
import { parseBQLMutation } from './BQL/parse';
import { buildTQLMutation } from './TQL/build';
import { mutationPreQuery } from './BQL/preQuery';

type MachineContext = {
	bql: {
		raw: any;
		current: EnrichedBQLMutationBlock;
		things: any[];
		edges: any[];
		res: any[];
	};
	typeDB: {
		tqlMutation: TqlMutation;
		tqlRes: TqlRes;
	};
	schema: EnrichedBormSchema;
	config: any;
	handles: any;
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
		? enrichBQLMutation(ctx.bql.current, ctx.schema)
		: enrichBQLMutation(ctx.bql.raw, ctx.schema);
};

const preQuery = async (ctx: MachineContext) => {
	return mutationPreQuery(ctx.bql.current, ctx.schema, ctx.config, ctx.handles);
};

const addIntermediaries = async (ctx: MachineContext) => {
	return addIntermediaryRelationsBQLMutation(ctx.bql.current, ctx.schema);
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
	return parseTQLMutation(ctx.typeDB.tqlRes, ctx.bql.things, ctx.bql.edges, ctx.config);
};

// Guards
// ============================================================================

const requiresParseBQL = (ctx: MachineContext) => {
	//this would be more complicated than this, like count the entities requiring this, not just the root
	const root = ctx.bql.current;
	const rootBase = isArray(root) ? root[0] : root;
	const { requiresParseBQL } = getCurrentSchema(ctx.schema, rootBase).dbContext.mutation;
	return requiresParseBQL;
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
	'enrich',
	{
		enrich: invoke(enrich, transition('done', 'preQuery', reduce(updateBqlReq)), errorTransition),
		preQuery: invoke(preQuery, transition('done', 'addIntermediaries', reduce(updateBqlReq)), errorTransition),
		addIntermediaries: invoke(
			addIntermediaries,
			transition('done', 'parseBQL', guard(requiresParseBQL), reduce(updateBqlReq)),
			transition('done', 'success', reduce(updateBqlReq)),
			errorTransition,
		),
		parseBQL: invoke(parseBQL, transition('done', 'buildMutation', reduce(updateThingsEdges)), errorTransition),
		buildMutation: invoke(buildMutation, transition('done', 'runMutation', reduce(updateTQLMutation)), errorTransition),
		runMutation: invoke(runMutation, transition('done', 'parseMutation', reduce(updateTQLRes)), errorTransition),
		parseMutation: invoke(parseMutation, transition('done', 'success', reduce(updateBqlRes)), errorTransition),
		success: state(),
		error: state(),
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
