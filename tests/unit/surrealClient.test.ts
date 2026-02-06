import { ConnectionStatus } from 'surrealdb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SurrealClient } from '../../src/adapters/surrealDB/client';

const TEST_CONFIG = {
  url: 'ws://127.0.0.1:8100',
  namespace: 'test_refs', // Matches test.sh setup
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
    await client.close().catch(() => undefined);
  }
};

describe('SurrealClient', () => {
  describe('close behavior', () => {
    const closedClientOps = [
      ['connect', (c: SurrealClient) => c.connect()],
      ['query', (c: SurrealClient) => c.query('SELECT 1')],
      ['queryRaw', (c: SurrealClient) => c.queryRaw('SELECT 1')],
    ] as const;

    it.each(closedClientOps)('should throw when calling %s after close', async (_, op) => {
      const client = new SurrealClient(TEST_CONFIG);
      await client.close();
      await expect(op(client)).rejects.toThrow('Client has been closed');
    });
  });

  describe('connection behavior', () => {
    it('should fail immediately on connection error (no retry with backoff)', async () => {
      const startTime = Date.now();

      await expect(withClient(INVALID_CONFIG, (c) => c.connect())).rejects.toThrow();

      expect(Date.now() - startTime).toBeLessThan(5000);
    });

    it('should deduplicate concurrent connect calls', async () => {
      await withClient(INVALID_CONFIG, async (client) => {
        const results = await Promise.allSettled([client.connect(), client.connect(), client.connect()]);
        expect(results.every((r) => r.status === 'rejected')).toBe(true);
      });
    });

    it('should connect successfully to running database', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        await client.connect();
        expect(client.status).toBe(ConnectionStatus.Connected);
      });
    });

    it('should auto-connect on first query', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        const result = await client.query<number>('RETURN 42');
        expect(result).toEqual([42]);
        expect(client.status).toBe(ConnectionStatus.Connected);
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
      await client.close().catch(() => undefined);
    });

    it('should return [value] for RETURN queries', async () => {
      expect(await client.query<number>('RETURN 42')).toEqual([42]);
    });

    it('should return [[records]] for SELECT queries', async () => {
      const table = `test_${Date.now()}`;
      await client.query(`CREATE ${table}:a SET name = 'a'`);
      await client.query(`CREATE ${table}:b SET name = 'b'`);

      const result = await client.query<{ name: string }[]>(`SELECT name FROM ${table}`);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
      expect(result[0].every((r) => 'name' in r)).toBe(true);

      await client.query(`DELETE ${table}`);
    });

    it('should return multiple results for multi-statement queries', async () => {
      expect(await client.query<number>('RETURN 1; RETURN 2; RETURN 3')).toEqual([1, 2, 3]);
    });

    it('should handle query errors without disconnecting', async () => {
      await expect(client.query('INVALID SYNTAX')).rejects.toThrow();
      expect(client.status).toBe(ConnectionStatus.Connected);
      expect(await client.query<number>('RETURN 1')).toEqual([1]);
    });
  });

  describe('queryRaw behavior', () => {
    it('should return results with metadata', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        const result = await client.queryRaw('RETURN 42');
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('status');
        expect(result[0]).toHaveProperty('result');
      });
    });
  });

  describe('reconnection behavior', () => {
    it('should handle sequential queries', async () => {
      await withClient(TEST_CONFIG, async (client) => {
        for (let i = 0; i < 5; i++) {
          expect(await client.query<number>(`RETURN ${i}`)).toEqual([i]);
        }
      });
    });

    it('should handle concurrent queries', async () => {
      await withClient(TEST_CONFIG, async (client) => {
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
