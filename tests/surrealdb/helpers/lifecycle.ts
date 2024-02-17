import { readFileSync } from 'fs';

import { SessionType, TransactionType, TypeDB } from 'typedb-driver';
import { v4 as uuidv4 } from 'uuid';

import type { Provider } from '../../../src/index';
import BormClient from '../../../src/index';
// import { cloudConfig } from '../mocks/cloudConfig';
import { testConfig } from '../mocks/testConfig';
import { testSchema } from '../mocks/testSchema';
import { Surreal } from 'surrealdb.node'
import { customAlphabet } from 'nanoid'

// NOTE SurrealDB does not accept hyphen, tried to use quotes still does not work
const alphabet = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const nanoid = customAlphabet(alphabet,  21)

const provider: Provider = 'surrealDB';

const providerConfig = {
	surrealDB: testConfig,
};

export const init = async () => {
	const [connector] = providerConfig[provider].dbConnectors;
	const surqlSchema = readFileSync('./tests/surrealdb/mocks/schema.surql', 'utf8');
	const surqlData = readFileSync('./tests/surrealdb/mocks/data.surql', 'utf8');

  // REF https://github.com/surrealdb/surrealdb.node/issues/26
  // This issue prevent us from creating multiple databases for test
	// const dbName = `${connector.dbName}_${nanoid()}`;
  // await db.query(`DEFINE NAMESPACE test; USE NS test; DEFINE DATABASE ${dbName};`);
  // await db.use({ database: dbName })
  const dbName = "test"

  const db = new Surreal();

  if(connector.provider !== "surrealDB"){
    throw new Error("incorrect provder")
  }

  await db.connect('ws://127.0.0.1:8000')
  await db.signin({
    namespace: 'test',
    database: 'test',
    username: connector.username,
    password: connector.password,
  })

	try {
		// const schemaSession = await client.session(dbName, SessionType.SCHEMA);
		// const dataSession = await client.session(dbName, SessionType.DATA);
		// const schemaTransaction = await schemaSession.transaction(TransactionType.WRITE);

		// await schemaTransaction.query.define(tqlSchema);
		// await schemaTransaction.commit();
		// await schemaTransaction.close();
		// await schemaSession.close();
		// const dataTransaction = await dataSession.transaction(TransactionType.WRITE);
		// await dataTransaction.query.insert(tqlData);
		// await dataTransaction.commit();
		// await dataTransaction.close();
		// await dataSession.close();
		//await client.close();

		// const bormClient = new BormClient({
		// 	schema: testSchema,
		// 	config: { ...testConfig, dbConnectors: [{ ...connector, dbName }] },
		// });
		// await bormClient.init();
		// return { bormClient, dbName }; //todo make this cleaner, probably as private function of bormCLient.databases for instance

    return { bormClient: true, dbName }
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
	const surrealDB = dbHandles?.surrealDB;
	// surrealDB?.forEach(async (db) => {
	// 	const database = await typeDB.client.databases.get(dbName);
	// 	await database.delete();
	// });

	await client.close();
};
