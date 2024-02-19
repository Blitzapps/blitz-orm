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

  await db.connect(connector.url)
  await db.signin({
    namespace: connector.namespace,
    database: connector.dbName,
    username: connector.username,
    password: connector.password,
  })

	try {
    // FIXME cannot add schema in runtime due to this issue. Wait for it to be fixed, https://github.com/surrealdb/surrealdb/issues/3541
    await db.query(surqlSchema)

    await db.query(`BEGIN TRANSACTION;
    INSERT INTO User {
      name: 'hello',
      email: 'email@example.com'
    };
    COMMIT TRANSACTION;`)

		const bormClient = new BormClient({
			schema: testSchema,
			config: { ...testConfig, dbConnectors: [{ ...connector, dbName }] },
		});
		await bormClient.init();
		return { bormClient, dbName }; //todo make this cleaner, probably as private function of bormCLient.databases for instance
	} catch (e: any) {
    console.error('failed to init', e)
		throw new Error(e.message);
	}
};

export const cleanup = async (client: BormClient, dbName: string) => {
	if (!client) {
		throw new Error('Client is undefined');
	}

	const dbHandles = client.getDbHandles();
	const surrealDB = dbHandles?.surrealDB;
	surrealDB?.forEach(async (db) => {
    // FIXME another bug, varaible replace is documented, but not working as expected
    // await db.client.query(`REMOVE DATABASE $name;`, {
    //   name: dbName
    // })

    // NOTE no cleanup, as we want to run the test again and we have to manually open sql shell now
    // await db.client.query(`REMOVE DATABASE ${dbName};`)
	});

	await client.close();
};
