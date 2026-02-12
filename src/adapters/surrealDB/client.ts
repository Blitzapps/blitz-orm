import type { QueryParameters } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';
import { log } from '../../logger';

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

const TAG = 'SurrealClient';

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const isTokenError = (error: unknown): boolean =>
  error instanceof Error && (error.message.includes('token has expired') || error.message.includes('token is invalid'));

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

    log([TAG, 'info'], 'Connecting to SurrealDB', { url, namespace, database });

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
        // WS reconnect: The SDK re-authenticates with the stored JWT which may have
        // expired. This prepare callback runs on every (re)connection, calling signin()
        // to obtain a fresh token before the SDK's own authenticate() step.
        prepare: async (auth) => {
          log([TAG, 'info'], 'prepare: refreshing token via signin()');
          await auth.signin({ username, password });
        },
      })
      .then(() => {
        log([TAG, 'info'], 'Connected to SurrealDB');
      })
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

  /**
   * Execute a query with token-expiry recovery.
   * HTTP: the SDK sends the stored (possibly expired) token on every request with no
   * built-in retry. On token error we call signin() to refresh it, then retry.
   */
  async #withTokenRecovery<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await withTimeout(fn(), this.#queryTimeoutMs, 'Query timeout');
    } catch (error) {
      if (!isTokenError(error)) {
        throw error;
      }
      log([TAG, 'info'], 'Token expired, refreshing via signin()', {
        status: this.#db.status,
        error: error instanceof Error ? error.message : error,
      });
      try {
        await withTimeout(
          this.#db.signin({ username: this.#config.username, password: this.#config.password }),
          this.#queryTimeoutMs,
          'Token refresh timeout',
        );
        log([TAG, 'info'], 'Token refreshed successfully');
      } catch (signinError) {
        log([TAG, 'info'], 'Token refresh failed', {
          status: this.#db.status,
          error: signinError instanceof Error ? signinError.message : signinError,
        });
        throw signinError;
      }
      return withTimeout(fn(), this.#queryTimeoutMs, 'Query timeout');
    }
  }

  async query<T>(...args: QueryParameters): Promise<T[]> {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    return this.#withTokenRecovery(() => this.#db.query<T[]>(...args));
  }

  async queryRaw(...args: QueryParameters) {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    return this.#withTokenRecovery(() => this.#db.queryRaw(...args));
  }

  get status(): ConnectionStatus {
    return this.#db.status;
  }
}
