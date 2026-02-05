import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

const CONNECTION_ERRORS = ['NoActiveSocket', 'EngineDisconnected', 'ConnectionUnavailable', 'HttpConnectionError'];

const isConnectionError = (error: unknown): boolean => error instanceof Error && CONNECTION_ERRORS.includes(error.name);

/**
 * Thin wrapper over the official SurrealDB SDK.
 * Handles auto-connect and stale connection recovery.
 */
export class SurrealClient {
  readonly #db = new Surreal();
  readonly #config: ConnectionConfig;
  #connecting: Promise<void> | null = null;

  constructor(config: ConnectionConfig) {
    this.#config = config;
  }

  async connect(): Promise<void> {
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
      .then(() => {});

    try {
      await this.#connecting;
    } finally {
      this.#connecting = null;
    }
  }

  async close(): Promise<void> {
    await this.#db.close();
  }

  async #withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#db.status !== ConnectionStatus.Connected) {
      await this.connect();
    }
    try {
      return await fn();
    } catch (error) {
      if (!isConnectionError(error)) {
        throw error;
      }
      await this.#db.close().catch(() => {});
      this.#connecting = null;
      await this.connect();
      return fn();
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
