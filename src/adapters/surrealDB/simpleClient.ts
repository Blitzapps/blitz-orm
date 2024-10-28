import type { QueryParameters, QueryResult } from 'surrealdb';
import Surreal from 'surrealdb';

export class SurrealClient {
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
		try {
			db.connect(this.url, {
				namespace: this.namespace,
				database: this.database,
				auth: {
					username: this.username,
					password: this.password,
				},
				versionCheck: false,
			});
			return cb(db);
		} finally {
			await db.close();
		}
	}

	async query_raw<T>(...args: QueryParameters): Promise<QueryResult<T>[]> {
		return this.run((db) => {
			return db.query_raw(...args);
		});
	}

	async query<T extends unknown[]>(...args: QueryParameters): Promise<T> {
		return this.run((db) => {
			return db.query<T>(...args);
		});
	}
}
