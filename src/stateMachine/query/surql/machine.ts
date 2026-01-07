import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { assertDefined } from '../../../helpers';
import { logDebug } from '../../../logger';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../../robot3';
import type { BormConfig, EnrichedBormSchema, EnrichedBQLQuery, RawBQLQuery } from '../../../types';
import type { SurrealDBProviderObject } from '../../../types/config/surrealdb';
import { VERSION } from '../../../version';
import { cleanQueryRes } from '../bql/clean';
import { enrichBQLQuery } from '../bql/enrich';
import { postHooks } from '../postHook';
import { build } from './build';
import { buildRefs } from './buildRefs';
import { parse } from './parse';
import { run } from './run';

export type SurrealDbMachineContext = {
  bql: {
    raw: RawBQLQuery[];
    queries?: EnrichedBQLQuery[];
    res?: any[];
  };
  surql: {
    queries?: string[];
    res?: any[];
  };
  schema: EnrichedBormSchema;
  config: BormConfig;
  client: SimpleSurrealClient;
  error?: string | null;
};

const updateBqlReq = (ctx: SurrealDbMachineContext, event: any) => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    bql: { ...ctx.bql, queries: event.data },
  };
};

const updateBqlRes = (ctx: SurrealDbMachineContext, event: any) => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    bql: { ...ctx.bql, res: event.data },
  };
};

const errorTransition = transition(
  'error',
  'error',
  reduce((ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => {
    return {
      ...ctx,
      error: event.error,
    };
  }),
);

const surrealDbQueryMachine = createMachine(
  'enrich',
  {
    enrich: invoke(
      async (ctx: SurrealDbMachineContext) => {
        logDebug(`originalBQLQuery[${VERSION}]`, JSON.stringify(ctx.bql.raw));
        return enrichBQLQuery(ctx.bql.raw, ctx.schema);
      },
      transition('done', 'build', reduce(updateBqlReq)),
      errorTransition,
    ),
    build: invoke(
      async (ctx: SurrealDbMachineContext) => {
        // todo: This works only if there is a single surrealDB connector
        const { linkMode } = (
          ctx.config.dbConnectors.find((c) => c.provider === 'surrealDB') as SurrealDBProviderObject
        ).providerConfig;
        if (linkMode === 'edges') {
          return build({ queries: ctx.bql.queries ?? [], schema: ctx.schema });
        }
        if (linkMode === 'refs') {
          return buildRefs({ queries: ctx.bql.queries ?? [], schema: ctx.schema });
        }
      },
      transition(
        'done',
        'run',
        reduce(
          (ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => ({
            ...ctx,
            surql: {
              ...ctx.surql,
              queries: event.data,
            },
          }),
        ),
      ),
      errorTransition,
    ),
    run: invoke(
      async (ctx: SurrealDbMachineContext) => {
        return run({ client: ctx.client, queries: assertDefined(ctx.surql.queries), config: ctx.config });
      },
      transition(
        'done',
        'parse',
        reduce(
          (ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => ({
            ...ctx,
            surql: {
              ...ctx.surql,
              res: event.data,
            },
          }),
        ),
      ),
      errorTransition,
    ),
    parse: invoke(
      async (ctx: SurrealDbMachineContext) => {
        return parse({
          res: assertDefined(ctx.surql.res),
          queries: ctx.bql.queries ?? [],
          schema: ctx.schema,
          config: ctx.config,
        });
      },
      transition(
        'done',
        'postHooks',
        reduce(
          (ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => ({
            ...ctx,
            bql: {
              ...ctx.bql,
              res: event.data,
            },
          }),
        ),
      ),
      errorTransition,
    ),
    postHooks: invoke(
      async (ctx: SurrealDbMachineContext) =>
        postHooks(ctx.schema, assertDefined(ctx.bql.queries), assertDefined(ctx.bql.res)),
      transition('done', 'clean', reduce(updateBqlRes)),
      errorTransition,
    ),
    clean: invoke(
      async (ctx: SurrealDbMachineContext) => cleanQueryRes(ctx.config, assertDefined(ctx.bql.res)),
      transition('done', 'success', reduce(updateBqlRes)),
      errorTransition,
    ),
    success: state(),
    error: state(),
  },
  (ctx: SurrealDbMachineContext) => ctx,
);

const awaitQueryMachine = async (context: SurrealDbMachineContext) => {
  return new Promise<any[]>((resolve, reject) => {
    interpret(
      surrealDbQueryMachine,
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

export const runSurrealDbQueryMachine = async (
  bql: RawBQLQuery[],
  schema: EnrichedBormSchema,
  config: BormConfig,
  client: SimpleSurrealClient,
) => {
  return awaitQueryMachine({
    bql: { raw: bql },
    surql: {},
    schema: schema,
    config: config,
    client,
    error: null,
  });
};
