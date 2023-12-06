import { TransactionType } from 'typedb-driver';

import type { PipelineOperation } from '../pipeline';
import { getSessionOrOpenNewOne } from './helpers';

export const newRunTQLQuery: PipelineOperation = async (req, res) => {
	const { dbHandles, enrichedBqlQuery, tqlRequest, config } = req;
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not parsed');
	}
	if (!tqlRequest) {
		throw new Error('TQL request not built');
	}

	const { session } = await getSessionOrOpenNewOne(dbHandles, config);

	const transaction = await session.transaction(TransactionType.READ);
	if (!transaction) {
		throw new Error("Can't create transaction");
	}
	const tqlStream = transaction.query.fetch(tqlRequest as string);
	const tqlRes = await tqlStream.collect();
	// console.log('tqlRes', JSON.stringify(tqlRes, null, 2));

	await transaction.close();

	// todo: type the rawTqlRes
	// @ts-expect-error todo
	res.rawTqlRes = tqlRes;
};
