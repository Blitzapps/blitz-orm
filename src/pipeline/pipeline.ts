/* eslint-disable no-await-in-loop */
import type { ConceptMap, ConceptMapGroup } from 'typedb-driver';

import { buildBQLTree, parseTQLMutation } from './postprocess';
import { buildTQLMutation } from './preprocess/mutation/buildTQLMutation';
import { enrichBQLMutation } from './preprocess/mutation/bql/2.enrichment/enrichBQLMutation';
import { parseBQLMutation } from './preprocess/mutation/parseBQLMutation';
import { runTQLMutation } from './transaction/runTQLMutation';
import type {
	BormConfig,
	BQLResponse,
	DBHandles,
	EnrichedBormSchema,
	ParsedBQLMutation as BQLMutation,
	ParsedBQLQuery as BQLQuery,
	TQLRequest,
	FilledBQLMutationBlock,
	BQLResponseMulti,
	BQLRequest,
	RawBQLQuery,
	RawBQLMutation,
} from '../types';
import { buildTQLQuery } from './preprocess/query/buildTQLQuery';
import { enrichBQLQuery } from './preprocess/query/enrichBQLQuery';
import { runTQLQuery } from './transaction/runTQLQuery';
import { parseTQLQuery } from './postprocess/query/parseTQLQuery';
import { preQuery } from './preprocess/mutation/preQuery';
import { attributePreHooks } from './preprocess/mutation/attributePreeHooks';
import { nodePreHooks } from './preprocess/mutation/nodePreeHooks';
import { validationHooks } from './preprocess/mutation/validationHooks';
import { postHooks } from './postprocess/query/postHooks';
import { cleanQueryRes } from './postprocess/query/cleanQueryRes';
import { validateBQLMutationStep } from './preprocess/mutation/bql/1.validation/validateBQLMutation';
export type RelationName = string;
export type EntityName = string;
export type ID = string;
type EntityID = ID;
export type Entity = { $entity: string; $id: string; $show?: boolean } & Record<string, any>;

type Request = {
	rawBqlRequest: BQLRequest;
	filledBqlRequest?: FilledBQLMutationBlock[] | FilledBQLMutationBlock; // todo: transform into filledBQLRequest with queries as well
	bqlRequest?: { query?: BQLQuery; mutation?: BQLMutation };
	schema: EnrichedBormSchema;
	config: BormConfig;
	tqlRequest?: TQLRequest;
	dbHandles: DBHandles;
	// todo: define type
	enrichedBqlQuery?: any;
};

type Response = {
	rawTqlRes?: {
		// queries
		entity?: ConceptMapGroup[];
		roles?: {
			path: string;
			ownerPath: string;
			conceptMapGroups: ConceptMapGroup[];
		}[];
		relations?: {
			relation: string;
			entity: string;
			conceptMapGroups: ConceptMapGroup[];
		}[];
		// mutations
		insertions?: ConceptMap[];
	};
	cache?: {
		entities: Map<EntityName, Map<EntityID, Entity>>;
		relations: Map<RelationName, Map<EntityName, EntityID>[]>;
		roleLinks: Map<EntityID, { [path: string]: EntityID | EntityID[] }>;
	};
	bqlRes?: BQLResponse | null;
	parsedTqlRes?: BQLResponse | null;
	isBatched?: boolean;
};

type NextPipeline = {
	req: Request;
	res: Response;
	pipeline: PipelineOperation[];
};

export type PipelineOperation = (req: Request, res: Response) => Promise<void | NextPipeline[]>;

type Pipeline = PipelineOperation[];

const Pipelines: Record<string, Pipeline> = {
	query: [enrichBQLQuery, buildTQLQuery, runTQLQuery, parseTQLQuery, postHooks, cleanQueryRes],
	mutation: [
		validateBQLMutationStep,
		enrichBQLMutation,
		preQuery,
		attributePreHooks,
		nodePreHooks,
		//enrichBQLMutation, //need to enrich transformation in the prehooks
		validationHooks,
		parseBQLMutation,
		buildTQLMutation,
		runTQLMutation,
		parseTQLMutation,
		buildBQLTree,
	],
};

// const finalPipeline = [buildBQLTree, processFieldsOperator, processIdOperator];
// const finalPipeline = [];

const runPipeline = async (
	pipeline: Pipeline,
	req: Request,
	res: Response = {},
	root = true,
	// todo: ts antoine
	// eslint-disable-next-line consistent-return
): Promise<BQLResponse> => {
	// console.log('Heeeeey', pipeline);
	// todo: ts antoine
	// eslint-disable-next-line no-restricted-syntax
	for (const operation of pipeline) {
		// console.log('operation', operation.name);

		const next = await operation(req, res);
		if (next && Array.isArray(next)) {
			// eslint-disable-next-line no-restricted-syntax
			for (const nextPipeline of next) {
				await runPipeline(nextPipeline.pipeline, nextPipeline.req, nextPipeline.res, false);
			}
		}
	}
	if (root) {
		// await runPipeline(finalPipeline, req, res, false);
		// console.log(res.tqlRes?.entities.map((e) => e.entries));
		/// when debugging add the tqlRequest
		/// todo: At some point, make the debugger more precise so we can decide what to add in this object (for instance also the answer?)
		if (req.config.query?.debugger === true && typeof res.bqlRes === 'object') {
			return { ...res.bqlRes, $debugger: { tqlRequest: req.tqlRequest } } as BQLResponse;
		}

		//TODO: split type output of mutation pipeline and query pipeline
		return res.bqlRes as BQLResponse;
	}
	return res.bqlRes as BQLResponse;
};

export const queryPipeline = (
	bqlRequest: RawBQLQuery,
	bormConfig: BormConfig,
	bormSchema: EnrichedBormSchema,
	dbHandles: DBHandles,
) =>
	runPipeline(
		Pipelines.query,
		{
			config: bormConfig,
			schema: bormSchema,
			rawBqlRequest: bqlRequest,
			dbHandles,
		},
		{},
	);

export const mutationPipeline = (
	bqlRequest: BQLMutation,
	bormConfig: BormConfig,
	bormSchema: EnrichedBormSchema,
	dbHandles: DBHandles,
) =>
	runPipeline(
		Pipelines.mutation,
		{
			config: bormConfig,
			schema: bormSchema,
			rawBqlRequest: bqlRequest,
			dbHandles,
		},
		{},
	) as Promise<BQLResponseMulti>;

/// From here, new version

type BQLMutationResponse = {
	dbRes: any;
	bqlRes?: BQLResponse;
};

type NextMutationPipeline = {
	req: RawBQLMutation | RawBQLMutation[];
	res: BQLMutationResponse;
	pipeline: MutationPipelineOperation[];
};

export type MutationPipelineOperation = (
	req: RawBQLMutation | RawBQLMutation[],
	res: BQLMutationResponse,
) => Promise<void | NextMutationPipeline[]>;

type MutationRequest = {
	rawBqlRequest: RawBQLMutation | RawBQLMutation[];

	filledBqlRequest?: FilledBQLMutationBlock[] | FilledBQLMutationBlock; // todo: transform into filledBQLRequest with queries as well

	schema: EnrichedBormSchema;
	config: BormConfig;
	dbHandles: DBHandles;
};

export const runMutationPipeline = async (
	req: RawBQLMutation | RawBQLMutation[],
	res: BQLMutationResponse = {} as BQLMutationResponse,
	// todo: ts antoine
	// eslint-disable-next-line consistent-return
): Promise<BQLResponse> => {
	const pipeline = [
		enrichBQLMutation,
		attributePreHooks,
		nodePreHooks,
		validateBQLMutationStep,
		enrichBQLMutation,
		preQuery,
		validationHooks,
		parseBQLMutation,
		buildTQLMutation,
		runTQLMutation,
		parseTQLMutation,
		buildBQLTree,
	];

	// eslint-disable-next-line no-restricted-syntax
	for (const operation of pipeline) {
		// console.log('operation', operation.name);

		const next = await operation(req, res);
		if (next && Array.isArray(next)) {
			// eslint-disable-next-line no-restricted-syntax
			for (const nextPipeline of next) {
				await runMutationPipeline(nextPipeline.pipeline, nextPipeline.req, nextPipeline.res, false);
			}
		}
	}

	return res.bqlRes as BQLResponse;
};
