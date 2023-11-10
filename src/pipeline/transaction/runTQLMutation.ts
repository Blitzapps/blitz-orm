import { TransactionType } from 'typedb-driver';

import type { PipelineOperation } from '../pipeline';
import { getSessionOrOpenNewOne } from './helpers';

/**
 * Runs a TQL mutation operation.
 * @param req - The request object, containing the database handles, TQL request, BQL request, and configuration.
 * @param res - The response object.
 * @throws Error if the TQL request is not built, if the TQL request does not contain deletions or insertions, if the BQL mutation is not parsed, or if the transaction fails.
 */
export const runTQLMutation: PipelineOperation = async (req, res) => {
  // Destructure the request object to get the necessary properties
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

	const { session } = await getSessionOrOpenNewOne(dbHandles, config);

	const mutateTransaction = await session.transaction(TransactionType.WRITE);

	if (!mutateTransaction) {
		throw new Error("Can't create transaction");
	}
	// console.log('tqlRequest!', JSON.stringify(tqlRequest, null, 2));

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
	if (tqlDeletion) {
		mutateTransaction.query.delete(tqlDeletion);
	}

	const insertionsStream = tqlInsertion && mutateTransaction.query.insert(tqlInsertion);

	try {
		const insertionsRes = insertionsStream ? await insertionsStream.collect() : undefined;
		await mutateTransaction.commit();
		await mutateTransaction.close();
		res.rawTqlRes = { insertions: insertionsRes };
	} catch (e: any) {
		await mutateTransaction.close();
		throw new Error(`Transaction failed: ${e.message}`);
	}

	// const ids = bqlRequest.mutation.entities.map((e) => e.$id as string);
	// res.bqlRes = ids;
};
  // Check if the TQL request is built
  if (!tqlRequest) {
    throw new Error('TQL request not built');
  }
  // Check if the TQL request contains deletions or insertions
  if (!((tqlRequest.deletions && tqlRequest.deletionMatches) || tqlRequest.insertions)) {
    throw new Error('TQL request error, no things');
  }
  // Check if the BQL mutation is parsed
  if (!bqlRequest?.mutation) {
    throw new Error('BQL mutation not parsed');
  }

  // Get the session or open a new one
  const { session } = await getSessionOrOpenNewOne(dbHandles, config);

  // Start a new transaction
  const mutateTransaction = await session.transaction(TransactionType.WRITE);

  // Check if the transaction is created
  if (!mutateTransaction) {
    throw new Error("Can't create transaction");
  }

  // Prepare the TQL deletion statement
  const tqlDeletion =
    tqlRequest.deletionMatches &&
    tqlRequest.deletions &&
    `match ${tqlRequest.deletionMatches} delete ${tqlRequest.deletions}`;

  // Prepare the TQL insertion statement
  const tqlInsertion =
    tqlRequest.insertions &&
    `${tqlRequest.insertionMatches ? `match ${tqlRequest.insertionMatches}` : ''} insert ${tqlRequest.insertions}`;

  // Execute the TQL deletion statement
  if (tqlDeletion) {
    mutateTransaction.query.delete(tqlDeletion);
  }

  // Execute the TQL insertion statement and get the result stream
  const insertionsStream = tqlInsertion && mutateTransaction.query.insert(tqlInsertion);

  // Try to collect the results, commit the transaction, and close the transaction
  try {
    const insertionsRes = insertionsStream ? await insertionsStream.collect() : undefined;
    await mutateTransaction.commit();
    await mutateTransaction.close();
    res.rawTqlRes = { insertions: insertionsRes };
  } catch (e: any) {
    // If an error occurs, close the transaction and throw an error
    await mutateTransaction.close();
    throw new Error(`Transaction failed: ${e.message}`);
  }
