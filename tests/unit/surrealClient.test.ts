import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SurrealClient } from '../../src/adapters/surrealDB/client';

const TEST_CONFIG = {
  url: 'ws://127.0.0.1:8100',
  namespace: 'test_refs',
  database: 'test',
  username: 'test',
  password: 'test',
};

const INVALID_CONFIG = { ...TEST_CONFIG, url: 'http://127.0.0.1:59999' };

const withClient = async <T>(config: typeof TEST_CONFIG, fn: (client: SurrealClient) => Promise<T>): Promise<T> => {
  const client = new SurrealClient(config);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
};

describe('SurrealClient', () => {
  describe('close behavior', () => {
    const operations = [
      ['connect', (c: SurrealClient) => c.connect()],
      ['query', (c: SurrealClient) => c.query('SELECT 1')],
    ] as const;

    it.each(operations)('throws when calling %s after close', async (_, op) => {
      const client = new SurrealClient(TEST_CONFIG);
      await client.close();
      await expect(op(client)).rejects.toThrow('Client has been closed');
    });
  });

  describe('connection behavior', () => {
    it('fails immediately on connection error', async () => {
      const start = Date.now();
      await expect(withClient(INVALID_CONFIG, (c) => c.connect())).rejects.toThrow();
      expect(Date.now() - start).toBeLessThan(5000);
    });

    it('deduplicates concurrent connect calls', async () => {
      await withClient(INVALID_CONFIG, async (client) => {
        const results = await Promise.allSettled([client.connect(), client.connect(), client.connect()]);
        expect(results.every((r) => r.status === 'rejected')).toBe(true);
      });
    });

    it('connects successfully to running database', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        expect(client.state).toBe('disconnected');
        await client.connect();
        expect(client.state).toBe('connected');
        expect(client.version).toBeTruthy();
      });
    });

    it('tracks latestError on connection failure', async () => {
      await withClient(INVALID_CONFIG, async (client) => {
        await client.connect().catch(() => {});
        expect(client.latestError).toBeTruthy();
      });
    });

    it('requires explicit connect before query (SDK 2.0)', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        await expect(client.query('RETURN 42')).rejects.toThrow();
      });
    });
  });

  describe('query behavior', () => {
    let client: SurrealClient;

    beforeEach(async () => {
      client = new SurrealClient(TEST_CONFIG);
      await client.connect();
    });

    afterEach(async () => {
      await client.close().catch(() => {});
    });

    it('returns [value] for RETURN queries', async () => {
      expect(await client.query<number>('RETURN 42')).toEqual([42]);
    });

    it('returns [[records]] for SELECT queries', async () => {
      const table = `test_${Date.now()}`;
      await client.query(`CREATE ${table}:a SET name = 'a'`);
      await client.query(`CREATE ${table}:b SET name = 'b'`);

      const result = await client.query<{ name: string }[]>(`SELECT name FROM ${table}`);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0].every((r) => 'name' in r)).toBe(true);

      await client.query(`DELETE ${table}`);
    });

    it('returns multiple results for multi-statement queries', async () => {
      expect(await client.query<number>('RETURN 1; RETURN 2; RETURN 3')).toEqual([1, 2, 3]);
    });

    it('handles query errors without disconnecting', async () => {
      await expect(client.query('INVALID SYNTAX')).rejects.toThrow();
      expect(client.state).toBe('connected');
      expect(await client.query<number>('RETURN 1')).toEqual([1]);
    });
  });

  describe('multiple queries', () => {
    it('handles sequential queries', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        await client.connect();
        for (let i = 0; i < 5; i++) {
          expect(await client.query<number>(`RETURN ${i}`)).toEqual([i]);
        }
      });
    });

    it('handles concurrent queries', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        await client.connect();
        const results = await Promise.all([
          client.query<number>('RETURN 1'),
          client.query<number>('RETURN 2'),
          client.query<number>('RETURN 3'),
        ]);
        expect(results.map((r) => r[0]).sort()).toEqual([1, 2, 3]);
      });
    });
  });
});
