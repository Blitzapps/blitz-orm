import { readFileSync } from 'fs';
import { SessionType, TransactionType, TypeDB } from 'typedb-driver';

import type { BormConfig, BormSchema, Provider, TypeDBProvider } from '../../src/index';
import BormClient from '../../src/index';
import { genId } from '../../src/helpers';

export const setup = async (props: {
	config: BormConfig;
	schema: BormSchema;
	tqlPathMap?: Record<string, { schema?: string; data?: string }>;
}) => {
	const { config, schema, tqlPathMap } = props;
	const dbConnectors = (await Promise.all(
		config.dbConnectors.map(async (connector) => {
			if (connector.provider !== 'typeDB') {
				return connector;
			}
			const tqlPath = tqlPathMap?.[connector.id];
			return await setupTypeDB({
				connector: connector as TypeDBProvider,
				schemaTqlPath: tqlPath?.schema,
				dataTqlPath: tqlPath?.data,
			});
		}),
	)) as [Provider, ...Provider[]];
	const dbNameMap = Object.fromEntries(Object.values(dbConnectors).map((i) => [i.id, i.dbName]));
	const client = new BormClient({
		schema,
		config: {
			...config,
			dbConnectors,
		},
	});
	await client.init();
	return { client, cleanup: () => cleanup(client, dbNameMap) };
};

const setupTypeDB = async (props: {
	connector: TypeDBProvider;
	schemaTqlPath?: string;
	dataTqlPath?: string;
}): Promise<TypeDBProvider> => {
	const { connector, schemaTqlPath, dataTqlPath } = props;
	const schemaTql = schemaTqlPath && readFileSync(schemaTqlPath, 'utf8');
	const dataTql = dataTqlPath && readFileSync(dataTqlPath, 'utf8');
	const dbName = `${connector.dbName}_${genId(5)}`;
	const client = await TypeDB.coreDriver(connector.url);
	await client.databases.create(dbName);

	if (schemaTql) {
		const schemaSession = await client.session(dbName, SessionType.SCHEMA);
		const schemaTransaction = await schemaSession.transaction(TransactionType.WRITE);
		await schemaTransaction.query.define(schemaTql);
		await schemaTransaction.commit();
		await schemaTransaction.close();
		await schemaSession.close();
	}

	if (dataTql) {
		const dataSession = await client.session(dbName, SessionType.DATA);
		const dataTransaction = await dataSession.transaction(TransactionType.WRITE);
		await dataTransaction.query.insert(dataTql);
		await dataTransaction.commit();
		await dataTransaction.close();
		await dataSession.close();
	}

	await client.close();

	return { ...connector, dbName };
};

const cleanup = async (client: BormClient, dbNameMap: Record<string, string>) => {
	if (!client) {
		throw new Error('Client is undefined');
	}

	const dbHandles = client.getDbHandles();
	const typeDB = dbHandles?.typeDB;
	[...(typeDB || [])].forEach(async ([id, typeDB]) => {
		const database = await typeDB.client.databases.get(dbNameMap[id]);
		await database.delete();
	});

	// We don't delete SurrealDB database because currently we're setting it up
	// manually and we want to avoid setting up the database every time we run the test.

	await client.close();
};
