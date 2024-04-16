import { parallel } from 'radash';
import { TransactionType, TypeDBOptions } from 'typedb-driver';
import { getSessionOrOpenNewOne } from '../../../pipeline/transaction/helpers';
import type { BormConfig, DBHandles } from '../../../types';

export const runTQLQuery = async (props: {
	tqlRequest: string[];
	dbHandles: DBHandles;
	config: BormConfig;
}): Promise<any> => {
	const { tqlRequest, dbHandles, config } = props;
	//TODO condition this only to have infer if there are virtual fields (without default fn)
	const options = new TypeDBOptions();
	options.infer = true;

	const { session } = await getSessionOrOpenNewOne(dbHandles, config);
	const transaction = await session.transaction(TransactionType.READ, options);
	if (!transaction) {
		throw new Error("Can't create transaction");
	}

	//todo: add try-catch here
	const resArray = await parallel(tqlRequest.length, tqlRequest, async (queryString) => {
		const tqlStream = transaction.query.fetch(queryString as string);
		const tqlRes = await tqlStream.collect();
		return tqlRes;
	});
	// todo: type the rawTqlRes
	return resArray;
};
