import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import type { EnrichedBormSchema, BormConfig, EnrichedBQLMutationBlock } from '../../../types';
import { awaitMachine } from '../../common/awaitMachine';
import { errorTransition } from '../../common/errorTransition';
import { createMachine, invoke, transition, state, reduce } from '../../robot3';
import type { MutationMachineContext } from '../../types';
import { buildTQLMutation } from './build';
import { parseTQLMutation, type TqlRes } from './parse';
import { runTQLMutation, type TqlMutation } from './run';

type TypeDbMutationMachineContext = Omit<MutationMachineContext, 'handles'> & {
	typeDB: {
		tqlMutation: TqlMutation;
		tqlRes: TqlRes;
	};
	handler: { client: TypeDBDriver; session: TypeDBSession };
};

// PARSERS
const updateTQLMutation = (ctx: TypeDbMutationMachineContext, event: any) => ({
	...ctx,
	typeDB: {
		...ctx.typeDB,
		tqlMutation: event.data,
	},
});

const updateTQLRes = (ctx: TypeDbMutationMachineContext, event: any) => ({
	...ctx,
	typeDB: {
		...ctx.typeDB,
		tqlRes: event.data,
	},
});

const updateBqlRes = (ctx: TypeDbMutationMachineContext, event: any) => ({
	...ctx,
	bql: { ...ctx.bql, res: event.data },
});

// STEPS
const build = async (ctx: TypeDbMutationMachineContext) => buildTQLMutation(ctx.bql.things, ctx.bql.edges, ctx.schema);
const run = async (ctx: TypeDbMutationMachineContext) =>
	runTQLMutation(ctx.typeDB.tqlMutation, ctx.handler, ctx.config);
const parse = async (ctx: TypeDbMutationMachineContext) =>
	parseTQLMutation(ctx.typeDB.tqlRes, ctx.bql.things, ctx.bql.edges, ctx.schema, ctx.config);

export const typeDbMutationMachine = createMachine(
	'build',
	{
		build: invoke(build, transition('done', 'run', reduce(updateTQLMutation)), errorTransition),
		run: invoke(run, transition('done', 'parse', reduce(updateTQLRes)), errorTransition),
		parse: invoke(parse, transition('done', 'success', reduce(updateBqlRes)), errorTransition),
		success: state(),
		error: state(),
	},
	// @ts-expect-error Bad type
	(ctx: TypeDbMutationMachineContext) => ctx,
);

export const runTqlMutationMachine = async (
	things: EnrichedBQLMutationBlock[],
	edges: (EnrichedBQLMutationBlock & { thingType: 'relation' })[],
	config: BormConfig,
	schema: EnrichedBormSchema,
	handler: { client: TypeDBDriver; session: TypeDBSession },
) =>
	awaitMachine<TypeDbMutationMachineContext>(typeDbMutationMachine, {
		bql: {
			raw: {},
			current: {} as EnrichedBQLMutationBlock,
			things: things,
			edges: edges,
			res: [],
		},
		typeDB: {
			tqlMutation: {} as TqlMutation,
			tqlRes: {} as TqlRes,
		},
		schema: schema as EnrichedBormSchema,
		config: config,
		handler: handler,
		depthLevel: 0,
		error: null,
	});
