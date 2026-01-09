import { nanoid } from 'nanoid';
import type { QueryParameters, QueryResult } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';
import { log } from '../../logger';

const QUEUE_TIMEOUT = 5000; // The max duration a query is queued before "Timeout" error is thrown.
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
  private connectionPromise: Promise<void> | null;
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
    this.connectionPromise = this.tryConnectingUntilSucceed();
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
    if (!this.connectionPromise) {
      this.connectionPromise = this.tryConnectingUntilSucceed();
    }
    await this.connectionPromise;
  }

  get isClosed() {
    return this.closed;
  }

  private async run<T>(cb: (db: Surreal) => Promise<T>): Promise<T> {
    let retryCount = 0;
    const maxRetries = 3;
    while (true) {
      try {
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
      } catch (e: any) {
        // TODO: Handle other connection errors.
        const isEngineDisconnected = e.name === 'EngineDisconnected';
        if (retryCount < maxRetries && isEngineDisconnected) {
          retryCount++;
          continue;
        }
        throw e;
      }
    }
  }

  private async scheduleConnectionCheck() {
    if (!this.isClosed && this.cancelScheduledConnectionCheck === null) {
      const cancel = schedule(() => this.tryConnectingUntilSucceed(), RECONNECT_INTERVAL);
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
    this.scheduleConnectionCheck();
    this.connectionPromise = null;
  }

  async query<T = unknown>(...args: QueryParameters): Promise<T[]> {
    return this.run((db) =>  db.query(...args));
  }

  async queryRaw<T = unknown>(...args: QueryParameters): Promise<QueryResult<T>[]> {
    return this.run((db) =>  db.queryRaw(...args));
  }
}

interface QueueItem {
  cb: (client: SurrealClient) => Promise<void>;
  timeout: () => boolean;
}

export class SurrealPool {
  private queue: QueueItem[]; // TODO: Make this more sophisticated. Create a queue class that has method push, pop, length.
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
    this.queue = [];
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

  // TODO: Avoid recursive calls. Deep recursion may cause "RangeError: Maximum call stack size exceeded" error.
  private async dequeue() {
    if (this.queue.length === 0 || this.freeClients.length === 0) {
      return;
    }

    const q = this.queue[0] as QueueItem;
    this.queue = this.queue.slice(1);
    if (q.timeout()) {
      this.dequeue();
      return;
    }

    try {
      await this.useClient(async (client) => q.cb(client));
    } finally {
      this.dequeue();
    }
  }

  // TODO: Remove item from queue immediately if the timeout is reached.
  private async run<T>(cb: (client: SurrealClient) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let isTimeout = false;
      const cancelQueueTimeout = schedule(() => {
        isTimeout = true;
        reject(new Error('Failed to acquire DB connection in time'));
      }, QUEUE_TIMEOUT);
      this.queue.push({
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