import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

const CONNECTION_ERRORS = [
  'NoActiveSocket',
  'NoConnectionDetails',
  'EngineDisconnected',
  'ReconnectFailed',
  'ReconnectIterationError',
  'UnexpectedConnectionError',
  'ConnectionUnavailable',
  'HttpConnectionError',
] as const;

const QUERY_TIMEOUT_MS = 180_000;
const CLIENT_CLOSED_ERROR = 'Client has been closed';

const isConnectionError = (error: unknown): boolean =>
  error instanceof Error && CONNECTION_ERRORS.includes(error.name as (typeof CONNECTION_ERRORS)[number]);

/**
 * Thin wrapper over the official SurrealDB SDK.
 * Handles auto-connect, stale connection recovery, and query timeouts.
 */
export class SurrealClient {
  readonly #db = new Surreal();
  readonly #config: ConnectionConfig;
  #connecting: Promise<void> | null = null;
  #closed = false;

  constructor(config: ConnectionConfig) {
    this.#config = config;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error(CLIENT_CLOSED_ERROR);
    }
  }

  async connect(): Promise<void> {
    this.#assertOpen();
    if (this.#db.status === ConnectionStatus.Connected) {
      return;
    }
    if (this.#connecting) {
      return this.#connecting;
    }

    this.#connecting = this.#db
      .connect(this.#config.url, {
        namespace: this.#config.namespace,
        database: this.#config.database,
        auth: { username: this.#config.username, password: this.#config.password },
        versionCheck: false,
      })
      .then(() => {})
      .finally(() => {
        this.#connecting = null;
      });

    return this.#connecting;
  }

  async close(): Promise<void> {
    this.#closed = true;
    await this.#db.close();
  }

  async #reconnect(): Promise<void> {
    await this.#db.close().catch(() => {});
    await this.connect();
  }

  async #withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS);
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  async #withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    this.#assertOpen();
    if (this.#db.status !== ConnectionStatus.Connected) {
      await this.connect();
    }
    try {
      return await this.#withTimeout(fn);
    } catch (error) {
      if (!isConnectionError(error)) {
        throw error;
      }
      await this.#reconnect();
      return this.#withTimeout(fn);
    }
  }

  async query<T>(...args: QueryParameters): Promise<T[]> {
    return this.#withReconnect(() => this.#db.query<T[]>(...args));
  }

  async queryRaw(...args: QueryParameters) {
    return this.#withReconnect(() => this.#db.queryRaw(...args));
  }

  get status(): ConnectionStatus {
    return this.#db.status;
  }
}
