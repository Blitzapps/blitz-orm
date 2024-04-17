import { readFileSync } from 'fs';
import { SessionType, TransactionType, TypeDB } from 'typedb-driver';
import { v4 as uuidv4 } from 'uuid';

import type { Provider, TypeDBProvider } from '../../../src/index';
import BormClient from '../../../src/index';
import { config } from '../mocks/config';
import { schema } from '../mocks/schema';

export const init = async () => {
	const typeDBConnector = config.dbConnectors.find((c) => c.provider === 'typeDB') as TypeDBProvider;
	const newTypeDBConnector = await setupTypeDB(typeDBConnector);
	const dbConnectors = config.dbConnectors.map((i) => i.provider === 'typeDB' ? newTypeDBConnector : i) as [Provider, ...Provider[]];
	const dbNameMap = Object.fromEntries(Object.values(dbConnectors).map((i) => [i.id, i.dbName]));
	const bormClient = new BormClient({
		schema,
		config: {
			...config,
			dbConnectors,
		},
	});
	await bormClient.init();
	return { bormClient, cleanup: () => cleanup(bormClient, dbNameMap) };
};

const setupTypeDB = async (connector: TypeDBProvider): Promise<TypeDBProvider> => {
	const tqlSchema = readFileSync('./tests/multidb/mocks/schema.tql', 'utf8');
	const tqlData = readFileSync('./tests/multidb/mocks/data.tql', 'utf8');
	const dbName = `${connector.dbName}_${uuidv4()}`;
	const client = await TypeDB.coreDriver(connector.url);
	await client.databases.create(dbName);
	const schemaSession = await client.session(dbName, SessionType.SCHEMA);
	const dataSession = await client.session(dbName, SessionType.DATA);
	const schemaTransaction = await schemaSession.transaction(TransactionType.WRITE);
	await schemaTransaction.query.define(tqlSchema);
	await schemaTransaction.commit();
	await schemaTransaction.close();
	await schemaSession.close();
	const dataTransaction = await dataSession.transaction(TransactionType.WRITE);
	await dataTransaction.query.insert(tqlData);
	await dataTransaction.commit();
	await dataTransaction.close();
	await dataSession.close();
	await client.close();
	return { ...connector, dbName };
};

const cleanup = async (client: BormClient, dbNameMap: Record<string, string>) => {
	if (!client) {
		throw new Error('Client is undefined');
	}

	const dbHandles = client.getDbHandles();
	const typeDB = dbHandles?.typeDB;
	[...typeDB||[]].forEach(async ([id, typeDB]) => {
		const database = await typeDB.client.databases.get(dbNameMap[id]);
		await database.delete();
	});

	// We don't delete SurrealDB database because currently we're setting it up
	// manually and we want to avoid setting up the database every time we run the test.

	await client.close();
};
