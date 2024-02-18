import { setup, fromPromise, assign } from 'xstate';
import type {
	BormConfig,
	BQLMutationBlock,
	DBHandles,
	EnrichedBormSchema,
	EnrichedBQLMutationBlock,
} from '../../types';
import { splitIdsBQLMutation } from './BQL/split';
import { enrichBQLMutation } from './BQL/enrich';
import { getCurrentSchema } from '../../helpers';
import { isArray } from 'radash';
import { parseBQLMutation } from './BQL/parse';
import { addIntermediaryRelationsBQLMutation } from './BQL/intermediary';
import { buildTQLMutation } from './TQL/build';
import type { TqlMutation } from './TQL/run';
import { runTQLMutation } from './TQL/run';

type rawMutationContext = {
	current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
	raw: BQLMutationBlock | BQLMutationBlock[];
	schema: EnrichedBormSchema;
};

type MutationContext = {
	current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
	schema: EnrichedBormSchema;
};

type BuildContext = {
	things: EnrichedBQLMutationBlock[];
	edges: EnrichedBQLMutationBlock[];
	schema: EnrichedBormSchema;
};

export const mutationActor = setup({
	actions: {
		updateBql: assign({
			bql: ({ context, event }: any) => {
				return { ...context.bql, current: event.output };
			},
		}),
	},
	guards: {
		/*example: ({ context, event }, params) => {
			return true;
		},*/
		requiresSplitIds: () => {
			return true;
		},
		requiresPrequery: () => {
			return false;
		},
		requiresParseBQL: ({ context }) => {
			//this would be more complicated than this, like count the entities requiring this, not just the root
			const root = context.bql.current;
			console.log('root', root);
			const rootBase = isArray(root) ? root[0] : root;
			const { requiresParseBQL } = getCurrentSchema(context.schema, rootBase).dbContext.mutation;
			console.log('requiresParseBql', requiresParseBQL);
			return requiresParseBQL;
		},
	},
	actors: {
		enrich: fromPromise(({ input }: { input: rawMutationContext }) => {
			const result = Object.keys(input.current).length
				? enrichBQLMutation(input.current, input.schema)
				: enrichBQLMutation(input.raw, input.schema);
			return Promise.resolve(result);
		}),
		split_ids: fromPromise(({ input }: { input: MutationContext }) => {
			const result = splitIdsBQLMutation(input.current, input.schema);
			return Promise.resolve(result);
		}),
		addIntermediaries: fromPromise(({ input }: { input: MutationContext }) => {
			const result = addIntermediaryRelationsBQLMutation(input.current, input.schema);
			return Promise.resolve(result);
		}),
		parseBQL: fromPromise(({ input }: { input: MutationContext }) => {
			return Promise.resolve(parseBQLMutation(input.current, input.schema));
		}),
		preQuery: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as EnrichedBQLMutationBlock;
		}),
		attributesPrehook: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as EnrichedBQLMutationBlock;
		}),
		/// TYPE_DB
		openTQLTransaction: fromPromise(() => {
			return new Promise((resolve) => setTimeout(resolve, 10));
		}),
		buildTQLMutation: fromPromise(({ input }: { input: BuildContext }) => {
			const result = buildTQLMutation(input.things, input.edges, input.schema);
			return result;
		}),
		runTQLMutation: fromPromise(
			({ input }: { input: { tqlMutation: TqlMutation; dbHandles: DBHandles; config: BormConfig } }) => {
				const result = runTQLMutation(input.tqlMutation, input.dbHandles, input.config);
				return result;
			},
		),
		/// SURREAL DB
		runSurrealDBMutation: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as EnrichedBQLMutationBlock;
		}),
	},
}).createMachine({
	context: ({ input }: any) => ({
		bql: {
			raw: input.raw,
			current: {} as EnrichedBQLMutationBlock,
			things: [],
			edges: [],
		},
		typeDb: {
			tqlMutation: {} as TqlMutation,
		},
		schema: input.schema,
		config: input.config,
		handles: input.handles,
		deepLevel: input.deepLevel, //root = 0
	}),
	id: 'mutationPipeline',
	initial: 'ENRICH',
	states: {
		ENRICH: {
			invoke: {
				input: ({ context }) => ({ current: context.bql.current, raw: context.bql.raw, schema: context.schema }),
				src: 'enrich',
				onDone: [
					{
						target: 'SPLIT_IDS',
						guard: 'requiresSplitIds',
						actions: 'updateBql',
					},
					{
						target: 'PARSE_BQL',
						guard: 'requiresParseBQL',
						actions: 'updateBql',
					},
				],
				onError: {
					actions: ({ event }: { event: any }) => {
						throw new Error(event.error);
					},
					target: 'ERROR',
				},
			},
		},
		SPLIT_IDS: {
			invoke: {
				src: 'split_ids',
				input: ({ context }) => ({ current: context.bql.current, schema: context.schema }),
				onDone: [
					{
						target: 'ADD_INTERMEDIARIES',
						actions: 'updateBql',
					},
				],
				onError: {
					actions: ({ event }: { event: any }) => {
						throw new Error(event.error);
					},
					target: 'ERROR',
				},
			},
		},
		ADD_INTERMEDIARIES: {
			invoke: {
				src: 'addIntermediaries',
				input: ({ context }) => ({ current: context.bql.current, schema: context.schema }),
				onDone: [
					{
						target: 'PARSE_BQL',
						guard: 'requiresParseBQL',
						actions: 'updateBql',
					},
					{
						target: 'SUCCESS',
						actions: 'updateBql',
					},
				],
				onError: {
					actions: ({ event }: { event: any }) => {
						throw new Error(event.error);
					},
					target: 'ERROR',
				},
			},
		},
		PRE_QUERY: {
			invoke: {
				input: {},
				src: 'preQuery',
				onDone: [
					{
						target: 'ATTRIBUTES_PREHOOK',
					},
				],
				onError: [
					{
						actions: ({ event }: { event: any }) => {
							throw new Error(event.error);
						},
						target: 'ERROR',
					},
				],
			},
		},
		PARSE_BQL: {
			invoke: {
				input: ({ context }) => ({ current: context.bql.current, schema: context.schema }),
				src: 'parseBQL',
				onDone: [
					{
						target: 'MUTATIONS',
						actions: assign({
							bql: ({ context, event }: any) => {
								return { ...context.bql, things: event.output.mergedThings, edges: event.output.mergedEdges };
							},
						}),
					},
				],
				onError: [
					{
						actions: ({ event }: { event: any }) => {
							throw new Error(event.error);
						},
						target: 'ERROR',
					},
				],
			},
		},
		ATTRIBUTES_PREHOOK: {
			invoke: {
				input: {},
				src: 'attributesPrehook',
				onDone: [
					{
						target: 'MUTATIONS',
					},
				],
				onError: [
					{
						actions: ({ event }: { event: any }) => {
							throw new Error(event.error);
						},
						target: 'ERROR',
					},
				],
			},
		},
		MUTATIONS: {
			type: 'parallel',
			states: {
				TYPE_DB: {
					initial: 'BUILD_QUERY',
					states: {
						BUILD_QUERY: {
							invoke: {
								input: ({ context }) => ({
									things: context.bql.things,
									edges: context.bql.edges,
									schema: context.schema,
								}),
								src: 'buildTQLMutation',
								onDone: {
									actions: assign({
										typeDb: ({ event }: any) => {
											return { tqlMutation: event.output };
										},
									}),
									target: 'OPEN_TX',
								},
							},
						},
						OPEN_TX: {
							invoke: {
								src: 'openTQLTransaction',
								onDone: {
									//actions: () => {}, //update handles
									target: 'RUN_QUERY',
								},
								onError: {
									actions: ({ event }: { event: any }) => {
										throw new Error(event.error);
									},
									target: '#mutationPipeline.ERROR',
								},
							},
						},
						RUN_QUERY: {
							invoke: {
								input: ({ context }) => ({
									tqlMutation: context.typeDb.tqlMutation,
									dbHandles: context.handles,
									config: context.config,
								}),
								src: 'runTQLMutation',
								onDone: {
									actions: assign({
										typeDb: ({ event }: any) => {
											return { tqlRes: event.output };
										},
									}),
									target: '#mutationPipeline.SUCCESS',
								},
								onError: {
									actions: ({ event }: { event: any }) => {
										throw new Error(event.error);
									},
									target: '#mutationPipeline.ERROR',
								},
							},
						},
					},
				},
			},
			/*SURREAL_DB: {
					invoke: {
						input: {},
						src: 'runSurrealDBMutation',
					},
				},*/

			onDone: {
				target: '#mutationPipeline.SUCCESS',
			},
			onError: {
				actions: ({ event }: { event: any }) => {
					throw new Error(event.error);
				},
				target: '#mutationPipeline.ERROR',
			},
		},
		SUCCESS: {
			type: 'final',
		},
		ERROR: {
			type: 'final',
		},
		FAIL: {
			type: 'final',
		},
	},
});
