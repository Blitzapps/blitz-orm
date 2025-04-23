import { assertDefined } from '../../../helpers';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../../robot3';
import type { BormConfig, DBHandles, EnrichedBQLQuery, EnrichedBormSchema, RawBQLQuery } from '../../../types';
import { buildTQLQuery } from './build';
import { parseTQLQuery } from './parse';
import { runTQLQuery } from './run';

export type TypeDbMachineContext = {
  bql: {
    raw: RawBQLQuery[];
    queries: EnrichedBQLQuery[];
    res?: any[];
  };
  tql: {
    queries?: string[];
    res?: any[];
  };
  schema: EnrichedBormSchema;
  config: BormConfig;
  handles: DBHandles;
  error?: string | null;
};

const updateBqlRes = (ctx: TypeDbMachineContext, event: any): TypeDbMachineContext => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    bql: { ...ctx.bql, res: event.data },
  };
};

const updateTqlReq = (ctx: TypeDbMachineContext, event: any): TypeDbMachineContext => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    tql: { ...ctx.tql, queries: event.data },
  };
};

const updateTqlRes = (ctx: TypeDbMachineContext, event: any): TypeDbMachineContext => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    tql: { ...ctx.tql, res: event.data },
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

export const typeDbQueryMachine = createMachine(
  'build',
  {
    build: invoke(
      async (ctx: TypeDbMachineContext) => buildTQLQuery({ queries: ctx.bql.queries, schema: ctx.schema }),
      transition('done', 'run', reduce(updateTqlReq)),
      errorTransition,
    ),
    run: invoke(
      async (ctx: TypeDbMachineContext) => {
        return runTQLQuery({
          dbHandles: ctx.handles,
          tqlRequest: assertDefined(ctx.tql.queries),
          config: ctx.config,
        });
      },
      transition('done', 'parse', reduce(updateTqlRes)),
      errorTransition,
    ),
    parse: invoke(
      async (ctx: TypeDbMachineContext) =>
        parseTQLQuery({
          rawBqlRequest: ctx.bql.raw,
          enrichedBqlQuery: ctx.bql.queries,
          schema: ctx.schema,
          config: ctx.config,
          rawTqlRes: assertDefined(ctx.tql.res),
        }),
      transition('done', 'success', reduce(updateBqlRes)),
      errorTransition,
    ),
    success: state(),
    error: state(),
  },
  (ctx: TypeDbMachineContext) => ctx,
);

const awaitQueryMachine = async (context: TypeDbMachineContext) => {
  return new Promise<any[]>((resolve, reject) => {
    interpret(
      typeDbQueryMachine,
      (service) => {
        if (service.machine.state.name === 'success') {
          //@ts-expect-error = todo
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

export const runTypeDbQueryMachine = async (
  bql: RawBQLQuery[],
  enrichedBql: EnrichedBQLQuery[],
  schema: EnrichedBormSchema,
  config: BormConfig,
  handles: DBHandles,
) => {
  return awaitQueryMachine({
    bql: {
      raw: bql,
      queries: enrichedBql,
    },
    tql: {},
    schema: schema,
    config: config,
    handles: handles,
    error: null,
  });
};
