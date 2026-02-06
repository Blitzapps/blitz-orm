import type { TypeDBDriver } from 'typedb-driver';
import type { SurrealClient } from '../../adapters/surrealDB/client';
import { getSchemaByThing } from '../../helpers';
import { logDebug } from '../../logger';
import { createMachine, interpret, invoke, reduce, state, transition } from '../../robot3';
import type { BormConfig, DBHandles, EnrichedBormSchema, RawBQLQuery } from '../../types';
import type { DRAFT_EnrichedBormSchema } from '../../types/schema/enriched.draft';
import { VERSION } from '../../version';
import { enrichBQLQuery } from './bql/enrich';
import { runSurrealDbQueryMachine } from './surql/machine';
import { runSurrealDbQueryMachine2 } from './surql2/run';
import { runTypeDbQueryMachine } from './tql/machine';

type MachineContext = {
  bql: {
    raw: RawBQLQuery[];
    res?: any[]; // TODO
  };
  schema: EnrichedBormSchema;
  draftSchema: DRAFT_EnrichedBormSchema;
  config: BormConfig;
  handles: DBHandles;
  error: string | null;
};

const updateBqlReq = (ctx: MachineContext, event: any) => {
  if (!event.data) {
    return ctx;
  }
  return {
    ...ctx,
    bql: { ...ctx.bql, queries: event.data },
  };
};

const updateBqlRes = (ctx: MachineContext, event: any) => {
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
  reduce((ctx: MachineContext, event: any) => {
    return {
      ...ctx,
      error: event.error,
    };
  }),
);

type TypeDBAdapter = {
  db: 'typeDB';
  client: TypeDBDriver;
  rawBql: RawBQLQuery[];
  indices: number[];
};

type SurrealDBAdapter = {
  db: 'surrealDB';
  client: SurrealClient;
  rawBql: RawBQLQuery[];
  indices: number[];
};

type Adapter = TypeDBAdapter | SurrealDBAdapter;

export const queryMachine = createMachine(
  'enrich',
  {
    enrich: invoke(
      async (ctx: MachineContext) => {
        logDebug(`originalBQLQuery[${VERSION}]`, JSON.stringify(ctx.bql.raw));
        return enrichBQLQuery(ctx.bql.raw, ctx.schema);
      },
      transition('done', 'adapter', reduce(updateBqlReq)),
      errorTransition,
    ),
    adapter: invoke(
      async (ctx: MachineContext) => {
        const adapters: Record<string, Adapter> = {};

        ctx.bql.raw?.forEach((q, i) => {
          const raw = ctx.bql.raw[i];
          const $thing =
            '$thing' in q ? q.$thing : '$entity' in q ? q.$entity : '$relation' in q ? q.$relation : undefined;
          if (!$thing) {
            throw new Error(`No $thing found in query ${JSON.stringify(q, null, 2)}`);
          }
          const thing = getSchemaByThing(ctx.schema, $thing);
          const { id } = thing.defaultDBConnector;

          if (thing.db === 'typeDB') {
            if (!adapters[id]) {
              const client = ctx.handles.typeDB?.get(id)?.client;
              if (!client) {
                throw new Error(`TypeDB client with id "${thing.defaultDBConnector.id}" does not exist`);
              }
              adapters[id] = {
                db: 'typeDB',
                client,
                rawBql: [],
                indices: [],
              };
            }
          } else if (thing.db === 'surrealDB') {
            if (!adapters[id]) {
              const client = ctx.handles.surrealDB?.get(id)?.client;
              if (!client) {
                throw new Error(`SurrealDB client with id "${thing.defaultDBConnector.id}" does not exist`);
              }
              adapters[id] = {
                db: 'surrealDB',
                client,
                rawBql: [],
                indices: [],
              };
            }
          } else {
            throw new Error(`Unsupported DB "${thing.db}"`);
          }
          const adapter = adapters[id];
          adapter.rawBql.push(raw);
          adapter.indices.push(i);
        });
        const adapterList = Object.values(adapters);
        const proms = adapterList.map((a) => {
          if (a.db === 'typeDB') {
            // TODO: Replace DBHandles with TypeDBAdapter
            return runTypeDbQueryMachine(a.rawBql, ctx.schema, ctx.config, ctx.handles);
          }

          if (a.db === 'surrealDB') {
            if (ctx.config.query?.legacySurrealDBAdapter) {
              return runSurrealDbQueryMachine(a.rawBql, ctx.schema, ctx.config, a.client);
            }
            return runSurrealDbQueryMachine2(a.rawBql, ctx.draftSchema, ctx.config, a.client);
          }

          throw new Error(`Unsupported DB "${JSON.stringify(a, null, 2)}"`);
        });
        const results = await Promise.all(proms);
        const orderedResults = adapterList.flatMap((a, i) => {
          const result = results[i];
          return a.indices.map((index, j) => ({ index, result: result[j] }));
        });
        orderedResults.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
        const result = orderedResults.map(({ result }) => result);
        return result;
      },
      transition('done', 'success', reduce(updateBqlRes)),
      errorTransition,
    ),
    success: state(),
    error: state(),
  },
  (ctx: MachineContext) => ctx,
);

export const awaitQueryMachine = async (context: MachineContext) => {
  return new Promise<MachineContext>((resolve, reject) => {
    interpret(
      queryMachine,
      (service) => {
        if (service.machine.state.name === 'success') {
          resolve(service.context);
        }
        if (service.machine.state.name === 'error') {
          reject(service.context);
        }
      },
      context,
    );
  });
};

export const runQueryMachine = async (
  bql: RawBQLQuery[],
  schema: EnrichedBormSchema,
  draftSchema: DRAFT_EnrichedBormSchema,
  config: BormConfig,
  handles: DBHandles,
) => {
  return awaitQueryMachine({
    bql: {
      raw: bql,
    },
    schema: schema,
    draftSchema,
    config: config,
    handles: handles,
    error: null,
  });
};
