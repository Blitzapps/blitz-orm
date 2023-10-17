import { readFileSync } from 'fs';

import type { TypeDBClient } from 'typedb-client';
import { SessionType, TransactionType, TypeDB } from 'typedb-client';
import { clientStubFromCloudEndpoint, DgraphClient, Operation } from 'dgraph-js';

import { v4 as uuidv4 } from 'uuid';

import type { Provider } from '../../src/index';
import BormClient from '../../src/index';
import { cloudConfig } from '../mocks/cloudConfig';
import { dgraphDbTestConfig, typeDbTestConfig } from '../mocks/testConfig';
import { testSchema } from '../mocks/testSchema';

// to replace by the provider being tested. In the future, test every provider
// const provider: Provider = 'typeDBCluster';
const provider: Provider = 'dgraph' as Provider; //so all options are considered even we define them manually

const providerConfig = {
	typeDB: typeDbTestConfig,
	typeDBCluster: cloudConfig,
	dgraph: dgraphDbTestConfig,
};

const createClientAndDB = async (connector: any, newDBName?: string) => {
	if (provider === 'typeDB') {
		const client = await TypeDB.coreClient(connector.url);
		if (newDBName) {
			await client.databases.create(newDBName);
		}
		return client;
	}
	if (provider === 'typeDBCluster') {
		const client = await TypeDB.clusterClient(connector.addresses, connector.credentials);
		if (newDBName) {
			await client.databases.create(newDBName);
		}
		return client;
	}

	if (provider === 'dgraph') {
		const clientStub = clientStubFromCloudEndpoint(connector.url, 'MDY4YjViNzdhMWE2NjNlMDEwMDg0NmNmMTY5ZWNlZWQ=');
		const client = new DgraphClient(clientStub);
		return client;
	}
	throw new Error('Invalid provider');
};

export const init = async () => {
	const [connector] = providerConfig[provider].dbConnectors;
	const tqlSchema = readFileSync('./tests/mocks/schema.tql', 'utf8');
	const tqlData = readFileSync('./tests/mocks/data.tql', 'utf8');
	const dbName = `${connector.dbName}_${uuidv4()}`;

	const client = await createClientAndDB(connector, dbName);

	if (provider === 'typeDBCluster' || provider === 'typeDB') {
		const typeDBClient = client as TypeDBClient;
		try {
			const schemaSession = await typeDBClient.session(dbName, SessionType.SCHEMA);
			const dataSession = await typeDBClient.session(dbName, SessionType.DATA);
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
			await typeDBClient.close();
			const bormClient = new BormClient({
				schema: testSchema,
				config: { ...providerConfig[provider], dbConnectors: [{ ...connector, dbName }] },
			});
			await bormClient.init();
			return { bormClient, dbName };
		} catch (e: any) {
			throw new Error(e.message);
		}
	}
	if (provider === 'dgraph') {
		const dgraphClient = client as DgraphClient;

		//
		const cleanData = new Operation();
		cleanData.setDropOp(Operation.DropOp.DATA);
		await dgraphClient.alter(cleanData);

		//clean schema
		const cleanSchema = new Operation();
		cleanSchema.setSchema(`
    Account.accessToken: string .
    Account.access_token: string .
    `);
		const result = await dgraphClient.alter(cleanSchema);
		console.log('result', result);

		// init bormClient
		const bormClient = new BormClient({
			schema: testSchema,
			config: { ...providerConfig[provider], dbConnectors: [{ ...connector, dbName }] },
		});
		await bormClient.init();
		return { bormClient, dbName };
	}
	throw new Error('Init: Provider not implemented');
};

export const cleanup = async (dbName: string) => {
	const [connector] = providerConfig[provider].dbConnectors;
	const client = await createClientAndDB(connector);

	if (provider === 'typeDB' || provider === 'typeDBCluster') {
		const typeDBClient = client as TypeDBClient;

		await (await typeDBClient.databases.get(dbName)).delete();
		await typeDBClient.close();
		return;
	}
	if (provider === 'dgraph') {
		const dgraphClient = client as DgraphClient;

		const op = new Operation();
		op.setDropOp(Operation.DropOp.DATA);
		await dgraphClient.alter(op);
	} else {
		throw new Error('Cleanup: Provider not implemented');
	}
};
