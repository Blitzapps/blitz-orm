import type { SurrealClient } from '../../../adapters/surrealDB/client';
import { log } from '../../../logger';
import type { SurqlParams } from './buildSurql';

/**
 * Execute the generated SurQL within a transaction.
 */
export const executeMutation = async (
  client: SurrealClient,
  surql: string,
  params: SurqlParams,
): Promise<unknown[]> => {
  let tx: Awaited<ReturnType<SurrealClient['beginTransaction']>> | undefined;
  try {
    tx = await client.beginTransaction();
    log(['executeMutation', 'executeMutation/surql'], surql);
    log(['executeMutation', 'executeMutation/params'], params);
    const results = await tx.query(surql, params);
    await tx.commit();
    return results;
  } catch (err) {
    await tx?.cancel().catch(() => {});
    log('executeMutation', 'executeMutation/surql\n', surql);
    log('executeMutation', 'executeMutation/params\n', params);
    log('executeMutation', 'executeMutation/error\n', err);

    let message = err instanceof Error ? err.message : String(err);

    // Normalize SurrealDB v3 duplicate record error
    const dupMatch = message.match(/Database record `(.+?)`.*already exists/);
    if (dupMatch) {
      const recordId = dupMatch[1];
      const id = recordId.includes(':')
        ? recordId.split(':').pop()?.replace(/[`⟨⟩]/g, '')
        : recordId.replace(/[`⟨⟩]/g, '');
      throw new Error(`Duplicate id ${id}`);
    }

    // Normalize SurrealDB v3 coercion errors
    const coerceMatch = message.match(/Couldn't coerce value for field `(.+?)` of .+?: .+ but found `?NONE`?/);
    if (coerceMatch) {
      message = `Found NONE for field \`${coerceMatch[1]}\``;
    }
    // Normalize SurrealDB v3 ThrownError format
    if (message.startsWith('An error occurred: ')) {
      message = `[{"result":"${message}"}]`;
    }

    throw new Error(`Error running SURQL mutation: ${message}`);
  }
};
