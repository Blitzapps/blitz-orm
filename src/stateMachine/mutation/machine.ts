import { setup, fromPromise, assign } from 'xstate';
import type { BQLMutationBlock, EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../types';
import { splitIdsBQLMutation } from './BQL/split';
import { enrichBQLMutation } from './BQL/enrich';
import { getCurrentSchema } from '../../helpers';
import { isArray } from 'radash';
import { parseBQLMutation } from './BQL/parse';
import { addIntermediaryRelationsBQLMutation } from './BQL/intermediary';

type rawMutationContext = {
	current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
	raw: BQLMutationBlock | BQLMutationBlock[];
	schema: EnrichedBormSchema;
};

type mutationContext = {
	current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
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
			console.log('root', root.spaces);
			const rootBase = isArray(root) ? root[0] : root;
			return getCurrentSchema(context.schema, rootBase).dbContext.mutation.requiresParseBQL;
		},
	},
	actors: {
		enrich: fromPromise(async ({ input }: { input: rawMutationContext }) => {
			const result = Object.keys(input.current).length
				? enrichBQLMutation(input.current, input.schema)
				: enrichBQLMutation(input.raw, input.schema);
			return Promise.resolve(result);
		}),
		split_ids: fromPromise(async ({ input }: { input: mutationContext }) => {
			const result = splitIdsBQLMutation(input.current, input.schema);
			return Promise.resolve(result);
		}),
		addIntermediaries: fromPromise(
			({
				input,
			}: {
				input: { current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]; schema: EnrichedBormSchema };
			}) => {
				console.log('before intermediaries', input.current);
				const result = addIntermediaryRelationsBQLMutation(input.current, input.schema);
				console.log('after intermediaries', result);
				console.log('After intermediaries', JSON.stringify(result, null, 2));
				return Promise.resolve(result);
			},
		),
		parseBQL: fromPromise(
			({
				input,
			}: {
				input: { current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]; schema: EnrichedBormSchema };
			}) => {
				return Promise.resolve(parseBQLMutation(input.current, input.schema));
			},
		),
		preQuery: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as EnrichedBQLMutationBlock;
		}),
		attributesPrehook: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as EnrichedBQLMutationBlock;
		}),
		runTypeDBMutation: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as EnrichedBQLMutationBlock;
		}),
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
						target: 'SUCCESS',
						actions: assign({
							bql: ({ context, event }: any) => {
								return { ...context.bql, things: event.output.mergedThings, edges: event.output.mergedEdges };
							},
						}),
					},
				],
				onError: [
					{
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
						target: 'ERROR',
					},
				],
			},
		},
		MUTATIONS: {
			states: {
				runTypeDBMutation: {
					invoke: {
						input: {},
						src: 'runTypeDBMutation',
						//cond: (context, event) => true,
					},
				},
				runSurrealDBMutation: {
					invoke: {
						input: {},
						src: 'runSurrealDBMutation',
					},
				},
			},
			onDone: {
				target: '#mutationPipeline.SUCCESS',
			},
			/*onError: {
				target: '#mutationPipeline.ERROR',
			},*/
			type: 'parallel',
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
