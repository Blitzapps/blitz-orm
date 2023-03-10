/* eslint-disable no-await-in-loop */
import { ConceptMap, ConceptMapGroup } from 'typedb-client';

import { dispatchPipeline } from './control';
import { buildBQLTree, parseTQLRes } from './postprocess';
import { parseBQLQuery, buildTQLQuery } from './preprocess';
import { buildTQLMutation } from './preprocess/buildTQLMutation';
import { parseBQLMutation } from './preprocess/parseBQLMutation';
import { runTQLQuery } from './transaction';
import { runTQLMutation } from './transaction/runTQLMutation';
import type {
  BormConfig,
  BQLResponse,
  DBHandles,
  EnrichedBormSchema,
  ParsedBQLMutation as BQLMutation,
  ParsedBQLQuery as BQLQuery,
  RawBQLQuery as RawBQLRequest,
  TQLRequest,
} from '../types';

export type RelationName = string;
export type EntityName = string;
export type RoleName = string;
export type ID = string;
type EntityID = ID;
export type Entity = { $entity: string; $id: string } & Record<string, any>;

type Request = {
  rawBqlRequest: RawBQLRequest;
  bqlRequest?: { query?: BQLQuery; mutation?: BQLMutation };
  schema: EnrichedBormSchema;
  config: BormConfig;
  tqlRequest?: TQLRequest;
  dbHandles: DBHandles;
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
  bqlRes?: BQLResponse;
};

type NextPipeline = {
  req: Request;
  res: Response;
  pipeline: PipelineOperation[];
};

export type PipelineOperation = (req: Request, res: Response) => Promise<void | NextPipeline[]>;

export type Pipeline = PipelineOperation[];

export const Pipelines: Record<string, Pipeline> = {
  query: [parseBQLQuery, buildTQLQuery, runTQLQuery, parseTQLRes, dispatchPipeline],
  mutation: [parseBQLMutation, buildTQLMutation, runTQLMutation, parseTQLRes],
};

// const finalPipeline = [buildBQLTree, processFieldsOperator, processIdOperator];
const finalPipeline = [buildBQLTree];

const runPipeline = async (
  pipeline: Pipeline,
  req: Request,
  res: Response = {},
  root = true
  // todo: ts antoine
  // eslint-disable-next-line consistent-return
): Promise<BQLResponse | void> => {
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
    await runPipeline(finalPipeline, req, res, false);
    // console.log(res.tqlRes?.entities.map((e) => e.entries));
    return res.bqlRes;
  }
};

export const queryPipeline = (
  bqlRequest: RawBQLRequest,
  bormConfig: BormConfig,
  bormSchema: EnrichedBormSchema,
  dbHandles: DBHandles
) =>
  runPipeline(
    Pipelines.query,
    {
      config: bormConfig,
      schema: bormSchema,
      rawBqlRequest: bqlRequest,
      dbHandles,
    },
    {}
  );

export const mutationPipeline = (
  bqlRequest: RawBQLRequest,
  bormConfig: BormConfig,
  bormSchema: EnrichedBormSchema,
  dbHandles: DBHandles
) =>
  runPipeline(
    Pipelines.mutation,
    {
      config: bormConfig,
      schema: bormSchema,
      rawBqlRequest: bqlRequest,
      dbHandles,
    },
    {}
  );
