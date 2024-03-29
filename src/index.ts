import { tryit } from 'radash';
import { TypeDB, SessionType } from 'typedb-driver';

import { defaultConfig } from './default.config';
import { bormDefine } from './define';
import { enrichSchema } from './helpers';
import { queryPipeline } from './pipeline/pipeline';
import type {
	BQLMutation,
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
import { runMutationMachine } from './stateMachine/mutation/machine';

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
	query = async (query: RawBQLQuery | RawBQLQuery[], queryConfig?: QueryConfig) => {
		await this.#enforceConnection();
		const qConfig = {
			...this.config,
			query: { ...defaultConfig.query, ...this.config.query, ...queryConfig },
		};
		// @ts-expect-error - enforceConnection ensures dbHandles is defined
		return queryPipeline(query, qConfig, this.schema, this.dbHandles);
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

		const result = res.bql.res;

		return result as BQLResponseMulti;
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
	};
}

export default BormClient;
