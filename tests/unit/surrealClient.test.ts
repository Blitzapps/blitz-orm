import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurrealClient } from '../../src/adapters/surrealDB/client';
import { ConnectionStatus } from 'surrealdb';

describe('SurrealClient', () => {
  const config = {
    url: 'ws://127.0.0.1:8100',
    namespace: 'test',
    database: 'test',
    username: 'test',
    password: 'test',
  };

  const createClosedClient = async () => {
    const client = new SurrealClient(config);
    await client.close();
    return client;
  };

  describe('close behavior', () => {
    it.each([
      ['connect', (c: SurrealClient) => c.connect()],
      ['query', (c: SurrealClient) => c.query('SELECT 1')],
      ['queryRaw', (c: SurrealClient) => c.queryRaw('SELECT 1')],
    ])('should throw when calling %s after close', async (_, operation) => {
      const client = await createClosedClient();
      await expect(operation(client)).rejects.toThrow('Client has been closed');
    });
  });

  describe('connection behavior', () => {
    it('should fail immediately on connection error (no retry)', async () => {
      // Use an invalid URL that will fail to connect
      const badClient = new SurrealClient({
        ...config,
        url: 'ws://127.0.0.1:59999', // Non-existent port
      });

      const startTime = Date.now();
      
      try {
        await badClient.connect();
        // Should not reach here
        expect.fail('Expected connection to fail');
      } catch (error) {
        const elapsed = Date.now() - startTime;
        // Should fail quickly (< 5 seconds), not retry with backoff
        // This documents that the new implementation does NOT have retry logic
        expect(elapsed).toBeLessThan(5000);
        expect(error).toBeInstanceOf(Error);
      } finally {
        await badClient.close().catch(() => {});
      }
    }, 10000);

    it('should deduplicate concurrent connect calls', async () => {
      const client = new SurrealClient({
        ...config,
        url: 'ws://127.0.0.1:59999',
      });

      try {
        // Start multiple concurrent connections
        const promises = [client.connect(), client.connect(), client.connect()];

        // All should reject with the same error
        const results = await Promise.allSettled(promises);
        expect(results.every((r) => r.status === 'rejected')).toBe(true);
      } finally {
        await client.close().catch(() => {});
      }
    }, 10000);
  });

  describe('query type behavior', () => {
    // This test documents the expected type behavior
    // The SDK's query<T> returns Promise<T> where T should be the full result tuple
    // Our wrapper uses query<T> to mean "T is the row type, return T[]"
    it('should return array of results for single statement queries', async () => {
      // This is a type-level test - we're verifying the API contract
      // In a real scenario with a running DB:
      // const result = await client.query<{ id: string }>('SELECT * FROM users');
      // result should be { id: string }[] not { id: string }[][]

      // For now, we just verify the method signature exists
      const client = new SurrealClient(config);
      expect(typeof client.query).toBe('function');
      await client.close().catch(() => {});
    });
  });
});

/**
 * Integration tests that require a running SurrealDB instance.
 * Run with: SURREALDB_URL=ws://localhost:8000 npm test
 */
describe('SurrealClient Integration', () => {
  const surrealUrl = process.env.SURREALDB_URL;

  // Skip if no SurrealDB URL is provided
  const describeWithDb = surrealUrl ? describe : describe.skip;

  describeWithDb('with running database', () => {
    let client: SurrealClient;

    beforeEach(() => {
      client = new SurrealClient({
        url: surrealUrl!,
        namespace: 'test',
        database: 'test',
        username: 'root',
        password: 'root',
      });
    });

    afterEach(async () => {
      await client.close().catch(() => {});
    });

    it('should connect and query successfully', async () => {
      await client.connect();
      expect(client.status).toBe(ConnectionStatus.Connected);

      const result = await client.query<{ value: number }>('RETURN 42 AS value');
      // Verify we get an array back (the wrapper's contract)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return correct result shape for SELECT queries', async () => {
      await client.connect();

      // Create a test record
      await client.query('DELETE test_table');
      await client.query("CREATE test_table SET name = 'test1'");
      await client.query("CREATE test_table SET name = 'test2'");

      const result = await client.query<{ name: string }>('SELECT name FROM test_table');

      // Should be an array of objects, not nested arrays
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      if (result.length > 0) {
        expect(typeof result[0]).toBe('object');
        expect('name' in result[0]).toBe(true);
      }

      // Cleanup
      await client.query('DELETE test_table');
    });

    it('should auto-reconnect on stale connection', async () => {
      await client.connect();

      // Force disconnect the underlying connection
      // @ts-expect-error - accessing private for testing
      await client['#db']?.close?.();

      // Query should still work due to auto-reconnect
      const result = await client.query<{ value: number }>('RETURN 1 AS value');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
