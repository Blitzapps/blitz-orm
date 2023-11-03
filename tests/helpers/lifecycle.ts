import { readFileSync } from 'fs';

import { SessionType, TransactionType, TypeDB } from 'typedb-driver';
import { v4 as uuidv4 } from 'uuid';

import type { Provider } from '../../src/index';
import BormClient from '../../src/index';
import { cloudConfig } from '../mocks/cloudConfig';
import { testConfig } from '../mocks/testConfig';
import { testSchema } from '../mocks/testSchema';

// to replace by the provider being tested. In the future, test every provider
// const provider: Provider = 'typeDBCluster';
const provider: Provider = 'typeDB';

const providerConfig = {
	typeDB: testConfig,
	typeDBCluster: cloudConfig,
};

const createClient = async (connector: any) => {
	if (provider === 'typeDB') {
		return TypeDB.coreDriver(connector.url);
	}
	if (provider === 'typeDBCluster') {
		return TypeDB.enterpriseDriver(connector.addresses, connector.credentials);
	}
	throw new Error('Invalid provider');
};

export const init = async () => {
	const [connector] = providerConfig[provider].dbConnectors;
	const tqlSchema = readFileSync('./tests/mocks/schema.tql', 'utf8');
	const tqlData = readFileSync('./tests/mocks/data.tql', 'utf8');
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
		await client.close();
		const bormClient = new BormClient({
			schema: testSchema,
			config: { ...testConfig, dbConnectors: [{ ...connector, dbName }] },
		});
		await bormClient.init();
		return { bormClient, dbName };
	} catch (e: any) {
		throw new Error(e.message);
		// return { bormClient: undefined, dbName };
	}
};

export const cleanup = async (dbName: string) => {
	const [connector] = providerConfig[provider].dbConnectors;
	const client = await createClient(connector);

	await (await client.databases.get(dbName)).delete();
	await client.close();
};
