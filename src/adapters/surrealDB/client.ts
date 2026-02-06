import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

const CONNECTION_ERROR_NAMES = new Set([
  'NoActiveSocket',
  'NoConnectionDetails',
  'EngineDisconnected',
  'ReconnectFailed',
  'ReconnectIterationError',
  'UnexpectedConnectionError',
  'ConnectionUnavailable',
  'HttpConnectionError',
]);

const QUERY_TIMEOUT_MS = 180_000;
const PING_TIMEOUT_MS = 3_000;
const ERR_CLIENT_CLOSED = 'Client has been closed';
const ERR_QUERY_TIMEOUT = 'Query timeout';

const hasErrorName = (error: unknown, names: Set<string>): boolean => error instanceof Error && names.has(error.name);

const hasErrorMessage = (error: unknown, message: string): boolean =>
  error instanceof Error && error.message === message;

const withTimeout = <T>(promise: Promise<T>, ms: number, message = ERR_QUERY_TIMEOUT): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);

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

  async connect(): Promise<void> {
    if (this.#closed) {
      throw new Error(ERR_CLIENT_CLOSED);
    }
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
      .then(() => undefined)
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
    await this.#db.close().catch(() => undefined);
    await this.connect();
  }

  async #isAlive(): Promise<boolean> {
    if (this.#db.status !== ConnectionStatus.Connected) {
      return false;
    }
    return withTimeout(this.#db.ping(), PING_TIMEOUT_MS)
      .then(() => true)
      .catch(() => false);
  }

  async #withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#closed) {
      throw new Error(ERR_CLIENT_CLOSED);
    }
    if (this.#db.status !== ConnectionStatus.Connected) {
      await this.connect();
    }

    try {
      return await withTimeout(fn(), QUERY_TIMEOUT_MS);
    } catch (error) {
      if (hasErrorName(error, CONNECTION_ERROR_NAMES)) {
        await this.#reconnect();
        return withTimeout(fn(), QUERY_TIMEOUT_MS);
      }
      if (hasErrorMessage(error, ERR_QUERY_TIMEOUT) && !(await this.#isAlive())) {
        await this.#reconnect();
      }
      throw error;
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
