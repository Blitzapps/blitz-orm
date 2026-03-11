import { execSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Surreal } from 'surrealdb';
import { bench } from './bench';
import { type A, type B, type Base, generateData } from './generateData';

const CONTAINER_NAME = 'borm_bench_v3';
const PORT = 8101;
const URL = `ws://127.0.0.1:${PORT}`;
const NAMESPACE = 'borm_bench';
const DATABASE = 'borm_bench';
const USERNAME = 'borm_bench';
const PASSWORD = 'borm_bench';
const SCHEMA_FILE = resolve(__dirname, 'schema.v3.surql');
const IMAGE = 'surrealdb/surrealdb:v3';

// Docker helpers

const exec = (cmd: string) => execSync(cmd, { stdio: 'pipe' }).toString().trim();

const stopContainer = () => {
  try {
    exec(`docker stop ${CONTAINER_NAME}`);
  } catch {
    // container may not exist
  }
};

const startContainer = () => {
  stopContainer();
  console.log('Starting SurrealDB v3 container...');
  exec(
    `docker run --rm --detach --name ${CONTAINER_NAME} --user root -p ${PORT}:${PORT} --pull always ${IMAGE} start -u ${USERNAME} -p ${PASSWORD} --bind 0.0.0.0:${PORT} rocksdb:///data/blitz.db`,
  );
};

const waitForReady = async (timeoutMs = 30_000) => {
  console.log('Waiting for SurrealDB to be ready...');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      exec(`docker exec ${CONTAINER_NAME} ./surreal is-ready --endpoint http://localhost:${PORT}`);
      console.log('SurrealDB is ready!');
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`SurrealDB did not become ready within ${timeoutMs / 1000}s`);
};

const setupDatabase = () => {
  console.log('Setting up database...');
  const sql = [
    `DEFINE NAMESPACE ${NAMESPACE};`,
    `USE NS ${NAMESPACE};`,
    `DEFINE DATABASE ${DATABASE};`,
    `DEFINE USER ${USERNAME} ON NAMESPACE PASSWORD '${PASSWORD}' ROLES OWNER;`,
  ].join('\n');
  const proc = spawn(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER_NAME,
      './surreal',
      'sql',
      '-u',
      USERNAME,
      '-p',
      PASSWORD,
      '--endpoint',
      `http://localhost:${PORT}`,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  proc.stdin.write(sql);
  proc.stdin.end();
  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Setup exited with ${code}`))));
  });
};

const importSchema = () => {
  console.log('Importing schema...');
  exec(`docker cp ${SCHEMA_FILE} ${CONTAINER_NAME}:/tmp/schema.surql`);
  exec(
    `docker exec ${CONTAINER_NAME} ./surreal import -u ${USERNAME} -p ${PASSWORD} --namespace ${NAMESPACE} --database ${DATABASE} --endpoint http://localhost:${PORT} /tmp/schema.surql`,
  );
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// SurrealDB connection

const connect = async (): Promise<Surreal> => {
  const db = new Surreal();
  await db.connect(URL, {
    namespace: NAMESPACE,
    database: DATABASE,
    authentication: async () => ({ username: USERNAME, password: PASSWORD }),
    versionCheck: false,
  });
  return db;
};

// Data insertion

const insertData = async (db: Surreal, data: { a: A[]; b: B[] }) => {
  console.log('Inserting data...');
  const lines = ['BEGIN TRANSACTION;'];

  for (const b of data.b) {
    lines.push(`CREATE t_b:${b.id} SET ${baseSet(b)};`);
  }

  for (const a of data.a) {
    const refFew = `[${a.few.map((i) => `t_b:${i}`).join(', ')}]`;
    const refMany = `[${a.many.map((i) => `t_b:${i}`).join(', ')}]`;

    lines.push(
      `CREATE t_a:${a.id} SET ${baseSet(a)}, ref_one = t_b:${a.one}, ref_few = ${refFew}, ref_many = ${refMany};`,
    );

    // Edges
    lines.push(`RELATE t_a:${a.id}->t_a_b_one->t_b:${a.one};`);
    for (const b of a.few) {
      lines.push(`RELATE t_a:${a.id}->t_a_b_few->t_b:${b};`);
    }
    for (const b of a.many) {
      lines.push(`RELATE t_a:${a.id}->t_a_b_many->t_b:${b};`);
    }
  }

  lines.push('COMMIT TRANSACTION;');

  await db.query(lines.join('\n'));
};

const baseSet = (d: Base): string => {
  return `string_1 = "${d.string_1}", number_1 = ${d.number_1}, boolean_1 = ${d.boolean_1}, datetime_1 = type::datetime("${d.datetime_1.toISOString()}")`;
};

const randIndex = (len: number) => Math.floor(Math.random() * len);

// Main

let db: Surreal;
let data: { a: A[]; b: B[] };

bench(async ({ beforeAll, afterAll, time }) => {
  beforeAll(async () => {
    startContainer();
    await waitForReady();
    await setupDatabase();
    importSchema();

    db = await connect();

    console.log('Generating data...');
    data = generateData({ records: 1000, few: { min: 5, max: 5 }, many: { min: 20, max: 20 } });

    await insertData(db, data);
    console.log('Data inserted. Starting benchmark...\n');
  });

  afterAll(async () => {
    console.log('\nStopping container...');
    db.close();
    stopContainer();
  });

  // ---------------------------------------------------------------
  // ONE: Get all t_[a|b] where _one has string_1 = X
  // ---------------------------------------------------------------

  time('[ref][one] Get t_a where ref_one.string_1 = val', async () => {
    const b = data.b[randIndex(data.b.length)];
    await db.query(`SELECT * FROM t_a WHERE ref_one[WHERE string_1 = "${b.string_1}"]`);
  });

  time('[computed][one] Get t_b where computed_one.string_1 = val', async () => {
    const a = data.a[randIndex(data.a.length)];
    await db.query(`SELECT * FROM t_b WHERE computed_one[WHERE string_1 = "${a.string_1}"]`);
  });

  time('[edge][one] Get t_b where <-t_a_b_one<-t_a.string_1 = val', async () => {
    const a = data.a[randIndex(data.a.length)];
    await db.query(`SELECT * FROM t_b WHERE <-t_a_b_one<-t_a[WHERE string_1 = "${a.string_1}"]`);
  });

  // ---------------------------------------------------------------
  // MANY: Get all t_[a|b] where _many has string_1 = X
  // ---------------------------------------------------------------

  time('[ref][many] Get t_a where ref_many.string_1 = val', async () => {
    const b = data.b[randIndex(data.b.length)];
    await db.query(`SELECT * FROM t_a WHERE ref_many[WHERE string_1 = "${b.string_1}"]`);
  });

  time('[computed][many] Get t_b where computed_many.string_1 = val', async () => {
    const a = data.a[randIndex(data.a.length)];
    await db.query(`SELECT * FROM t_b WHERE computed_many[WHERE string_1 = "${a.string_1}"]`);
  });

  time('[edge][many] Get t_b where <-t_a_b_many<-t_a.string_1 = val', async () => {
    const a = data.a[randIndex(data.a.length)];
    await db.query(`SELECT * FROM t_b WHERE <-t_a_b_many<-t_a[WHERE string_1 = "${a.string_1}"]`);
  });
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    stopContainer();
    process.exit(1);
  });
