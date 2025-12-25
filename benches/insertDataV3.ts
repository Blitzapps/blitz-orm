import Surreal from 'surrealdb';

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
    // console.log(surql);
    console.log('inserting data');
    const start = performance.now();
    const result = await db.query(surql);
    const end = performance.now();
    console.log(`Time taken: ${end - start} milliseconds`);
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

interface Base {
  id: string;
  string_1: string;
  number_1: number;
  boolean_1: boolean;
  datetime_1: Date;
}

interface A  extends Base {
  one: B['id'];
  few: B['id'][];
  many: B['id'][];
}

type B = Base;

const generateData = (params: {
  records: number;
  few: { min: number; max: number };
  many: { min: number; max: number };
}): { a: A[]; b: B[]; } => {
  const a: A[] = [];
  const b: B[] = [];

  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomString = (min: number, max: number) => {
      const length = randomInt(min, max);
      let result = '';
      for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
  };
  const randomBoolean = () => Math.random() < 0.5;
  const randomDate = () => {
      const start = new Date('2020-01-01').getTime();
      const end = new Date('2026-01-01').getTime();
      return new Date(start + Math.random() * (end - start));
  };

  const generateBase = (): Base => ({
      id: uid(),
      string_1: randomString(10, 100),
      number_1: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      boolean_1: randomBoolean(),
      datetime_1: randomDate(),
  });

  for (let i = 0; i < params.records; i++) {
    b.push(generateBase());
  }

  for (let i = 0; i < params.records; i++) {
    const fewLength = randomInt(params.few.min, params.few.max);
    const manyLength = randomInt(params.many.min, params.many.max);
    const fewSet = new Set<string>();
    const manySet = new Set<string>();

    while (fewSet.size < fewLength) {
      fewSet.add(b[randomInt(0, b.length - 1)].id);
    }

    while (manySet.size < manyLength) {
      manySet.add(b[randomInt(0, b.length - 1)].id);
    }

    a.push({
      ...generateBase(),
      one: b[i].id,
      few: Array.from(fewSet),
      many: Array.from(manySet),
    });
  }

  return { a, b };
}

const uid = () => {
  const firstChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = firstChar.charAt(Math.floor(Math.random() * firstChar.length));
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const createSurql = (data: { a: A[]; b: B[]; }): string => {
  const lines = ['BEGIN TRANSACTION;'];

  for (const b of data.b) {
    lines.push(`CREATE t_b:${b.id} SET ${createSurqlBaseSet(b)};`);
  }

  for (const a of data.a) {
    const refFew = `[${a.few.map((i) => `t_b:${i}`).join(', ')}]`;
    const refMany = `[${a.many.map((i) => `t_b:${i}`).join(', ')}]`;
    lines.push(`CREATE t_a:${a.id} SET ${createSurqlBaseSet(a)}, ref_one = t_b:${a.one}, ref_few = ${refFew}, ref_many = ${refMany};`);
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

insertData().then(() => {
    console.log('Data inserted successfully');
}).catch((error) => {
    console.error('Error inserting data:', error);
});

