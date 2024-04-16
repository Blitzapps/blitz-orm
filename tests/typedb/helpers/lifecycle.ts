import { readFileSync } from 'fs';

import { SessionType, TransactionType, TypeDB } from 'typedb-driver';
import { v4 as uuidv4 } from 'uuid';

import type { Provider } from '../../../src/index';
import BormClient from '../../../src/index';
// import { cloudConfig } from '../mocks/cloudConfig';
import { testConfig } from '../mocks/testConfig';
import { testSchema } from '../../mocks/testSchema';

// to replace by the provider being tested. In the future, test every provider
// const provider: Provider = 'typeDBCluster';
const provider: Provider['provider'] = 'typeDB';

const providerConfig = {
	typeDB: testConfig,
	// typeDBCluster: cloudConfig,
};

const createClient = async (connector: any) => {
	if (provider === 'typeDB') {
		return TypeDB.coreDriver(connector.url);
	}
	if (provider === 'typeDBCluster') {
		return TypeDB.cloudDriver(connector.addresses, connector.credentials);
	}
	throw new Error('Invalid provider');
};

export const init = async () => {
	const [connector] = providerConfig[provider].dbConnectors;
	const tqlSchema = readFileSync('./tests/typedb/mocks/schema.tql', 'utf8');
	const tqlData = readFileSync('./tests/typedb/mocks/data.tql', 'utf8');
	const dbName = `${connector.dbName}_${uuidv4()}`;
	const client = await createClient(connector);
	await client.databases.create(dbName);

	try {
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
		//await client.close();
		const bormClient = new BormClient({
			schema: testSchema,
			config: { ...testConfig, dbConnectors: [{ ...connector, dbName }] },
		});
		await bormClient.init();
		return { bormClient, dbName }; //todo make this cleaner, probably as private function of bormCLient.databases for instance
	} catch (e: any) {
		throw new Error(e.message);
		// return { bormClient: undefined, dbName };
	}
};

export const cleanup = async (client: BormClient, dbName: string) => {
	if (!client) {
		throw new Error('Client is undefined');
	}

	const dbHandles = client.getDbHandles();
	const typeDB = dbHandles?.typeDB;
	typeDB?.forEach(async (typeDB) => {
		const database = await typeDB.client.databases.get(dbName);
		await database.delete();
	});

	await client.close();
};
