import type { SurrealClient } from '../../../adapters/surrealDB/client';
import { log, logDebug } from '../../../logger';
import { VERSION } from '../../../version';

export const runSURQLMutation = async (client: SurrealClient, mutations: string[]): Promise<any[]> => {
  const batchedMutation = `
	${mutations.join(';')};
	LET $DELTAS = SELECT * FROM Delta;
	DELETE Delta;
	RETURN $DELTAS;
	`;

  logDebug(`>>> batchedMutation[${VERSION}]`, JSON.stringify({ batchedMutation }));

  let tx: Awaited<ReturnType<SurrealClient['beginTransaction']>> | undefined;
  try {
    tx = await client.beginTransaction();
    const result = await tx.query(batchedMutation);
    await tx.commit();
    return (result as any[]).filter(Boolean);
  } catch (err) {
    await tx?.cancel().catch(() => {});
    let message = err instanceof Error ? err.message : String(err);
    log('runSURQLMutation', 'runSURQLMutation/batchedMutation\n', batchedMutation);
    log('runSURQLMutation', 'runSURQLMutation/error\n', err);

    // Normalize SurrealDB v3 coercion errors (e.g. setting NONE on required field)
    const coerceMatch = message.match(/Couldn't coerce value for field `(.+?)` of .+?: .+ but found `?NONE`?/);
    if (coerceMatch) {
      message = `Found NONE for field \`${coerceMatch[1]}\``;
    }
    // Normalize SurrealDB v3 ThrownError format for backward compatibility
    if (message.startsWith('An error occurred: ')) {
      message = `[{"result":"${message}"}]`;
    }

    throw new Error(`Error running SURQL mutation: ${message}`);
  }
};
