import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Surreal } from 'surrealdb';
import { genAlphaId } from '../../src/helpers';
import { bench } from '../bench';

const DB_URL = 'ws://127.0.0.1:8101';
const NAMESPACE = 'borm_bench';
const DATABASE = 'borm_bench';
const USERNAME = 'borm_bench';
const PASSWORD = 'borm_bench';
const CONTAINER_NAME = 'borm_bench_queries';
const CONTAINER_ENDPOINT = 'http://localhost:8101';
const SCHEMA_FILE = fileURLToPath(new globalThis.URL('./schema.surql', import.meta.url));

let client: Surreal;
let data: { a: A[]; b: B[] };

bench(async ({ beforeAll, afterAll, time }) => {
  beforeAll(async () => {
    console.log('Generating data');
    data = generateData({
      records: 1000,
      many: { min: 20, max: 20 },
    });
    await runContainer();
    console.log('Connecting to database');
    client = await createClient();
    console.log('Creating surql');
    const surql = createSurql(data);
    console.log('Inserting data');
    await client.query(surql);
  });

  afterAll(async () => {
    console.log('Cleaning up');
    await client.close();
    await stopContainer();
  });

  time('Select all, sort by string_1, and limit 100', async () => {
    await client.query('SELECT * FROM t_a ORDER BY indexed DESC LIMIT 100');
  });

  time('Filter by id', async () => {
    const a = pick(data.a);
    await client.query(`SELECT * FROM t_a:${a.id}`);
  });

  time('Filter by multiple ids', async () => {
    const a1 = pick(data.a);
    const a2 = pick(data.a);
    const a3 = pick(data.a);
    await client.query(`SELECT * FROM t_a WHERE id IN [t_a:${a1.id}, t_a:${a2.id}, t_a:${a3.id}]`);
  });

  time('Filter by indexed field', async () => {
    const a = pick(data.a);
    await client.query(`SELECT * FROM t_a WHERE indexed = "${a.indexed}"`);
  });

  time('Filter by non-indexed field', async () => {
    const a = pick(data.a);
    await client.query(`SELECT * FROM t_a WHERE non_indexed = "${a.nonIndexed}"`);
  });

  time('Filter by multiple values of an indexed field', async () => {
    const a1 = pick(data.a);
    const a2 = pick(data.a);
    const a3 = pick(data.a);
    await client.query(`SELECT * FROM t_a WHERE indexed IN ["${a1.indexed}", "${a2.indexed}", "${a3.indexed}"]`);
  });

  time('Filter by multiple values of an non-indexed field', async () => {
    const a1 = pick(data.a);
    const a2 = pick(data.a);
    const a3 = pick(data.a);
    await client.query(
      `SELECT * FROM t_a WHERE non_indexed IN ["${a1.nonIndexed}", "${a2.nonIndexed}", "${a3.nonIndexed}"]`,
    );
  });

  time('Filter by ref_one', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE ref_one = t_b:${b.id}`);
  });

  time('Filter by fut_one', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE fut_one = t_b:${b.id}`);
  });

  time('Filter by edge_one', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE ->edge_one->t_b CONTAINS t_b:${b.id}`);
  });

  time('Filter by ref_many', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE ref_many CONTAINS t_b:${b.id}`);
  });

  time('Filter by fut_many', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE fut_many CONTAINS t_b:${b.id}`);
  });

  time('Filter by edge_many', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE ->edge_many->t_b CONTAINS t_b:${b.id}`);
  });

  time('Filter by ref_one string_1', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE ref_one IN (SELECT VALUE id FROM t_b WHERE indexed = "${b.indexed}")`);
  });

  time('Filter by fut_one string_1', async () => {
    const b = pick(data.b);
    await client.query(`SELECT * FROM t_a WHERE fut_one IN (SELECT VALUE id FROM t_b WHERE indexed = "${b.indexed}")`);
  });

  time('Filter by edge_one string_1', async () => {
    const b = pick(data.b);
    await client.query(
      `SELECT * FROM t_a WHERE array::first(->edge_one->t_b) IN (SELECT VALUE id FROM t_b WHERE indexed = "${b.indexed}")`,
    );
  });

  time('Filter by ref_many string_1', async () => {
    const b = pick(data.b);
    await client.query(
      `SELECT * FROM t_a WHERE array::len(array::intersect(ref_many, (SELECT VALUE id FROM t_b WHERE indexed = "${b.indexed}"))) > 0`,
    );
  });

  time('Filter by fut_many string_1', async () => {
    const b = pick(data.b);
    await client.query(
      `SELECT * FROM t_a WHERE array::len(array::intersect(fut_many, (SELECT VALUE id FROM t_b WHERE indexed = "${b.indexed}"))) > 0`,
    );
  });

  time('Filter by edge_many string_1', async () => {
    const b = pick(data.b);
    await client.query(
      `SELECT * FROM t_a WHERE array::len(array::intersect(->edge_many->t_b, (SELECT VALUE id FROM t_b WHERE indexed = "${b.indexed}"))) > 0`,
    );
  });

  time('Filter by multiple ref_one', async () => {
    const [b1, b2, b3] = [pick(data.b), pick(data.b), pick(data.b)];
    await client.query(`SELECT * FROM t_a WHERE ref_one IN [t_b:${b1.id}, t_b:${b2.id}, t_b:${b3.id}]`);
  });

  time('Filter by multiple fut_one', async () => {
    const [b1, b2, b3] = [pick(data.b), pick(data.b), pick(data.b)];
    await client.query(`SELECT * FROM t_a WHERE fut_one IN [t_b:${b1.id}, t_b:${b2.id}, t_b:${b3.id}]`);
  });

  time('Filter by multiple edge_one', async () => {
    const [b1, b2, b3] = [pick(data.b), pick(data.b), pick(data.b)];
    await client.query(
      `SELECT * FROM t_a WHERE array::first(->edge_one->t_b) IN [t_b:${b1.id}, t_b:${b2.id}, t_b:${b3.id}]`,
    );
  });

  time('Filter by multiple ref_many', async () => {
    const [b1, b2, b3] = [pick(data.b), pick(data.b), pick(data.b)];
    await client.query(
      `SELECT * FROM t_a WHERE array::len(array::intersect(ref_many, [t_b:${b1.id}, t_b:${b2.id}, t_b:${b3.id}])) > 0`,
    );
  });

  time('Filter by multiple fut_many', async () => {
    const [b1, b2, b3] = [pick(data.b), pick(data.b), pick(data.b)];
    await client.query(
      `SELECT * FROM t_a WHERE array::len(array::intersect(fut_many, [t_b:${b1.id}, t_b:${b2.id}, t_b:${b3.id}])) > 0`,
    );
  });

  time('Filter by multiple edge_many', async () => {
    const [b1, b2, b3] = [pick(data.b), pick(data.b), pick(data.b)];
    await client.query(
      `SELECT * FROM t_a WHERE array::len(array::intersect(->edge_many->t_b, [t_b:${b1.id}, t_b:${b2.id}, t_b:${b3.id}])) > 0`,
    );
  });

  time('Nested ref_one', async () => {
    const a = pick(data.a);
    await client.query(`SELECT *, (SELECT * FROM ref_one) AS nested FROM t_a:${a.id}`);
  });

  time('Nested fut_one', async () => {
    const a = pick(data.a);
    await client.query(`SELECT *, (SELECT * FROM fut_one) AS nested FROM t_a:${a.id}`);
  });

  time('Nested edge_one', async () => {
    const a = pick(data.a);
    await client.query(`SELECT *, (SELECT * FROM ->edge_one->t_b) AS nested FROM t_a:${a.id}`);
  });

  time('Nested ref_many', async () => {
    const a = pick(data.a);
    await client.query(`SELECT *, (SELECT * FROM ref_many) AS nested FROM t_a:${a.id}`);
  });

  time('Nested fut_many', async () => {
    const a = pick(data.a);
    await client.query(`SELECT *, (SELECT * FROM fut_many) AS nested FROM t_a:${a.id}`);
  });

  time('Nested edge_many', async () => {
    const a = pick(data.a);
    await client.query(`SELECT *, (SELECT * FROM ->edge_many->t_b) AS nested FROM t_a:${a.id}`);
  });
})
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

const createClient = async () => {
  const db = new Surreal();
  await db.connect(DB_URL, {
    namespace: NAMESPACE,
    database: DATABASE,
    versionCheck: false,
    reconnect: {
      enabled: false,
    },
    authentication: async () => ({ username: USERNAME, password: PASSWORD }),
  });
  return db;
};

export interface Base {
  id: string;
  indexed: string;
  nonIndexed: string;
}

export interface A extends Base {
  one: B['id'];
  many: B['id'][];
}

export type B = Base;

export const generateData = (params: { records: number; many: { min: number; max: number } }): { a: A[]; b: B[] } => {
  const a: A[] = [];
  const b: B[] = [];

  for (let i = 0; i < params.records; i++) {
    b.push(generateBase());
  }

  for (let i = 0; i < params.records; i++) {
    const manyLength = randomInt(params.many.min, params.many.max);
    const manySet = new Set<string>();

    while (manySet.size < manyLength && manySet.size < b.length) {
      manySet.add(b[randomInt(0, b.length - 1)].id);
    }

    a.push({
      ...generateBase(),
      one: b[i].id,
      many: Array.from(manySet),
    });
  }

  return { a, b };
};

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(items: T[]) => items[randomInt(0, items.length - 1)];

const randomString = (min: number, max: number) => {
  return genAlphaId(randomInt(min, max));
};

const generateBase = (): Base => ({
  id: genAlphaId(16),
  indexed: randomString(10, 20),
  nonIndexed: randomString(10, 20),
});

const createSurql = (data: { a: A[]; b: B[] }): string => {
  const lines = ['BEGIN TRANSACTION;'];

  for (const b of data.b) {
    lines.push(`CREATE t_b:${b.id} SET ${createSurqlBaseSet(b)};`);
  }

  for (const a of data.a) {
    const refMany = `[${a.many.map((i) => `t_b:${i}`).join(', ')}]`;

    const tunnelOneId = `${a.id}_${a.one}`;
    const tunnelManyIds = a.many.map((i) => `${a.id}_${i}`);
    const tunnelOne = `tunnel_one:${tunnelOneId}`;
    const tunnelMany = `[${tunnelManyIds.map((i) => `tunnel_many:${i}`).join(', ')}]`;

    lines.push(`CREATE t_a:${a.id} SET ${createSurqlBaseSet(a)}, ref_one = t_b:${a.one}, ref_many = ${refMany};`);

    lines.push(`CREATE ${tunnelOne} SET a = t_a:${a.id}, b = t_b:${a.one};`);
    lines.push(`UPDATE t_b:${a.one} SET ref_one = t_a:${a.id}, tunnel_one = tunnel_one:${tunnelOneId};`);
    lines.push(`RELATE t_a:${a.id}->edge_one->t_b:${a.one};`);

    for (const b of a.many) {
      const tId = `${a.id}_${b}`;
      lines.push(`CREATE tunnel_many:${tId} SET a = t_a:${a.id}, b = t_b:${b};`);
      lines.push(`UPDATE t_b:${b} SET ref_many += t_a:${a.id}, tunnel_many += tunnel_many:${tId};`);
      lines.push(`RELATE t_a:${a.id}->edge_many->t_b:${b};`);
    }

    lines.push(`UPDATE t_a:${a.id} SET tunnel_one = ${tunnelOne}, tunnel_many = ${tunnelMany};`);
  }

  lines.push('COMMIT TRANSACTION;');

  return lines.join('\n');
};

const createSurqlBaseSet = (data: Base): string => {
  return `indexed = "${data.indexed}", non_indexed = "${data.nonIndexed}"`;
};

const runContainer = async () => {
  await stopContainer();

  await runCommand('docker', [
    'run',
    '--rm',
    '--detach',
    '--name',
    CONTAINER_NAME,
    '-e',
    'SURREAL_CAPS_ALLOW_EXPERIMENTAL=graphql',
    '--user',
    'root',
    '-p',
    '8101:8101',
    '--pull',
    'always',
    'surrealdb/surrealdb:v2',
    'start',
    '-u',
    USERNAME,
    '-p',
    PASSWORD,
    '--bind',
    '0.0.0.0:8101',
    'rocksdb:///data/blitz.db',
  ]);

  await waitUntil(
    async () => {
      try {
        const output = await runCommand('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER_NAME]);
        return output.trim() === 'true';
      } catch {
        return false;
      }
    },
    100,
    5000,
    'Timed out waiting for container to be running',
  );

  await waitUntil(
    async () => {
      try {
        await runCommand('docker', ['exec', CONTAINER_NAME, './surreal', 'is-ready', '--endpoint', CONTAINER_ENDPOINT]);
        return true;
      } catch {
        return false;
      }
    },
    500,
    30000,
    'Timed out waiting for SurrealDB to be ready',
  );

  await runCommand(
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
      CONTAINER_ENDPOINT,
    ],
    [
      `DEFINE NAMESPACE ${NAMESPACE};`,
      `USE NS ${NAMESPACE};`,
      `DEFINE DATABASE ${DATABASE};`,
      `DEFINE USER ${USERNAME} ON NAMESPACE PASSWORD '${PASSWORD}' ROLES OWNER;`,
      '',
    ].join('\n'),
  );

  await runCommand('docker', ['cp', SCHEMA_FILE, `${CONTAINER_NAME}:/tmp/schema.surql`]);

  await runCommand('docker', [
    'exec',
    '-i',
    CONTAINER_NAME,
    './surreal',
    'import',
    '-u',
    USERNAME,
    '-p',
    PASSWORD,
    '--namespace',
    NAMESPACE,
    '--database',
    DATABASE,
    '--endpoint',
    CONTAINER_ENDPOINT,
    '/tmp/schema.surql',
  ]);
};

const stopContainer = async () => {
  try {
    await runCommand('docker', ['rm', '-f', CONTAINER_NAME]);
  } catch {
    // Container may not exist; that's fine for cleanup.
  }
};

const waitUntil = async (
  condition: () => Promise<boolean>,
  intervalMs: number,
  timeoutMs: number,
  timeoutMessage: string,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(timeoutMessage);
};

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const runCommand = async (command: string, args: string[], stdin?: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}: ${stderr || stdout}`));
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
};
