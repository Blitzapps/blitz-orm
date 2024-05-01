import { TransactionType } from 'typedb-driver';
import { getSessionOrOpenNewOne } from '../../../pipeline/transaction/helpers';
import type { BormConfig, DBHandles } from '../../../types';

export type TqlMutation = {
	deletions: string;
	deletionMatches: string;
	insertions: string;
	insertionMatches: string;
};

export const runTQLMutation = async (tqlMutation: TqlMutation, dbHandles: DBHandles, config: BormConfig) => {
	if (!tqlMutation) {
		throw new Error('TQL request not built');
	}
	if (!((tqlMutation.deletions && tqlMutation.deletionMatches) || tqlMutation.insertions)) {
		throw new Error('TQL request error, no things');
	}

	const { session } = await getSessionOrOpenNewOne(dbHandles, config);

	const mutateTransaction = await session.transaction(TransactionType.WRITE);

	if (!mutateTransaction) {
		throw new Error("Can't create transaction");
	}

	// deletes and pre-update deletes
	const tqlDeletion =
		tqlMutation.deletionMatches &&
		tqlMutation.deletions &&
		`match ${tqlMutation.deletionMatches} delete ${tqlMutation.deletions}`;

	// insertions and updates
	const tqlInsertion =
		tqlMutation.insertions &&
		`${tqlMutation.insertionMatches ? `match ${tqlMutation.insertionMatches}` : ''} insert ${tqlMutation.insertions}`;

	// does not receive a result
	if (tqlDeletion) {
		await mutateTransaction.query.delete(tqlDeletion);
	}

	const insertionsStream = tqlInsertion && mutateTransaction.query.insert(tqlInsertion);

	try {
		const insertionsRes = insertionsStream ? await insertionsStream.collect() : undefined;

		await mutateTransaction.commit();
		await mutateTransaction.close();
		return { insertions: insertionsRes };
	} catch (e: any) {
		await mutateTransaction.close();
		throw new Error(`Transaction failed: ${e.message}`);
	}
};
