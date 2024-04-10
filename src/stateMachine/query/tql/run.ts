import { TransactionType, TypeDBOptions } from 'typedb-driver';

import { parallel } from 'radash';
import { BormConfig, DBHandles, ParsedBQLQuery } from '../../../types';
import { getSessionOrOpenNewOne } from '../../../pipeline/transaction/helpers';

export const runTQLQuery = async (dbHandles: DBHandles, enrichedBqlQuery: ParsedBQLQuery, tqlRequest: string | string[], config: BormConfig): Promise<any> => {
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not parsed');
	}
	if (!tqlRequest) {
		throw new Error('TQL request not built');
	}
	//TODO condition this only to have infer if there are virtual fields (without default fn)
	const options = new TypeDBOptions();
	options.infer = true;

	const isBatched = Array.isArray(tqlRequest);
	if (isBatched) {
		//todo: add try-catch here
		const resArray = await parallel(tqlRequest.length, tqlRequest, async (queryString) => {
			const { session } = await getSessionOrOpenNewOne(dbHandles, config);

      // TODO: Use single transaction
			const transaction = await session.transaction(TransactionType.READ, options);
			if (!transaction) {
				throw new Error("Can't create transaction");
			}
			const tqlStream = transaction.query.fetch(queryString as string);

			const tqlRes = await tqlStream.collect();
			await transaction.close();
			return tqlRes;
		});
		// todo: type the rawTqlRes
		return resArray;
	} else {
		const { session } = await getSessionOrOpenNewOne(dbHandles, config);

		const transaction = await session.transaction(TransactionType.READ, options);
		if (!transaction) {
			throw new Error("Can't create transaction");
		}
		const tqlStream = transaction.query.fetch(tqlRequest as string);
		const tqlRes = await tqlStream.collect();

		await transaction.close();

		return tqlRes;
	}
};
