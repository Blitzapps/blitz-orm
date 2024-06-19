import type { AggregateError } from 'radash';
import { parallel, tryit } from 'radash';
import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import { TransactionType, TypeDBOptions } from 'typedb-driver';
import { getSessionOrOpenNewOne } from '../../../adapters/typeDB/helpers';
import type { BormConfig } from '../../../types';

export const runTQLQuery = async (props: {
	tqlRequest: string[];
	handler: { client: TypeDBDriver; session: TypeDBSession };
	config: BormConfig;
}): Promise<any> => {
	const { tqlRequest, handler, config } = props;
	//TODO condition this only to have infer if there are virtual fields (without default fn)
	const options = new TypeDBOptions();
	options.infer = true;

	const { session } = await getSessionOrOpenNewOne(handler, config);
	const transaction = await session.transaction(TransactionType.READ, options);

	console.log('query', JSON.stringify(tqlRequest, null, 2));
	const [err, resArray] = await tryit(parallel)(tqlRequest.length, tqlRequest, async (queryString) => {
		const tqlStream = transaction.query.fetch(queryString as string);
		const tqlRes = await tqlStream.collect();
		return tqlRes;
	});

	if (err) {
		await transaction.rollback();
		const error = err as AggregateError;
		throw new Error(`Error running TQL query: ${error.errors}`);
	}
	await transaction.close();

	// todo: type the rawTqlRes
	return resArray;
};
