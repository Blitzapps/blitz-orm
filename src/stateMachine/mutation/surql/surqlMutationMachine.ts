import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import type { EnrichedBormSchema, BormConfig, EnrichedBQLMutationBlock } from '../../../types';
import { awaitMachine } from '../../common/awaitMachine';
import { errorTransition } from '../../common/errorTransition';
import { createMachine, invoke, transition, state, reduce } from '../../robot3';
import type { MutationMachineContext } from '../../types';
import type Surreal from 'surrealdb.js';
import { buildSurqlMutation } from './build';
import { cleanRecordIdSurrealDb } from '../../../adapters/surrealDB/helpers';

type SurrealDBMutationMachineContext = Omit<MutationMachineContext, 'handles'> & {
	surql: {
		req: any;
		res: any;
	};
	handler: { client: Surreal };
};

// REDUCERS
const updateSurqlReq = (ctx: SurrealDBMutationMachineContext, event: any) => ({
	...ctx,
	surql: {
		...ctx.surql,
		req: event.data,
	},
});

const updateSurqlRes = (ctx: SurrealDBMutationMachineContext, event: any) => ({
	...ctx,
	surql: {
		...ctx.surql,
		res: event.data,
	},
});

const updateBqlRes = (ctx: MutationMachineContext, event: any) => ({
	...ctx,
	bql: { ...ctx.bql, res: event.data },
});

// STEPS
const build = async (ctx: SurrealDBMutationMachineContext) =>
	buildSurqlMutation(ctx.bql.things, ctx.bql.edges, ctx.schema); //ctx.bql.edges);

const run = async (ctx: SurrealDBMutationMachineContext) => {
	const { client } = ctx.handler;
	const { req } = ctx.surql;
	const batchedMutation = `
	BEGIN TRANSACTION;
	${[...req.creations, ...req.updates, ...req.deletions].join(';\n')};
	COMMIT TRANSACTION;
	`;
	try {
		const res = await client.query(batchedMutation);
		console.log('res', res);
		return res;
	} catch (e) {
		console.log('e', e);
	}
};

const parse = async (ctx: SurrealDBMutationMachineContext) => {
	const mutations = ctx.surql.res as EnrichedBQLMutationBlock[];
	console.log('mutations', ctx.surql.res);
	const result = mutations.map((mut) => ({
		...mut.record,
		...mut.metadata,
		...(mut.record?.id ? { id: cleanRecordIdSurrealDb(mut.record.id, mut.record.$thing) } : {}),
	}));
	console.log('result2', result);
	return result;
};

export const typeDbMutationMachine = createMachine(
	'build',
	{
		build: invoke(build, transition('done', 'run', reduce(updateSurqlReq)), errorTransition),
		run: invoke(run, transition('done', 'parse', reduce(updateSurqlRes)), errorTransition),
		parse: invoke(parse, transition('done', 'success', reduce(updateBqlRes)), errorTransition),
		success: state(),
		error: state(),
	},
	// @ts-expect-error Bad type
	(ctx: SurrealDBMutationMachineContext) => ctx,
);

export const runSurqlMutationMachine = async (
	things: EnrichedBQLMutationBlock[],
	edges: (EnrichedBQLMutationBlock & { $thingType: 'relation' })[],
	config: BormConfig,
	schema: EnrichedBormSchema,
	handler: { client: TypeDBDriver; session: TypeDBSession },
) =>
	awaitMachine<SurrealDBMutationMachineContext>(typeDbMutationMachine, {
		bql: {
			raw: {},
			current: {} as EnrichedBQLMutationBlock,
			things: things,
			edges: edges,
			res: [],
		},
		surql: {
			res: {},
			req: {},
		},
		schema: schema as EnrichedBormSchema,
		config: config,
		handler: handler,
		depthLevel: 0,
		error: null,
	});
