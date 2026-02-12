import { type BoundQuery, Surreal, UnsupportedVersionError } from 'surrealdb';
import { log } from '../../logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionState = 'disconnected' | 'connecting' | 'retrying' | 'connected';

type ConnectionConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};

type ReconnectConfig = {
  enabled: boolean;
  attempts: number;
  retryDelayMultiplier: number;
  retryDelayJitter: number;
};

export type SurrealClientOptions = {
  reconnect?: Partial<ReconnectConfig>;
  versionCheck?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TAG = 'SurrealClient';

const DEFAULT_RECONNECT: ReconnectConfig = {
  enabled: true,
  attempts: -1,
  retryDelayMultiplier: 1.2,
  retryDelayJitter: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export class SurrealClient {
  readonly #db = new Surreal();
  readonly #config: ConnectionConfig;
  readonly #reconnect: ReconnectConfig;
  readonly #versionCheck: boolean;

  #connecting: Promise<void> | null = null;
  #subscribed = false;
  #closed = false;
  #state: ConnectionState = 'disconnected';
  #version: string | null = null;
  #latestError = '';

  constructor(config: ConnectionConfig, options: SurrealClientOptions = {}) {
    this.#config = config;
    this.#reconnect = { ...DEFAULT_RECONNECT, ...options.reconnect };
    this.#versionCheck = options.versionCheck ?? false;
  }

  async connect(): Promise<void> {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    if (this.#state === 'connected') {
      return;
    }
    if (this.#connecting) {
      return this.#connecting;
    }

    const { url, namespace, database, username, password } = this.#config;

    log([TAG, 'info'], `Opening connection to ${url}`);

    this.#setupEventSubscriptions();
    this.#state = 'connecting';

    this.#connecting = this.#db
      .connect(url, {
        namespace,
        database,
        versionCheck: this.#versionCheck,
        reconnect: this.#reconnect,
        authentication: async () => ({ username, password }),
      })
      .then(async () => {
        await this.#fetchVersion();
        this.#state = 'connected';
        this.#latestError = '';
        log([TAG, 'info'], 'Connection established');
      })
      .catch((err) => {
        this.#handleConnectionError(err);
        throw err;
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
    await this.#db.close().catch(() => {});
    this.#state = 'disconnected';
    this.#version = null;
  }

  async query<T>(query: string | BoundQuery, bindings?: Record<string, unknown>): Promise<T[]> {
    if (this.#closed) {
      throw new Error('Client has been closed');
    }
    return typeof query === 'string' ? this.#db.query<T[]>(query, bindings) : this.#db.query<T[]>(query);
  }

  get state(): ConnectionState {
    return this.#state;
  }

  get version(): string | null {
    return this.#version;
  }

  get latestError(): string {
    return this.#latestError;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private
  // ───────────────────────────────────────────────────────────────────────────

  #setupEventSubscriptions(): void {
    if (this.#subscribed) {
      return;
    }
    this.#subscribed = true;

    this.#db.subscribe('connecting', () => {
      this.#state = 'connecting';
    });
    this.#db.subscribe('reconnecting', () => {
      this.#state = 'retrying';
    });
    this.#db.subscribe('disconnected', () => {
      this.#state = 'disconnected';
      this.#version = null;
    });
    this.#db.subscribe('error', (err: Error) => {
      this.#latestError = err.message;
      log([TAG, 'error'], 'Connection error', { error: err.message });
    });
  }

  async #fetchVersion(): Promise<void> {
    try {
      const v = await this.#db.version();
      this.#version = v.version.replace(/^surrealdb-/, '');
      log([TAG, 'info'], `Database version ${this.#version}`);
    } catch {
      log([TAG, 'info'], 'Database version unknown');
    }
  }

  #handleConnectionError(err: Error): void {
    this.#latestError = err.message;

    if (err instanceof UnsupportedVersionError) {
      log([TAG, 'error'], 'Unsupported SurrealDB version', {
        version: err.version,
        minimum: err.minimum,
        maximum: err.maximum,
      });
    }
  }
}
