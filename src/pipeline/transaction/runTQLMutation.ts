import { TransactionType } from 'typedb-driver';

import type { PipelineOperation } from '../pipeline';
import { getSessionOrOpenNewOne } from './helpers';

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
		// console.log('DELETING: ', tqlDeletion);
		await mutateTransaction.query.delete(tqlDeletion);
		// console.log('X: ', x);
	}

	const insertionsStream = tqlInsertion && mutateTransaction.query.insert(tqlInsertion);

	try {
		const insertionsRes = insertionsStream ? await insertionsStream.collect() : undefined;
		// console.log('INSERTION: ', insertionsRes);

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
