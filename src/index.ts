import { enableMapSet } from 'immer';
import { tryit } from 'radash';
import { SessionType, TypeDB, TypeDBCredential } from 'typedb-driver';
import { SimpleSurrealClient } from './adapters/surrealDB/client';
import { defaultConfig } from './default.config';
import { bormDefine } from './define';
import { enrichSchema } from './enrichSchema';
import { runMutationMachine } from './stateMachine/mutation/mutationMachine';
import { runQueryMachine } from './stateMachine/query/queryMachine';
import type {
  AllDbHandles,
  BormConfig,
  BormSchema,
  BQLMutation,
  BQLResponse,
  BQLResponseMulti,
  DBHandles,
  EnrichedBormSchema,
  MutationConfig,
  QueryConfig,
  RawBQLQuery,
} from './types';

export * from './types';

type BormProps = {
  schema: BormSchema;
  config: BormConfig;
};

/// Global config
// immer
enableMapSet();

class BormClient {
  private schema: BormSchema;
  private config: BormConfig;
  private initializing = false;
  private subscribers: ((err?: unknown) => void)[] = [];
  private initialized: { enrichedSchema: EnrichedBormSchema; dbHandles: DBHandles } | null = null;

  constructor({ schema, config }: BormProps) {
    this.schema = schema;
    this.config = config;
  }

  getDbHandles = () => this.initialized?.dbHandles;

  private getInitialized = async () => {
    if (this.initialized) {
      return this.initialized;
    }
    await this.init();
    if (this.initialized) {
      return this.initialized;
    }
    throw new Error('Client is not initialized');
  };

  init = async () => {
    if (this.initializing) {
      return new Promise<void>((resolve, reject) => {
        this.subscribers.push((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    this.initializing = true;
    const dbHandles: AllDbHandles = { typeDB: new Map(), surrealDB: new Map() };

    try {
      await Promise.all(
        this.config.dbConnectors.map(async (dbc) => {
          if (dbc.provider === 'surrealDB') {
            const client = new SimpleSurrealClient({
              url: dbc.url,
              username: dbc.username,
              password: dbc.password,
              namespace: dbc.namespace,
              database: dbc.dbName,
            });
            // const pool = new SurrealPool({
            // 	url: dbc.url,
            // 	username: dbc.username,
            // 	password: dbc.password,
            // 	namespace: dbc.namespace,
            // 	database: dbc.dbName,
            // 	totalConnections: 8,
            // });
            dbHandles.surrealDB.set(dbc.id, { client, providerConfig: dbc.providerConfig });
          } else if (dbc.provider === 'typeDB' && dbc.dbName) {
            // const client = await TypeDB.coreClient(dbc.url);
            // const clientErr = undefined;
            const [clientErr, client] = await tryit(TypeDB.coreDriver)(dbc.url);
            if (clientErr) {
              const message = `[BORM:${dbc.provider}:${dbc.dbName}:core] ${
                // clientErr.messageTemplate?._messageBody() ?? "Can't create TypeDB Client"
                clientErr.message ?? "Can't create TypeDB Client"
              }`;
              throw new Error(message);
            }
            try {
              const session = await client.session(dbc.dbName, SessionType.DATA);
              dbHandles.typeDB.set(dbc.id, { client, session });
            } catch (sessionErr: any) {
              const message = `[BORM:${dbc.provider}:${dbc.dbName}:session] ${
                // eslint-disable-next-line no-underscore-dangle
                (sessionErr.messageTemplate?._messageBody() || sessionErr.message) ?? "Can't create TypeDB Session"
              }`;
              throw new Error(message);
            }
          } else if (dbc.provider === 'typeDBCluster' && dbc.dbName) {
            const credential = new TypeDBCredential(dbc.username, dbc.password, dbc.tlsRootCAPath);
            const [clientErr, client] = await tryit(TypeDB.cloudDriver)(dbc.addresses, credential);

            if (clientErr) {
              const message = `[BORM:${dbc.provider}:${dbc.dbName}:core] ${
                // clientErr.messageTemplate?._messageBody() ?? "Can't create TypeDB Client"
                clientErr.message ?? "Can't create TypeDB Cluster Client"
              }`;
              throw new Error(message);
            }
            try {
              const session = await client.session(dbc.dbName, SessionType.DATA);
              dbHandles.typeDB.set(dbc.id, { client, session });
            } catch (sessionErr: any) {
              const message = `[BORM:${dbc.provider}:${dbc.dbName}:session] ${
                // eslint-disable-next-line no-underscore-dangle
                (sessionErr.messageTemplate?._messageBody() || sessionErr.message) ?? "Can't create TypeDB Session"
              }`;
              throw new Error(message);
            }
          }
        }),
      );

      this.initialized = {
        enrichedSchema: enrichSchema(this.schema, dbHandles),
        dbHandles,
      };
      const subscribers = this.subscribers;
      this.subscribers = [];
      for (const s of subscribers) {
        s();
      }
    } catch (e) {
      const subscribers = this.subscribers;
      this.subscribers = [];
      for (const s of subscribers) {
        s(e);
      }
    } finally {
      this.initializing = false;
    }
  };

  introspect = async () => {
    return (await this.getInitialized()).enrichedSchema;
  };

  define = async () => {
    const initialized = await this.getInitialized();
    const schemas = await bormDefine(this.config, initialized.enrichedSchema, initialized.dbHandles);
    return schemas;
  };

  /// no types yet, but we can do "as ..." after getting the type fro the schema
  // query = async (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => {
  // 	const handles = this.dbHandles;
  // 	if (!handles) {
  // 		throw new Error('dbHandles undefined');
  // 	}

  // 	await this.#enforceConnection();

  // 	const qConfig = {
  // 		...this.config,
  // 		query: { ...defaultConfig.query, ...this.config.query, ...queryConfig },
  // 	};

  // 	// @ts-expect-error type of Query is incorrect
  // 	return queryPipeline(query, qConfig, this.schema, handles);
  // };

  query = async (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => {
    const initialized = await this.getInitialized();

    const qConfig = {
      ...this.config,
      query: {
        ...defaultConfig.query,
        ...this.config.query,
        ...queryConfig,
      },
    };
    const isBatched = Array.isArray(query);
    const queries = isBatched ? query : [query];

    const [errorRes, res] = await tryit(runQueryMachine)(
      queries,
      initialized.enrichedSchema,
      qConfig,
      initialized.dbHandles,
    );
    if (errorRes) {
      //@ts-expect-error - errorRes has error. Also no idea where the error: comes from
      const error = new Error(errorRes.error);
      //@ts-expect-error - errorRes has error. Also no idea where the error: comes from
      error.stack = errorRes.error.stack;
      throw error;
    }

    const result = res.bql.res as BQLResponse[];

    return isBatched ? result : result[0];
  };

  mutate = async (mutation: BQLMutation, mutationConfig?: MutationConfig) => {
    const initialized = await this.getInitialized();
    const mConfig = {
      ...this.config,
      mutation: {
        ...defaultConfig.mutation,
        ...this.config.mutation,
        ...mutationConfig,
      },
    };

    const [errorRes, res] = await tryit(runMutationMachine)(
      mutation,
      initialized.enrichedSchema,
      mConfig,
      initialized.dbHandles,
    );
    if (errorRes) {
      //@ts-expect-error - errorRes has error. Also no idea where the error: comes from
      const error = new Error(errorRes.error.message);
      //@ts-expect-error - errorRes has error. Also no idea where the error: comes from
      error.stack = errorRes.error.stack;
      throw error;
    }

    const result = res.bql.res;

    return result as BQLResponseMulti;
  };

  close = async () => {
    if (!this.initialized) {
      return;
    }
    //todo: probably migrate dbHandles to be an array, where each handle has .type="typeDB" for instance
    try {
      await Promise.all(
        [...(this.initialized.dbHandles.typeDB?.values() ?? [])].map(async ({ client, session }) => {
          if (session.isOpen()) {
            await session.close();
          }
          await client.close();
        }),
      );
      // TODO: Close SurrealDB clients.
    } finally {
      this.initialized = null;
    }
    // Currently there's no `close()` method in the client.
    // See https://github.com/surrealdb/surrealdb.node/issues/36
  };
}

export default BormClient;
