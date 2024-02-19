import { tryit } from 'radash';
import { TypeDB, SessionType } from 'typedb-driver';

import { defaultConfig } from './default.config';
import { bormDefine } from './define';
import { enrichSchema } from './helpers';
import { mutationPipeline, queryPipeline } from './pipeline/pipeline';
import type {
	BQLResponseMulti,
	BormConfig,
	BormSchema,
	DBHandles,
	MutateConfig,
	QueryConfig,
	RawBQLMutation,
	RawBQLQuery,
} from './types';
import { enableMapSet } from 'immer';
import { createActor, waitFor } from 'xstate';
import { mutationActor } from './stateMachine/mutation/machine';

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
					const [clientErr, client] = await tryit(TypeDB.cloudDriver)(dbc.addresses, dbc.credentials);

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

		// @ts-expect-error - it becomes enrichedSchema here
		this.schema = enrichedSchema;
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
	query = async (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => {
		await this.#enforceConnection();
		const qConfig = {
			...this.config,
			query: { ...defaultConfig.query, ...this.config.query, ...queryConfig },
		};
		// @ts-expect-error - enforceConnection ensures dbHandles is defined
		return queryPipeline(query, qConfig, this.schema, this.dbHandles);
	};

	mutate = async (mutation: RawBQLMutation | RawBQLMutation[], mutationConfig?: MutateConfig) => {
		await this.#enforceConnection();
		const mConfig = {
			...this.config,
			mutation: {
				...defaultConfig.mutation,
				...this.config.mutation,
				...mutationConfig,
			},
		};

		const startTime2 = performance.now();
		//@ts-expect-error - enforceConnection ensures dbHandles is defined
		mutationPipeline(mutation, mConfig, this.schema, this.dbHandles);
		const endTime2 = performance.now();
		console.log(`Old Mutation took ${endTime2 - startTime2}ms`);

		const startTime = performance.now();
		const runMutation = createActor(mutationActor, {
			input: {
				raw: mutation,
				config: mConfig,
				schema: this.schema,
				handles: this.dbHandles,
				deepLevel: 0, //this is the root
			},
		});
		runMutation.start();
		const result = await (await waitFor(runMutation, (state) => state.status === 'done')).context.bql.res;
		const endTime = performance.now();
		console.log(`New Mutation took ${endTime - startTime}ms`);

		return result as BQLResponseMulti;
	};

	close = async () => {
		if (!this.dbHandles) {
			return;
		}
		//todo: probably migrate dbHandles to be an array, where each handle has .type="typeDB" for intance
		this.dbHandles.typeDB?.forEach(async ({ client, session }) => {
			if (session.isOpen()) {
				await session.close();
			}
			await client.close();
		});
	};
}

export default BormClient;
