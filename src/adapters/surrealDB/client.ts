import type { QueryParameters, QueryResult } from 'surrealdb';
import Surreal, { ConnectionStatus } from 'surrealdb';

const QUEUE_TIMEOUT = 5000; // The max duration a query is queued before "Timeout" error is thrown.
const QUERY_TIMEOUT = 300000; // The max duration a query is run before "Timeout" error is thrown.
const RECONNECT_INTERVAL = 2000; // Check the connection every `RECONNECT_INTERVAL` and reconnect it if it's not connected.
const INITIAL_RECONNECT_INTERVAL = 1000; // If it's failed to reconnect wait with exponential backoff with this initial interval and then try to reconnect again.
const MAX_RECONNECT_RETRY_INTERVAL = 60000; // If the reconnection failed wait with exponential backoff with this max interval and then try to reconnect again.

class SurrealClient {
	private db: Surreal;
	private url: string;
	private username: string;
	private password: string;
	private namespace: string;
	private database: string;
	private isConnecting: boolean;
	private reconnectInterval: ReturnType<typeof setInterval> | null;

	constructor(params: { url: string; username: string; password: string; namespace: string; database: string }) {
		this.db = new Surreal();
		this.url = params.url;
		this.username = params.username;
		this.password = params.password;
		this.namespace = params.namespace;
		this.database = params.database;
		this.isConnecting = false;
		this.reconnectInterval = null;
	}

	private async _connect() {
		if (
			this.isConnecting ||
			this.db.status === ConnectionStatus.Connecting ||
			this.db.status === ConnectionStatus.Connected
		) {
			return;
		}
		this.isConnecting = true;
		this.db = new Surreal();
		let retryTimeout = Math.max(INITIAL_RECONNECT_INTERVAL, 1);
		// eslint-disable-next-line no-constant-condition
		while (true) {
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
			} catch (e) {
				failed = true;
				this.close();
				if (this.isClosed) {
					break;
				}
			}
			if (failed) {
				await sleep((1 + Math.random() * 0.1) * retryTimeout);
				retryTimeout = Math.min(2 * retryTimeout, MAX_RECONNECT_RETRY_INTERVAL);
				await this._connect();
			}
		}
		this.isConnecting = false;
	}

	async connect() {
		if (this.isClosed) {
			this.reconnectInterval = setInterval(() => this._connect(), RECONNECT_INTERVAL);
		}
		return this._connect();
	}

	close() {
		if (this.reconnectInterval !== null) {
			clearInterval(this.reconnectInterval);
			this.reconnectInterval = null;
			try {
				this.db.close();
			} catch {
				// No-op
			}
		}
	}

	get isClosed() {
		return this.reconnectInterval === null;
	}

	private async run<T>(cb: (db: Surreal) => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.close();
				this.connect();
				reject(new Error('Timeout'));
			}, QUERY_TIMEOUT);
			this.connect()
				.then(() => {
					cb(this.db)
						.then(resolve)
						.catch(reject)
						.finally(() => {
							clearTimeout(timeout);
						});
				})
				.catch(reject);
		});
	}

	async query<T = unknown>(...args: QueryParameters): Promise<T[]> {
		return this.run((db) => {
			return db.query(...args);
		});
	}

	async query_raw<T = unknown>(...args: QueryParameters): Promise<QueryResult<T>[]> {
		return this.run((db) => {
			return db.query_raw(...args);
		});
	}
}

const sleep = async (timeout: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, timeout);
	});
};

interface QueueItem {
	cb: (err?: any, client?: SurrealClient) => void;
	timeout: () => boolean;
}

export class SurrealPool {
	private queue: QueueItem[]; // TODO: Make this more sophisticated
	private connections: SurrealClient[]; // TODO: Make this more sophisticated

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
		this.connections = new Array(totalConnections).fill(0).map(() => {
			const client = new SurrealClient(clientParams);
			client.connect();
			return client;
		});
	}

	private async dequeue() {
		if (this.queue.length === 0 || this.connections.length === 0) {
			return;
		}
		const q = this.queue[0] as QueueItem;
		this.queue = this.queue.slice(1);
		if (q.timeout()) {
			q.cb(new Error('Timeout'), undefined);
			this.dequeue();
			return;
		}

		const con = this.connections.pop() as SurrealClient;

		try {
			q.cb(undefined, con);
		} catch (err) {
			q.cb(err, undefined);
		} finally {
			this.connections.push(con);
			this.dequeue();
		}
	}

	private async run<T>(cb: (err?: any, client?: SurrealClient) => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			let isTimeout = false;
			const timeout = setTimeout(() => {
				isTimeout = true;
				reject(new Error('Timeout'));
			}, QUEUE_TIMEOUT);
			this.queue.push({
				cb: (err, client) => {
					clearTimeout(timeout);
					cb(err, client)
						.then((res) => resolve(res))
						.catch((e) => reject(e));
				},
				timeout: () => isTimeout,
			});
			this.dequeue();
		});
	}

	async query<T = unknown>(...args: QueryParameters): Promise<T[]> {
		return this.run((err, client) => {
			if (client) {
				return client.query<T>(...args);
			}
			throw err;
		});
	}

	async query_raw<T = unknown>(...args: QueryParameters): Promise<QueryResult<T>[]> {
		return this.run((err, client) => {
			if (client) {
				return client.query_raw<T>(...args);
			}
			throw err;
		});
	}
}
