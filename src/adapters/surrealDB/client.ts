import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

/**
 * Thin wrapper over the official SurrealDB SDK.
 * Delegates connection management, multiplexing, and reconnection to the SDK.
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

  async close(): Promise<void> {
    await this.#db.close();
  }

  async query<T>(...args: QueryParameters): Promise<T[]> {
    if (this.#db.status !== ConnectionStatus.Connected) await this.connect();
    return this.#db.query<T[]>(...args);
  }

  async queryRaw(...args: QueryParameters) {
    if (this.#db.status !== ConnectionStatus.Connected) await this.connect();
    return this.#db.queryRaw(...args);
  }

  get status(): ConnectionStatus {
    return this.#db.status;
  }
}
