const MAX_ITER = 10;
const MAX_DURATION = 60_000;

type BenchFn = (cb: () => Promise<void>) => void;

type TimeitFn = (name: string, cb: () => Promise<void>, opt?: BenchOptions) => void;

interface BenchOptions {
  maxIter?: number;
  maxDuration?: number;
}

export const bench = async (
  cb: (params: { beforeAll: BenchFn; afterAll: BenchFn; time: TimeitFn }) => Promise<void>,
  opt?: BenchOptions,
) => {
  const { maxIter = MAX_ITER, maxDuration = MAX_DURATION } = opt ?? {};
  const beforePromises: (() => Promise<void>)[] = [];
  const afterPromises: (() => Promise<void>)[] = [];
  const beforeAll = (cb: () => Promise<void>) => {
    beforePromises.push(cb);
  };
  const afterAll = (cb: () => Promise<void>) => {
    afterPromises.push(cb);
  };
  const variants: {
    name: string;
    cb: () => Promise<void>;
    durations: number[];
    totalDuration: number;
    maxIter: number;
    maxDuration: number;
  }[] = [];
  const time = (name: string, cb: () => Promise<void>, opt?: BenchOptions) => {
    variants.push({
      name,
      cb,
      durations: [],
      totalDuration: 0,
      maxIter: opt?.maxIter ?? maxIter,
      maxDuration: opt?.maxDuration ?? maxDuration,
    });
  };

  await cb({ beforeAll, afterAll, time });

  await Promise.all(beforePromises.map(async (cb) => cb()));

  for (const variant of variants) {
    console.log(`Running "${variant.name}"...`);
    while (variant.durations.length < variant.maxIter && variant.totalDuration < variant.maxDuration) {
      try {
        const start = performance.now();
        await variant.cb();
        const duration = performance.now() - start;
        variant.durations.push(duration);
        variant.totalDuration += duration;
      } catch (error) {
        console.error(`Error running "${variant.name}":`, error);
        break;
      }
    }
  }

  await Promise.all(afterPromises.map((cb) => cb()));

  const summary = summarize(variants);
  console.log(format(summary));
};

interface Summary {
  name: string;
  iter: number;
  first: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
}

const summarize = (variants: { name: string; durations: number[] }[]): Summary[] => {
  return variants.map((variant) => {
    const sorted = [...variant.durations].sort((a, b) => a - b);
    const total = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    const min = sorted[0] || 0;
    const max = sorted[count - 1] || 0;
    const mean = count > 0 ? total / count : 0;
    const median =
      count === 0
        ? 0
        : count % 2 === 0
          ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
          : sorted[Math.floor(count / 2)];

    const p90 = count === 0 ? 0 : sorted[Math.floor(count * 0.9)];
    const p95 = count === 0 ? 0 : sorted[Math.floor(count * 0.95)];

    return {
      name: variant.name,
      iter: variant.durations.length,
      first: variant.durations[0] ?? 0,
      min,
      max,
      mean,
      median,
      p90,
      p95,
    };
  });
};

const format = (summary: Summary[]): string => {
  const headers = ['name', 'iter', 'first', 'min', 'max', 'mean', 'median'] as const;

  const rows = summary.map((s) => ({
    name: s.name.slice(0, 50),
    iter: s.iter.toString(),
    first: s.first.toFixed(4),
    min: s.min.toFixed(4),
    max: s.max.toFixed(4),
    mean: s.mean.toFixed(4),
    median: s.median.toFixed(4),
  }));

  const allRows = [
    { name: 'name', iter: 'iter', first: 'first', min: 'min', max: 'max', mean: 'mean', median: 'median' },
    ...rows,
  ];

  const widths = headers.map((h) => Math.max(...allRows.map((r) => r[h].length)));

  return allRows
    .map((row) =>
      headers.map((h, i) => (h === 'name' ? row[h].padEnd(widths[i]) : row[h].padStart(widths[i]))).join(' | '),
    )
    .join('\n');
};
