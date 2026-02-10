import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

type ReconnectConfig = {
  attempts: number;
  retryDelay: number;
  retryDelayMax: number;
};

export type SurrealClientOptions = {
  queryTimeoutMs?: number;
  reconnect?: Partial<ReconnectConfig>;
};

const DEFAULT_QUERY_TIMEOUT_MS = 300_000;

const DEFAULT_RECONNECT: ReconnectConfig = {
  attempts: -1,
  retryDelay: 1000,
  retryDelayMax: 60000,
};

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export class SurrealClient {
  readonly #db = new Surreal();
  readonly #config: ConnectionConfig;
  readonly #queryTimeoutMs: number;
  readonly #reconnect: ReconnectConfig;

  #connecting: Promise<void> | null = null;
  #closed = false;

  constructor(config: ConnectionConfig, options: SurrealClientOptions = {}) {
    this.#config = config;
    this.#queryTimeoutMs = options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
    this.#reconnect = { ...DEFAULT_RECONNECT, ...options.reconnect };
  }

  async connect(): Promise<void> {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    if (this.#db.status === ConnectionStatus.Connected) {
      return;
    }
    if (this.#connecting) {
      return this.#connecting;
    }

    const { url, namespace, database, username, password } = this.#config;

    this.#connecting = this.#db
      .connect(url, {
        namespace,
        database,
        auth: { username, password },
        versionCheck: false,
        reconnect: {
          enabled: true,
          ...this.#reconnect,
          retryDelayMultiplier: 2,
          retryDelayJitter: 0.1,
        },
      })
      .then(() => undefined)
      .finally(() => {
        this.#connecting = null;
      });

    return this.#connecting;
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#db.close().catch(() => undefined);
  }

  async query<T>(...args: QueryParameters): Promise<T[]> {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    return withTimeout(this.#db.query<T[]>(...args), this.#queryTimeoutMs, 'Query timeout');
  }

  async queryRaw(...args: QueryParameters) {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    return withTimeout(this.#db.queryRaw(...args), this.#queryTimeoutMs, 'Query timeout');
  }

  get status(): ConnectionStatus {
    return this.#db.status;
  }
}
