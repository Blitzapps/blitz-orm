import { TransactionType } from 'typedb-client';

import type { PipelineOperation } from '../pipeline';

export const runTQLMutation: PipelineOperation = async (req, res) => {
  const { dbHandles, tqlRequest, bqlRequest, config } = req;
  if (!tqlRequest) {
    throw new Error('TQL request not built');
  }
  if (!((tqlRequest.deletions && tqlRequest.deletionMatches) || tqlRequest.insertions)) {
    throw new Error('TQL request error, no things');
  }
  if (!bqlRequest?.mutation) {
    throw new Error('BQL mutation not parsed');
  }

  const singleHandlerV0 = config.dbConnectors[0].id;
  const session = dbHandles.typeDB.get(singleHandlerV0)?.session;
  if (!session?.isOpen()) {
    throw new Error('Session is closed');
  }
  const mutateTransaction = await session.transaction(TransactionType.WRITE);
  if (!mutateTransaction) {
    throw new Error("Can't create transaction");
  }
  // console.log('tqlRequest', tqlRequest);
  // deletes and pre-update deletes
  const tqlDeletion =
    tqlRequest.deletionMatches &&
    tqlRequest.deletions &&
    `match ${tqlRequest.deletionMatches} delete ${tqlRequest.deletions}`;
  // insertions and updates

  const tqlInsertion =
    tqlRequest.insertions &&
    `${tqlRequest.insertionMatches ? `match ${tqlRequest.insertionMatches}` : ''} insert ${tqlRequest.insertions}`;

  // does not receive a result
  if (tqlDeletion) mutateTransaction.query.delete(tqlDeletion);

  const insertionsStream = tqlInsertion && mutateTransaction.query.insert(tqlInsertion);

  const insertionsRes = insertionsStream ? await insertionsStream.collect() : undefined;

  await mutateTransaction.commit();
  await mutateTransaction.close();

  // const ids = bqlRequest.mutation.entities.map((e) => e.$id as string);
  // res.bqlRes = ids;
  res.rawTqlRes = { insertions: insertionsRes };
};
