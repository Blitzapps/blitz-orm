
import Surreal from 'surrealdb';

const URL = 'ws://127.0.0.1:8001';
const NAMESPACE = 'borm_bench';
const DATABASE = 'borm_bench';
const USERNAME = 'borm_bench';
const PASSWORD = 'borm_bench';

const query = async () => {
    const db = await connect();
    const result = await db.query(
      'SELECT id FROM type::table($table) WHERE id = type::record($id) LIMIT 2',
      {
        table: 't_a',
        id: 't_a:A0HE7yuafcaZYxFd',
        // alias: 'tableId',
        b: [true],
      }
    );
    console.log(JSON.stringify(result, null, 2));
    return result;
}

const connect = async () => {
    const db = new Surreal();
    await db.connect(URL, {
      namespace: NAMESPACE,
      database: DATABASE,
      auth: {
        username: USERNAME,
        password: PASSWORD,
      },
      versionCheck: false,
    });
    return db;
}

query().then(() => {
    process.exit(0);
});