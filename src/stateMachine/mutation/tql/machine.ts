import { createMachine, interpret, invoke, reduce, state, transition } from '../../../robot3';
import type {
  BormConfig,
  BQLMutationBlock,
  DBHandles,
  EnrichedBormSchema,
  EnrichedBQLMutationBlock,
} from '../../../types';
import type { bqlMutationContext } from '../mutationMachine';
import { buildTQLMutation } from './build';
import type { TqlRes } from './parse';
import { parseTQLMutation } from './parse';
import type { TqlMutation } from './run';
import { runTQLMutation } from './run';

type TypeDbMachineContext = {
  bql: bqlMutationContext;
  tql: {
    mutation?: TqlMutation;
    res?: TqlRes;
  };
  schema: EnrichedBormSchema;
  config: BormConfig;
  handles: DBHandles;
  error?: string | null;
};

const updateBqlRes = (ctx: TypeDbMachineContext, event: any) => {
  return {
    ...ctx,
    bql: { ...ctx.bql, res: event.data },
  };
};

const updateTQLMutation = (ctx: TypeDbMachineContext, event: any) => {
  return {
    ...ctx,
    tql: {
      ...ctx.tql,
      mutation: event.data,
    },
  };
};

const updateTQLRes = (ctx: TypeDbMachineContext, event: any) => {
  return {
    ...ctx,
    tql: {
      ...ctx.tql,
      res: event.data,
    },
  };
};

const errorTransition = transition(
  'error',
  'error',
  reduce((ctx: TypeDbMachineContext, event: any): TypeDbMachineContext => {
    return {
      ...ctx,
      error: event.error,
    };
  }),
);

export const typeDbMutationMachine = createMachine(
  'buildMutation',
  {
    buildMutation: invoke(
      async (ctx: TypeDbMachineContext) => buildTQLMutation(ctx.bql.things, ctx.bql.edges, ctx.schema),
      transition('done', 'runMutation', reduce(updateTQLMutation)),
      errorTransition,
    ),
    runMutation: invoke(
      async (ctx: TypeDbMachineContext) => runTQLMutation(ctx.tql.mutation as TqlMutation, ctx.handles, ctx.config),
      transition('done', 'parseMutation', reduce(updateTQLRes)),
      errorTransition,
    ),
    parseMutation: invoke(
      async (ctx: TypeDbMachineContext) =>
        parseTQLMutation(ctx.tql.res, ctx.bql.things, ctx.bql.edges, ctx.schema, ctx.config),
      transition('done', 'success', reduce(updateBqlRes)),
      errorTransition,
    ),
    success: state(),
    error: state(),
  },
  (ctx: TypeDbMachineContext) => ctx,
);

const awaitMutationMachine = async (context: TypeDbMachineContext) => {
  return new Promise<any[]>((resolve, reject) => {
    interpret(
      typeDbMutationMachine,
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

export const runTypeDbMutationMachine = async (
  bqRaw: BQLMutationBlock | BQLMutationBlock[],
  enrichedBql: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
  things: unknown[],
  edges: unknown[],
  schema: EnrichedBormSchema,
  config: BormConfig,
  handles: DBHandles,
) => {
  return awaitMutationMachine({
    bql: {
      raw: bqRaw,
      enriched: enrichedBql,
      things: things, //to unify at some point with the flat notation
      edges: edges,
      flat: {
        //this is the new version, used for surrealDB
        things: [],
        edges: [],
        arcs: [],
        references: [],
      },
      res: [],
    },
    tql: {},
    schema: schema,
    config: config,
    handles: handles,
    error: null,
  });
};
