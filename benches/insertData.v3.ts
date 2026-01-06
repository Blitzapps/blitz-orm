import Surreal from 'surrealdb';
import { type A, type B, type Base, generateData } from './generateData';

const URL = 'ws://127.0.0.1:8001';
const NAMESPACE = 'borm_bench';
const DATABASE = 'borm_bench';
const USERNAME = 'borm_bench';
const PASSWORD = 'borm_bench';

const insertData = async () => {
  const db = await connect();
  console.log('generating data');
  const data = generateData({
    records: 10,
    few: { min: 2, max: 2 },
    many: { min: 2, max: 2 },
  });
  const surql = createSurql(data);
  console.log('inserting data');
  const start = performance.now();
  const result = await db.query(surql);
  const end = performance.now();
  console.log(`Time taken: ${end - start} milliseconds`);
  return result;
};

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
    lines.push(
      `CREATE t_a:${a.id} SET ${createSurqlBaseSet(a)}, ref_one = t_b:${a.one}, ref_few = ${refFew}, ref_many = ${refMany};`,
    );
    lines.push(`RELATE t_a:${a.id}->t_a_b_one->t_b:${a.one};`);
    for (const i of a.few) {
      lines.push(`RELATE t_a:${a.id}->t_a_b_few->t_b:${i};`);
    }
    for (const i of a.many) {
      lines.push(`RELATE t_a:${a.id}->t_a_b_many->t_b:${i};`);
    }
  }

  lines.push('COMMIT TRANSACTION;');

  return lines.join('\n');
};

const createSurqlBaseSet = (data: Base): string => {
  return `string_1 = "${data.string_1}", number_1 = ${data.number_1}, boolean_1 = ${data.boolean_1}, datetime_1 = type::datetime("${data.datetime_1.toISOString()}")`;
};

insertData()
  .then(() => {
    console.log('Data inserted successfully');
  })
  .catch((error) => {
    console.error('Error inserting data:', error);
  });
