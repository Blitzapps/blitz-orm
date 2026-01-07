import { genAlphaId } from '../src/helpers';

export interface Base {
  id: string;
  string_1: string;
  number_1: number;
  boolean_1: boolean;
  datetime_1: Date;
}

export interface A extends Base {
  one: B['id'];
  few: B['id'][];
  many: B['id'][];
}

export type B = Base;

export const generateData = (params: {
  records: number;
  few: { min: number; max: number };
  many: { min: number; max: number };
}): { a: A[]; b: B[] } => {
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
    id: genAlphaId(16),
    string_1: randomString(10, 20),
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

    while (fewSet.size < fewLength && fewSet.size < b.length) {
      fewSet.add(b[randomInt(0, b.length - 1)].id);
    }

    while (manySet.size < manyLength && manySet.size < b.length) {
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
};
