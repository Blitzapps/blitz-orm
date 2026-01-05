import Surreal from 'surrealdb';
import type BormClient from '../src';
import { setup } from '../tests/helpers/setup';
import { bench } from './bench';
import { type A, type B, type Base, generateData } from './generateData';
import { schema } from './schema.v2';

const URL = 'ws://127.0.0.1:8002';
const NAMESPACE = 'borm_bench';
const DATABASE = 'borm_bench';
const USERNAME = 'borm_bench';
const PASSWORD = 'borm_bench';

let client: BormClient;
let cleanup: () => Promise<void>;
let data: { a: A[]; b: B[] };

bench(async ({ beforeAll, afterAll, time }) => {
  beforeAll(async () => {
    const result = await setup({
      config: {
        server: {
          provider: 'blitz-orm-js',
        },
        dbConnectors: [
          {
            id: 'default',
            provider: 'surrealDB',
            providerConfig: { linkMode: 'refs' },
            url: URL,
            namespace: NAMESPACE,
            dbName: DATABASE,
            username: USERNAME,
            password: PASSWORD,
          },
        ],
      },
      schema,
    });
    client = result.client;
    cleanup = result.cleanup;
    console.log('Generating data');
    data = generateData({
      records: 1000,
      few: { min: 5, max: 5 },
      many: { min: 20, max: 20 },
      // records: 20,
      // few: { min: 1, max: 1 },
      // many: { min: 2, max: 2 },
    });
    console.log('Connecting to database');
    const surrealDB = await connect();
    console.log('Creating surql');
    const surql = createSurql(data);
    console.log('Inserting data');
    await surrealDB.query(surql);
  });

  afterAll(async () => {
    console.log('Cleaning up');
    await cleanup();
  });

  time('Select all, sort by string_1, and limit 100', async () => {
    await client.query({ $relation: 't_a', $limit: 100, $sort: [{ field: 'string_1', desc: true }] });
  });

  time('Filter by indexed field', async () => {
    const a = data.a[Math.floor(data.a.length / 2) + 1];
    await client.query({ $relation: 't_a', $filter: { string_1: a.string_1 } });
  });

  time('Filter by ref_one', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 2];
    await client.query({ $relation: 't_a', $filter: { ref_one: b.id } });
  });

  time('Filter by ref_many', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 3];
    await client.query({ $relation: 't_a', $filter: { ref_many: b.id } });
  });

  time('Filter by ref_one string_1', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 4];
    await client.query({ $relation: 't_a', $filter: { ref_one: { string_1: b.string_1 } } });
  });

  time('Filter by ref_many string_1', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 5];
    await client.query({ $relation: 't_a', $filter: { ref_many: { string_1: b.string_1 } } });
  });

  time('Filter by fut_one', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 6];
    await client.query({ $relation: 't_a', $filter: { fut_one: b.id } });
  });

  time('Filter by fut_many', async () => {
    const b = data.b[Math.floor(data.b.length / 2 + 7)];
    await client.query({ $relation: 't_a', $filter: { fut_many: b.id } });
  });

  time('Filter by fut_one string_1', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 8];
    await client.query({ $relation: 't_a', $filter: { fut_one: { string_1: b.string_1 } } });
  });

  time('Filter by fut_many string_1', async () => {
    const b = data.b[Math.floor(data.b.length / 2) + 9];
    await client.query({ $relation: 't_a', $filter: { fut_many: { string_1: b.string_1 } } });
  });
});

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
};

const createSurql = (data: { a: A[]; b: B[] }): string => {
  const lines = ['BEGIN TRANSACTION;'];

  for (const b of data.b) {
    lines.push(`CREATE t_b:${b.id} SET ${createSurqlBaseSet(b)};`);
  }

  for (const a of data.a) {
    const refFew = `[${a.few.map((i) => `t_b:${i}`).join(', ')}]`;
    const refMany = `[${a.many.map((i) => `t_b:${i}`).join(', ')}]`;

    const tunnelOneId = `${a.id}_${a.one}`;
    const tunnelFewIds = a.few.map((i) => `${a.id}_${i}`);
    const tunnelManyIds = a.many.map((i) => `${a.id}_${i}`);
    const tunnelOne = `tunnel_one:${tunnelOneId}`;
    const tunnelFew = `[${tunnelFewIds.map((i) => `tunnel_few:${i}`).join(', ')}]`;
    const tunnelMany = `[${tunnelManyIds.map((i) => `tunnel_many:${i}`).join(', ')}]`;

    lines.push(
      `CREATE t_a:${a.id} SET ${createSurqlBaseSet(a)}, ref_one = t_b:${a.one}, ref_few = ${refFew}, ref_many = ${refMany};`,
    );

    lines.push(`CREATE ${tunnelOne} SET a = t_a:${a.id}, b = t_b:${a.one};`);
    lines.push(`UPDATE t_b:${a.one} SET ref_one = t_a:${a.id}, tunnel_one = tunnel_one:${tunnelOneId};`);
    lines.push(`RELATE t_a:${a.id}->edge_one->t_b:${a.one};`);

    for (const b of a.few) {
      const tId = `${a.id}_${b}`;
      lines.push(`CREATE tunnel_few:${tId} SET a = t_a:${a.id}, b = t_b:${b};`);
      lines.push(`UPDATE t_b:${b} SET ref_few += t_a:${a.id}, tunnel_few += tunnel_few:${tId};`);
      lines.push(`RELATE t_a:${a.id}->edge_few->t_b:${b};`);
    }

    for (const b of a.many) {
      const tId = `${a.id}_${b}`;
      lines.push(`CREATE tunnel_many:${tId} SET a = t_a:${a.id}, b = t_b:${b};`);
      lines.push(`UPDATE t_b:${b} SET ref_many += t_a:${a.id}, tunnel_many += tunnel_many:${tId};`);
      lines.push(`RELATE t_a:${a.id}->edge_many->t_b:${b};`);
    }

    lines.push(
      `UPDATE t_a:${a.id} SET tunnel_one = ${tunnelOne}, tunnel_few = ${tunnelFew}, tunnel_many = ${tunnelMany};`,
    );
  }

  lines.push('COMMIT TRANSACTION;');

  return lines.join('\n');
};

const createSurqlBaseSet = (data: Base): string => {
  return `string_1 = "${data.string_1}", number_1 = ${data.number_1}, boolean_1 = ${data.boolean_1}, datetime_1 = type::datetime("${data.datetime_1.toISOString()}")`;
};
