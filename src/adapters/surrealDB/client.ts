import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

/** Errors that indicate a broken connection (status may still show "Connected") */
const CONNECTION_ERRORS = [
  'NoActiveSocket',
  'EngineDisconnected',
  'ConnectionUnavailable',
  'HttpConnectionError',
];

const isConnectionError = (error: unknown): boolean =>
  error instanceof Error && CONNECTION_ERRORS.includes(error.name);

/**
 * Thin wrapper over the official SurrealDB SDK.
 * Delegates connection management, multiplexing, and reconnection to the SDK.
 * Handles stale connections (e.g., after wifi disconnect or laptop sleep).
 */
export class SurrealClient {
  readonly #db = new Surreal();
  readonly #config: ConnectionConfig;
  #connecting: Promise<void> | null = null;

  constructor(config: ConnectionConfig) {
    this.#config = config;
  }

  async connect(): Promise<void> {
    if (this.#db.status === ConnectionStatus.Connected) return;
    if (this.#connecting) return this.#connecting;

    this.#connecting = this.#doConnect();
    try {
      await this.#connecting;
    } finally {
      this.#connecting = null;
    }
  }

  async #doConnect(): Promise<void> {
    await this.#db.connect(this.#config.url, {
      namespace: this.#config.namespace,
      database: this.#config.database,
      auth: { username: this.#config.username, password: this.#config.password },
      versionCheck: false,
    });
  }

  async #reconnect(): Promise<void> {
    try {
      await this.#db.close();
    } catch {
      // Ignore close errors on stale connection
    }
    this.#connecting = null;
    await this.connect();
  }

  async close(): Promise<void> {
    await this.#db.close();
  }

  async query<T>(...args: QueryParameters): Promise<T[]> {
    if (this.#db.status !== ConnectionStatus.Connected) await this.connect();
    try {
      return await this.#db.query<T[]>(...args);
    } catch (error) {
      if (isConnectionError(error)) {
        await this.#reconnect();
        return this.#db.query<T[]>(...args);
      }
      throw error;
    }
  }

  async queryRaw(...args: QueryParameters) {
    if (this.#db.status !== ConnectionStatus.Connected) await this.connect();
    try {
      return await this.#db.queryRaw(...args);
    } catch (error) {
      if (isConnectionError(error)) {
        await this.#reconnect();
        return this.#db.queryRaw(...args);
      }
      throw error;
    }
  }

  get status(): ConnectionStatus {
    return this.#db.status;
  }
}
