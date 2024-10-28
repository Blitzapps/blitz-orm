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
import type { EnrichedSURQLMutationRes } from './parse';
import { parseSURQLMutation } from './parse';
import { isArray } from 'radash';
import type { FlatBqlMutation } from '../bql/flatter';
import type { SurrealPool } from '../../../adapters/surrealDB/client';

type SurrealDbMachineContext = {
	bql: bqlMutationContext;
	surql: {
		mutations: string[];
		res: EnrichedSURQLMutationRes[][]; //todo maybe a flat versi
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
	if (!event.data || !isArray(event.data) || event.data.some((d: any) => typeof d !== 'string')) {
		throw new Error('Invalid event data');
	}
	return {
		...ctx,
		surql: {
			...ctx.surql,
			mutations: event.data as string[],
		},
	};
};

const updateSURQLRes = (ctx: SurrealDbMachineContext, event: any) => {
	if (!event.data || !isArray(event.data)) {
		throw new Error('Invalid event data');
	}
	return {
		...ctx,
		surql: {
			...ctx.surql,
			res: event.data as EnrichedSURQLMutationRes[][],
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
			async (ctx: SurrealDbMachineContext) => buildSURQLMutation(ctx.bql.flat, ctx.schema),
			transition('done', 'runMutation', reduce(updateSURQLMutation)),
			errorTransition,
		),
		runMutation: invoke(
			async (ctx: SurrealDbMachineContext) =>
				runSURQLMutation(
					ctx.handles.surrealDB?.get(ctx.handles.surrealDB?.keys().next().value as string)?.client as SurrealPool,
					ctx.surql.mutations,
					ctx.config,
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
	bqlRaw: BQLMutationBlock | BQLMutationBlock[],
	enrichedBql: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	bqlFlat: FlatBqlMutation,
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitMutationMachine({
		bql: {
			raw: bqlRaw,
			enriched: enrichedBql,
			flat: bqlFlat,
			things: [],
			edges: [],
			res: [],
		},
		surql: {
			mutations: [],
			res: [],
		},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};
