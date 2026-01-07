import { assertDefined } from '../../../helpers';
import { logDebug } from '../../../logger';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../../robot3';
import type { BormConfig, DBHandles, EnrichedBormSchema, EnrichedBQLQuery, RawBQLQuery } from '../../../types';
import { VERSION } from '../../../version';
import { cleanQueryRes } from '../bql/clean';
import { enrichBQLQuery } from '../bql/enrich';
import { postHooks } from '../postHook';
import { buildTQLQuery } from './build';
import { parseTQLQuery } from './parse';
import { runTQLQuery } from './run';

export type TypeDbMachineContext = {
  bql: {
    raw: RawBQLQuery[];
    queries?: EnrichedBQLQuery[];
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

const updateBqlReq = (ctx: TypeDbMachineContext, event: any) => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    bql: { ...ctx.bql, queries: event.data },
  };
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
  'enrich',
  {
    enrich: invoke(
      async (ctx: TypeDbMachineContext) => {
        logDebug(`originalBQLQuery[${VERSION}]`, JSON.stringify(ctx.bql.raw));
        return enrichBQLQuery(ctx.bql.raw, ctx.schema);
      },
      transition('done', 'build', reduce(updateBqlReq)),
      errorTransition,
    ),
    build: invoke(
      async (ctx: TypeDbMachineContext) => buildTQLQuery({ queries: ctx.bql.queries ?? [], schema: ctx.schema }),
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
          enrichedBqlQuery: ctx.bql.queries ?? [],
          schema: ctx.schema,
          config: ctx.config,
          rawTqlRes: assertDefined(ctx.tql.res),
        }),
      transition('done', 'postHooks', reduce(updateBqlRes)),
      errorTransition,
    ),
    postHooks: invoke(
      async (ctx: TypeDbMachineContext) =>
        postHooks(ctx.schema, assertDefined(ctx.bql.queries), assertDefined(ctx.bql.res)),
      transition('done', 'clean', reduce(updateBqlRes)),
      errorTransition,
    ),
    clean: invoke(
      async (ctx: TypeDbMachineContext) => cleanQueryRes(ctx.config, assertDefined(ctx.bql.res)),
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
  schema: EnrichedBormSchema,
  config: BormConfig,
  handles: DBHandles,
) => {
  return awaitQueryMachine({
    bql: { raw: bql },
    tql: {},
    schema: schema,
    config: config,
    handles: handles,
    error: null,
  });
};
