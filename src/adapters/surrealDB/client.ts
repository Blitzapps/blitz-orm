import { nanoid } from 'nanoid';
import type { QueryParameters, QueryResult } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';
import { log } from '../../logger';

const QUEUE_TIMEOUT = 5000; // The max duration a query is queued before "Timeout" error is thrown.
const QUEUE_BATCH_SIZE = 128;
const QUERY_TIMEOUT = 180000; // The max duration a query is run before "Timeout" error is thrown.
const RECONNECT_INTERVAL = 2000; // Check the connection every `RECONNECT_INTERVAL` and reconnect it if it's not connected.
const INITIAL_RECONNECT_INTERVAL = 1000; // If it's failed to reconnect wait with exponential backoff with this initial interval and then try to reconnect again.
const MAX_RECONNECT_RETRY_INTERVAL = 60000; // If the reconnection failed wait with exponential backoff with this max interval and then try to reconnect again.

export type AnySurrealClient = SimpleSurrealClient | SurrealPool;

class SurrealClient {
  private db: Surreal;
  private url: string;
  private username: string;
  private password: string;
  private namespace: string;
  private database: string;
  private connectionPromise: Promise<void> | null = null;
  private cancelScheduledConnectionCheck: (() => void) | null = null;
  private cancelRetrySleep: (() => void) | null = null;
  private closed: boolean = false;

  constructor(params: { url: string; username: string; password: string; namespace: string; database: string }) {
    this.db = new Surreal();
    this.url = params.url;
    this.username = params.username;
    this.password = params.password;
    this.namespace = params.namespace;
    this.database = params.database;
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cancelScheduledConnectionCheck?.();
    this.cancelRetrySleep?.();
    try {
      await this.db.close();
    } catch {
      // ignore
    }
  }

  async connect() {
    this.closed = false;
    if (!this.connectionPromise) {
      this.connectionPromise = this.tryConnectingUntilSucceed();
    }
    try {
      await this.connectionPromise;
    } catch (e) {
      log('error', 'Failed to connect to SurrealDB', { error: e });
    }
  }

  get isClosed() {
    return this.closed;
  }

  /**
   * Connect to SurrealDB if not connected and run the callback.
   */
  private async run<T>(cb: (db: Surreal) => Promise<T>): Promise<T> {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const cancelQueryTimer = schedule(async () => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error('Timeout'));
      }, QUERY_TIMEOUT);
      // Cancel any scheduled retry sleep to reconnect immediately
      this.cancelRetrySleep?.();
      this.connect()
        .then(() => {
          cb(this.db)
            .then((res) => {
              if (settled) {
                return;
              }
              settled = true;
              cancelQueryTimer();
              resolve(res);
            })
            .catch((err) => {
              if (settled) {
                return;
              }
              settled = true;
              cancelQueryTimer();
              reject(err);
            });
        })
        .catch((err) => {
          if (settled) {
            return;
          }
          settled = true;
          cancelQueryTimer();
          reject(err);
        });
    });
  }

  /**
   * Try to run the callback until it succeeds or the maximum number of retries is reached.
   * Retry only on engine disconnected errors.
   */
  private async tryRun<T>(cb: (db: Surreal) => Promise<T>): Promise<T> {
    if (this.isClosed) {
      throw new Error('SurrealClient is closed');
    }
    let retryCount = 0;
    const maxRetries = 2;
    while (true) {
      try {
        return await this.run(cb);
      } catch (e) {
        // TODO: Handle other connection errors.
        const isEngineDisconnected = e instanceof Error && e.name === 'EngineDisconnected';
        if (retryCount < maxRetries && isEngineDisconnected) {
          retryCount += 1;
          continue;
        }
        throw e as Error;
      }
    }
  }

  private async scheduleConnectionCheck() {
    if (!this.isClosed && this.cancelScheduledConnectionCheck === null) {
      const cancel = schedule(() => {
        this.cancelScheduledConnectionCheck = null;
        this.connect();
      }, RECONNECT_INTERVAL);
      this.cancelScheduledConnectionCheck = () => {
        cancel();
        this.cancelScheduledConnectionCheck = null;
      };
    }
  }

  /**
   * This method should not throw any exception.
   */
  private async tryConnectingUntilSucceed() {
    if (this.db.status === ConnectionStatus.Connected) {
      this.scheduleConnectionCheck();
      return;
    }

    this.cancelScheduledConnectionCheck?.();

    let retryTimeout = Math.max(INITIAL_RECONNECT_INTERVAL, 1);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.isClosed) {
        break;
      }
      let failed = false;
      try {
        await this.db.connect(this.url, {
          namespace: this.namespace,
          database: this.database,
          auth: {
            username: this.username,
            password: this.password,
          },
          versionCheck: false,
        });
        break;
      } catch {
        failed = true;
        if (this.isClosed) {
          break;
        }
      }
      // If the connection failed, wait with exponential backoff and try to reconnect again.
      if (failed) {
        await new Promise<void>((resolve) => {
          const cancel = schedule(() => {
            this.cancelRetrySleep = null;
            resolve();
          }, retryTimeout);
          this.cancelRetrySleep = () => {
            cancel();
            resolve();
            this.cancelRetrySleep = null;
          }
        });
        retryTimeout = expBackoff(retryTimeout, MAX_RECONNECT_RETRY_INTERVAL);
      }
    }
    this.connectionPromise = null;
    this.scheduleConnectionCheck();
  }

  async query<T = unknown>(...args: QueryParameters): Promise<T[]> {
    return this.tryRun((db) =>  db.query(...args));
  }

  async queryRaw<T = unknown>(...args: QueryParameters): Promise<QueryResult<T>[]> {
    return this.tryRun((db) =>  db.queryRaw(...args));
  }
}

interface QueueItem {
  cb: (client: SurrealClient) => Promise<void>;
  timeout: () => boolean;
}

export class SurrealPool {
  private queue: Queue<QueueItem>;
  private clients: SurrealClient[];
  private freeClients: SurrealClient[];

  constructor(params: {
    url: string;
    username: string;
    password: string;
    namespace: string;
    database: string;
    totalConnections: number;
  }) {
    const { totalConnections, ...clientParams } = params;
    this.queue = new Queue<QueueItem>(QUEUE_BATCH_SIZE);
    this.clients = new Array(totalConnections).fill(0).map(() => {
      const client = new SurrealClient(clientParams);
      client.connect();
      return client;
    });
    this.freeClients = [...this.clients];
  }

  async close() {
    await Promise.all(this.clients.map((con) => con.close()));
  }

  private async dequeue() {
    while (this.queue.size() > 0 && this.freeClients.length > 0) {
      const q = this.queue.dequeue();
      if (!q) {
        return;
      }

      if (q.timeout()) {
        continue;
      }

      await this.useClient(async (client) => q.cb(client));
    }
  }

  private async run<T>(cb: (client: SurrealClient) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let isTimeout = false;
      const cancelQueueTimeout = schedule(() => {
        isTimeout = true;
        reject(new Error('Failed to acquire DB connection in time'));
      }, QUEUE_TIMEOUT);
      this.queue.enqueue({
        cb: async (client) => {
          cancelQueueTimeout();
          try {
            const res = await cb(client);
            resolve(res);
          } catch (e) {
            reject(e);
          }
        },
        timeout: () => isTimeout,
      });
      this.dequeue();
    });
  }

  async query<T = unknown>(...args: QueryParameters): Promise<T[]> {
    return this.run((client) =>  client.query<T>(...args));
  }

  async queryRaw<T = unknown>(...args: QueryParameters): Promise<QueryResult<T>[]> {
    return this.run((client) => client.queryRaw<T>(...args));
  }

  async useClient<T>(cb: (client: SurrealClient) => Promise<T>): Promise<T> {
    const client = this.freeClients.pop();
    if (!client) {
      throw new Error('No free item available');
    }
    try {
      return await cb(client);
    } finally {
      this.freeClients.push(client);
    }
  }
}

class Queue<T> {
  private batchSize: number;
  private totalLength = 0;
  private batches: { items: Array<T | undefined>; offset: number; length: number }[] = [];

  /**
   * Optimizes performance by balancing batch count against batch size.
   * Sets `batchSize` to the smallest possible value where: Total batches < `batchSize`.
   * Use `batchSize` 2^n for better performance.
   */
  constructor(batchSize: number) {
    this.batchSize = batchSize > 0 ? batchSize : 1;
  }

  dequeue(): T | undefined {
    const batch = this.batches[0];
    if (!batch || batch.length === 0) {
      return undefined;
    }

    const item = batch.items[batch.offset];

    batch.items[batch.offset] = undefined;
    batch.offset += 1;
    batch.length -= 1;
    this.totalLength -= 1;

    if (batch.length === 0) {
      if (this.batches.length > 1) {
        this.batches.shift();
      } else {
        batch.offset = 0;
        batch.length = 0;
      }
    }

    return item;
  }

  enqueue(item: T) {
    const lastBatch = this.batches.at(-1);

    // Create a new batch if the last batch is full.
    if (!lastBatch || lastBatch.offset + lastBatch.length >= this.batchSize) {
      const items = new Array<T | undefined>(this.batchSize);
      items[0] = item;
      this.batches.push({ items, offset: 0, length: 1 });
      this.totalLength += 1;
      return;
    }

    const idx = lastBatch.offset + lastBatch.length;
    lastBatch.items[idx] = item;
    lastBatch.length += 1;
    this.totalLength += 1;
  }

  size() {
    return this.totalLength;
  }
}

export class SimpleSurrealClient {
  private url: string;
  private username: string;
  private password: string;
  private namespace: string;
  private database: string;

  constructor(params: { url: string; username: string; password: string; namespace: string; database: string }) {
    this.url = params.url;
    this.username = params.username;
    this.password = params.password;
    this.namespace = params.namespace;
    this.database = params.database;
  }

  private async run<T>(cb: (db: Surreal) => Promise<T>): Promise<T> {
    const db = new Surreal();
    const id = nanoid(3);
    const connect = performance.now();
    try {
      await db.connect(this.url, {
        namespace: this.namespace,
        database: this.database,
        auth: {
          username: this.username,
          password: this.password,
        },
        versionCheck: false,
      });
      log(['SimpleSurrealClient', 'SimpleSurrealClient/run'], `> SimpleSurrealClient/run/connect ${id} ${performance.now() - connect}ms`);
      const query = performance.now();
      const res =  await cb(db);
      log(['SimpleSurrealClient', 'SimpleSurrealClient/run'], `> SimpleSurrealClient/run/query ${id} ${performance.now() - query}ms`);
      return res;
    } finally {
      const close = performance.now();
      await db.close();
      log(['SimpleSurrealClient', 'SimpleSurrealClient/run'], `> SimpleSurrealClient/run/close ${id} ${performance.now() - close}ms`);
      log(['SimpleSurrealClient', 'SimpleSurrealClient/run'], `> SimpleSurrealClient/run/total ${id} ${performance.now() - connect}ms`);
    }
  }

  async query<T = unknown>(...args: QueryParameters): Promise<T[]> {
    return this.run<T[]>((db) => db.query(...args));
  }

  async queryRaw<T = unknown>(...args: QueryParameters): Promise<QueryResult<T>[]> {
    return this.run<QueryResult<T>[]>((db) => db.queryRaw(...args));
  }
}

const schedule = (cb: () => void, delay: number) => {
  const timeout = setTimeout(cb, delay);
  return () => clearTimeout(timeout);
};

const expBackoff = (current: number, max: number) => {
  return Math.min(2 * current, max) * (1 + Math.random() * 0.1);
};