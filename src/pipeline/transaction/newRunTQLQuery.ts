import { TransactionType } from 'typedb-driver';

import type { PipelineOperation } from '../pipeline';
import { getSessionOrOpenNewOne } from './helpers';
import { parallel } from 'radash';

export const newRunTQLQuery: PipelineOperation = async (req, res) => {
	const { dbHandles, enrichedBqlQuery, tqlRequest, config } = req;
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not parsed');
	}
	if (!tqlRequest) {
		throw new Error('TQL request not built');
	}
	// console.log('tqlRequest', tqlRequest);
	const isBatched = Array.isArray(tqlRequest);
	if (isBatched) {
		const resArray = await parallel(tqlRequest.length, tqlRequest, async (queryString) => {
			const { session } = await getSessionOrOpenNewOne(dbHandles, config);

			const transaction = await session.transaction(TransactionType.READ);
			if (!transaction) {
				throw new Error("Can't create transaction");
			}
			const tqlStream = transaction.query.fetch(queryString as string);
			const tqlRes = await tqlStream.collect();
			await transaction.close();
			return tqlRes;
		});
		// todo: type the rawTqlRes
		// @ts-expect-error todo
		res.rawTqlRes = resArray;
		res.isBatched = true;
	} else {
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
	}
};
