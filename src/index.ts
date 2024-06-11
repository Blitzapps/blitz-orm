import { tryit } from 'radash';
import { TypeDB, SessionType, TypeDBCredential } from 'typedb-driver';
import { Surreal } from 'surrealdb.js';

import { defaultConfig } from './default.config';
import { bormDefine } from './define';
import { enrichSchema } from './helpers';
import type {
	BQLMutation,
	BQLResponse,
	BQLResponseMulti,
	BormConfig,
	BormSchema,
	DBHandles,
	EnrichedBormSchema,
	MutationConfig,
	QueryConfig,
	RawBQLQuery,
} from './types';
import { enableMapSet } from 'immer';
import { runMutationMachine } from './stateMachine/mutation/mutationMachine';
import { runQueryMachine } from './stateMachine/query/queryMachine';

export * from './types';

type BormProps = {
	schema: BormSchema;
	config: BormConfig;
};

/// Global config
// immer
enableMapSet();

class BormClient {
	private schema: BormSchema;

	private config: BormConfig;

	private dbHandles?: DBHandles;

	constructor({ schema, config }: BormProps) {
		this.schema = schema;
		this.config = config;
	}
	getDbHandles = () => this.dbHandles;

	init = async () => {
		const dbHandles = { typeDB: new Map(), surrealDB: new Map() };
		await Promise.all(
			this.config.dbConnectors.map(async (dbc) => {
				if (dbc.provider === 'surrealDB') {
					const db = new Surreal();

					await db.connect(dbc.url, {
						namespace: dbc.namespace,
						database: dbc.dbName,
						auth: {
							namespace: dbc.namespace,
							database: dbc.dbName,
							username: dbc.username,
							password: dbc.password,
						},
					});

					dbHandles.surrealDB.set(dbc.id, { client: db });
				}
				if (dbc.provider === 'typeDB' && dbc.dbName) {
					// const client = await TypeDB.coreClient(dbc.url);
					// const clientErr = undefined;
					const [clientErr, client] = await tryit(TypeDB.coreDriver)(dbc.url);
					if (clientErr) {
						const message = `[BORM:${dbc.provider}:${dbc.dbName}:core] ${
							// clientErr.messageTemplate?._messageBody() ?? "Can't create TypeDB Client"
							clientErr.message ?? "Can't create TypeDB Client"
						}`;
						throw new Error(message);
					}
					try {
						const session = await client.session(dbc.dbName, SessionType.DATA);
						dbHandles.typeDB.set(dbc.id, { client, session });
					} catch (sessionErr: any) {
						const message = `[BORM:${dbc.provider}:${dbc.dbName}:session] ${
							// eslint-disable-next-line no-underscore-dangle
							(sessionErr.messageTemplate?._messageBody() || sessionErr.message) ?? "Can't create TypeDB Session"
						}`;
						throw new Error(message);
					}
				}
				if (dbc.provider === 'typeDBCluster' && dbc.dbName) {
					const credential = new TypeDBCredential(dbc.username, dbc.password, dbc.tlsRootCAPath);
					const [clientErr, client] = await tryit(TypeDB.cloudDriver)(dbc.addresses, credential);

					if (clientErr) {
						const message = `[BORM:${dbc.provider}:${dbc.dbName}:core] ${
							// clientErr.messageTemplate?._messageBody() ?? "Can't create TypeDB Client"
							clientErr.message ?? "Can't create TypeDB Cluster Client"
						}`;
						throw new Error(message);
					}
					try {
						const session = await client.session(dbc.dbName, SessionType.DATA);
						dbHandles.typeDB.set(dbc.id, { client, session });
					} catch (sessionErr: any) {
						const message = `[BORM:${dbc.provider}:${dbc.dbName}:session] ${
							// eslint-disable-next-line no-underscore-dangle
							(sessionErr.messageTemplate?._messageBody() || sessionErr.message) ?? "Can't create TypeDB Session"
						}`;
						throw new Error(message);
					}
				}
			}),
		);
		const enrichedSchema = enrichSchema(this.schema, dbHandles);

		this.schema = enrichedSchema as EnrichedBormSchema;
		this.dbHandles = dbHandles;
	};

	#enforceConnection = async () => {
		if (!this.dbHandles) {
			await this.init();
			if (!this.dbHandles) {
				throw new Error("Can't init BormClient");
			}
		}
	};

	introspect = async () => {
		await this.#enforceConnection();
		return this.schema;
	};

	define = async () => {
		await this.#enforceConnection();
		return bormDefine(this.config, this.schema, this.dbHandles);
	};

	/// no types yet, but we can do "as ..." after getting the type fro the schema
	// query = async (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => {
	// 	const handles = this.dbHandles;
	// 	if (!handles) {
	// 		throw new Error('dbHandles undefined');
	// 	}

	// 	await this.#enforceConnection();

	// 	const qConfig = {
	// 		...this.config,
	// 		query: { ...defaultConfig.query, ...this.config.query, ...queryConfig },
	// 	};

	// 	// @ts-expect-error type of Query is incorrect
	// 	return queryPipeline(query, qConfig, this.schema, handles);
	// };

	query = async (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => {
		await this.#enforceConnection();

		const qConfig = {
			...this.config,
			query: {
				...defaultConfig.query,
				...this.config.query,
				...queryConfig,
			},
		};
		const isBatched = Array.isArray(query);
		const queries = isBatched ? query : [query];

		const [errorRes, res] = await tryit(runQueryMachine)(
			queries,
			this.schema as EnrichedBormSchema,
			qConfig,
			this.dbHandles as DBHandles,
		);
		if (errorRes) {
			//@ts-expect-error - errorRes has error. Also no idea where the error: comes from
			const error = new Error(errorRes.error);
			//@ts-expect-error - errorRes has error. Also no idea where the error: comes from
			error.stack = errorRes.error.stack;
			throw error;
		}

		const result = res as BQLResponse[];

		return isBatched ? result : result[0];
	};

	mutate = async (mutation: BQLMutation, mutationConfig?: MutationConfig) => {
		await this.#enforceConnection();
		const mConfig = {
			...this.config,
			mutation: {
				...defaultConfig.mutation,
				...this.config.mutation,
				...mutationConfig,
			},
		};

		const [errorRes, res] = await tryit(runMutationMachine)(
			mutation,
			this.schema as EnrichedBormSchema,
			mConfig,
			this.dbHandles as DBHandles,
		);
		if (errorRes) {
			//console.error(errorRes.error.stack.split('\n').slice(0, 4).join('\n'));
			//@ts-expect-error - errorRes has error. Also no idea where the error: comes from
			const error = new Error(errorRes.error.message);
			//@ts-expect-error - errorRes has error. Also no idea where the error: comes from
			error.stack = errorRes.error.stack;
			throw error;
		}

		return res as BQLResponseMulti;
	};

	close = async () => {
		if (!this.dbHandles) {
			return;
		}
		//todo: probably migrate dbHandles to be an array, where each handle has .type="typeDB" for instance
		this.dbHandles.typeDB?.forEach(async ({ client, session }) => {
			if (session.isOpen()) {
				await session.close();
			}
			await client.close();
		});
		// TODO: Close SurrealDB clients.
		// Currently there's no `close()` method in the client.
		// See https://github.com/surrealdb/surrealdb.node/issues/36
	};
}

export default BormClient;
