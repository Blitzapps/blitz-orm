import { setup, fromPromise, assign } from 'xstate';
import type {
	BQLMutationBlock,
	EnrichedBQLMutationBlock,
	EnrichedBormSchema,
	FilledBQLMutationBlock,
} from '../../types';
import { splitIdsBQLMutation } from './BQL/split';
import { enrichBQLMutation } from './BQL/enrich';
import { getCurrentSchema } from '../../helpers';
import { isArray } from 'radash';
import { parseBQLMutation } from './BQL/parse';

type mutationContext = {
	current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
	raw: BQLMutationBlock;
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
		requiresSplitIds: ({ context, event }, params) => {
			return true;
		},
		requiresPrequery: ({ context, event }, params) => {
			return false;
		},
		requiresParseBQL: ({ context }) => {
			//this would be more complicated than this, like count the entities requiring this, not just the root
			const root = context.bql.current;
			console.log('root', root);
			const rootBase = isArray(root) ? root[0] : root;
			return getCurrentSchema(context.schema, rootBase).dbContext.mutation.requiresParseBQL;
		},
	},
	actors: {
		enrich: fromPromise(async ({ input }: { input: mutationContext }) => {
			console.log('Before enrich', input.current, input.raw);
			const result = Object.keys(input.current).length
				? enrichBQLMutation(input.current, input.schema)
				: enrichBQLMutation(input.raw, input.schema);
			console.log('After enrich', result);
			return result;
		}),
		split_ids: fromPromise(async ({ input }: { input: mutationContext }) => {
			console.log('bedore split', input.current, input.raw);
			const result = Object.keys(input.current).length
				? splitIdsBQLMutation(input.current, input.schema)
				: splitIdsBQLMutation(input.raw, input.schema);
			console.log('after split', result);
			return result;
		}),
		parseBQL: fromPromise(
			async ({
				input,
			}: {
				input: { current: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]; schema: EnrichedBormSchema };
			}) => {
				console.log('Before parseBQL', input.current);
				const result = parseBQLMutation(input.current, input.schema);
				console.log('After parseBQL', result);
				return result;
			},
		),
		preQuery: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as FilledBQLMutationBlock;
		}),
		attributesPrehook: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as FilledBQLMutationBlock;
		}),
		runTypeDBMutation: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as FilledBQLMutationBlock;
		}),
		runSurrealDBMutation: fromPromise(async ({ input }) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return input as FilledBQLMutationBlock;
		}),
	},
}).createMachine({
	context: ({ input }: any) => ({
		bql: {
			raw: input.raw,
			current: {} as FilledBQLMutationBlock,
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
				onError: [
					{
						target: 'ERROR',
					},
				],
			},
		},
		SPLIT_IDS: {
			invoke: {
				src: 'split_ids',
				input: ({ context }) => ({ current: context.bql.current, raw: context.bql.raw, schema: context.schema }),
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
