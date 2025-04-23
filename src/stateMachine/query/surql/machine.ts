import type { SimpleSurrealClient } from '../../../adapters/surrealDB/client';
import { assertDefined } from '../../../helpers';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../../robot3';
import type { BormConfig, EnrichedBQLQuery, EnrichedBormSchema } from '../../../types';
import type { SurrealDBProviderObject } from '../../../types/config/surrealdb';
import { build } from './build';
import { buildRefs } from './buildRefs';
import { parse } from './parse';
import { run } from './run';

export type SurrealDbMachineContext = {
  bql: {
    queries: EnrichedBQLQuery[];
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
  'build',
  {
    build: invoke(
      async (ctx: SurrealDbMachineContext) => {
        // todo: This works only if there is a single surrealDB connector
        const { linkMode } = (
          ctx.config.dbConnectors.find((c) => c.provider === 'surrealDB') as SurrealDBProviderObject
        ).providerConfig;
        if (linkMode === 'edges') {
          return build({ queries: ctx.bql.queries, schema: ctx.schema });
        }
        if (linkMode === 'refs') {
          return buildRefs({ queries: ctx.bql.queries, schema: ctx.schema });
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
          queries: ctx.bql.queries,
          schema: ctx.schema,
          config: ctx.config,
        });
      },
      transition(
        'done',
        'success',
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
  enrichedBql: EnrichedBQLQuery[],
  schema: EnrichedBormSchema,
  config: BormConfig,
  client: SimpleSurrealClient,
) => {
  return awaitQueryMachine({
    bql: {
      queries: enrichedBql,
    },
    surql: {},
    schema: schema,
    config: config,
    client,
    error: null,
  });
};
