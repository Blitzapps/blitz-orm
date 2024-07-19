import type Surreal from 'surrealdb.js';
import type {
	BormConfig,
	BQLMutationBlock,
	DBHandles,
	EnrichedBormSchema,
	EnrichedBQLMutationBlock,
} from '../../../types';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../robot3';
import type { bqlMutationContext } from '../mutationMachine';
import { buildSURQLMutation } from './build';
import { runSURQLMutation } from './run';
import { parseSURQLMutation } from './parse';

type SurrealDbMachineContext = {
	bql: bqlMutationContext;
	surql: {
		mutation?: unknown;
		res?: unknown;
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error?: string | null;
};

const updateBqlRes = (ctx: SurrealDbMachineContext, event: any) => {
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const updateSURQLMutation = (ctx: SurrealDbMachineContext, event: any) => {
	return {
		...ctx,
		surql: {
			...ctx.surql,
			mutation: event.data,
		},
	};
};

const updateSURQLRes = (ctx: SurrealDbMachineContext, event: any) => {
	return {
		...ctx,
		surql: {
			...ctx.surql,
			res: event.data,
		},
	};
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

const surrealDbMutationMachine = createMachine(
	'buildMutation',
	{
		buildMutation: invoke(
			async (ctx: SurrealDbMachineContext) => buildSURQLMutation(ctx.bql.enriched, ctx.schema),
			transition('done', 'runMutation', reduce(updateSURQLMutation)),
			errorTransition,
		),
		runMutation: invoke(
			async (ctx: SurrealDbMachineContext) =>
				runSURQLMutation(
					ctx.handles.surrealDB?.get(ctx.handles.surrealDB?.keys().next().value)?.client as Surreal,
					ctx.surql.mutation,
				),
			transition('done', 'parseMutation', reduce(updateSURQLRes)),
			errorTransition,
		),
		parseMutation: invoke(
			async (ctx: SurrealDbMachineContext) =>
				parseSURQLMutation({ res: ctx.surql.res, config: ctx.config, schema: ctx.schema }),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
		),
		success: state(),
		error: state(),
	},
	(ctx: SurrealDbMachineContext) => ctx,
);

const awaitMutationMachine = async (context: SurrealDbMachineContext) => {
	return new Promise<any[]>((resolve, reject) => {
		interpret(
			surrealDbMutationMachine,
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

export const runSurrealDbMutationMachine = async (
	bqRaw: BQLMutationBlock | BQLMutationBlock[],
	enrichedBql: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitMutationMachine({
		bql: {
			raw: bqRaw,
			enriched: enrichedBql,
			things: [],
			edges: [],
			res: [],
		},
		surql: {},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};
