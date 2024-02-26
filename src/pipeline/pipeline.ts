/* eslint-disable no-await-in-loop */
import type { ConceptMap, ConceptMapGroup } from 'typedb-driver';

import type {
	BormConfig,
	BQLResponse,
	DBHandles,
	EnrichedBormSchema,
	ParsedBQLMutation as BQLMutation,
	ParsedBQLQuery as BQLQuery,
	RawBQLQuery as RawBQLRequest,
	TQLRequest,
	FilledBQLMutationBlock,
	BQLResponseMulti,
  Pipeline,
  Request,
  BaseResponse
} from '../types';
import { buildTQLQuery } from './preprocess/query/buildTQLQuery';
import { enrichBQLQuery } from './preprocess/query/enrichBQLQuery';
import { runTQLQuery } from './transaction/runTQLQuery';
import { parseTQLQuery } from './postprocess/query/parseTQLQuery';
import { postHooks } from './postprocess/query/postHooks';
import { cleanQueryRes } from './postprocess/query/cleanQueryRes';
import { SurrealDbPipelines } from '../adapters/surrealDB'

export type RelationName = string;
export type EntityName = string;

export type ID = string;
type EntityID = ID;
export type Entity = { $entity: string; $id: string; $show?: boolean } & Record<string, any>;

export type TypeDbResponse = {
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

const Pipelines: Record<string, Pipeline<TypeDbResponse>> = {
	query: [enrichBQLQuery, buildTQLQuery, runTQLQuery, parseTQLQuery, postHooks, cleanQueryRes],
	/*mutation: [
		enrichBQLMutation,
		preQuery,
		attributePreHooks,
		nodePreHooks,
		validationHooks,
		parseBQLMutation,
		buildTQLMutation,
		runTQLMutation,
		parseTQLMutation,
		buildBQLTree,
	],*/
};

// const finalPipeline = [buildBQLTree, processFieldsOperator, processIdOperator];
// const finalPipeline = [];

const runPipeline = async <Res extends BaseResponse>(
	pipeline: Pipeline<TypeDbResponse>,
	req: Request,
	res: Res,
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
	bqlRequest: RawBQLRequest,
	bormConfig: BormConfig,
	bormSchema: EnrichedBormSchema,
	dbHandles: DBHandles,
) => {
  if(dbHandles.typeDB && dbHandles.typeDB.size > 0){
    return runPipeline(
      Pipelines.query,
      {
        config: bormConfig,
        schema: bormSchema,
        rawBqlRequest: bqlRequest,
        dbHandles,
      },
      {},
    );
  } else if (dbHandles.surrealDB && dbHandles.surrealDB.size > 0) {
    return runPipeline(
      SurrealDbPipelines.query,
      {
        config: bormConfig,
        schema: bormSchema,
        rawBqlRequest: bqlRequest,
        dbHandles,
      },
      {},
    );
  } else {
    throw new Error("no pipeline defined")
  }
}

export const mutationPipeline = (
	bqlRequest: RawBQLRequest,
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
