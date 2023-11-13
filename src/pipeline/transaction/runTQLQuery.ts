import { TransactionType } from 'typedb-driver';

import type { PipelineOperation } from '../pipeline';
import { getSessionOrOpenNewOne } from './helpers';

export const runTQLQuery: PipelineOperation = async (req, res) => {
	const { dbHandles, bqlRequest, tqlRequest, config } = req;
	if (!bqlRequest) {
		throw new Error('BQL request not parsed');
	}
	if (!tqlRequest) {
		throw new Error('TQL request not built');
	}
	if (!tqlRequest.entity) {
		throw new Error('BQL request error, no entities');
	}
	const { query } = bqlRequest;
	if (!query) {
		throw new Error('BQL request is not a query');
	}

	const { session } = await getSessionOrOpenNewOne(dbHandles, config);

	const transaction = await session.transaction(TransactionType.READ);
	if (!transaction) {
		throw new Error("Can't create transaction");
	}
	const entityStream = transaction.query.getGroup(tqlRequest.entity);

	const rolesStreams = tqlRequest.roles?.map((role) => ({
		...role,
		stream: transaction.query.getGroup(role.request),
	}));

	const relationStreams = tqlRequest.relations?.map((relation) => ({
		...relation,
		stream: transaction.query.getGroup(relation.request),
	}));
	const entityConceptMapGroups = await entityStream.collect();

	/// The new json structure. Once attibutes are natively packed we will refacto the queries and use this
	// const json = entityConceptMapGroups.flatMap((x) => x.conceptMaps.map((y) => y.toJSONRecord()));
	// console.log('json', json);
	const rolesConceptMapGroups = await Promise.all(
		rolesStreams?.map(async (role) => ({
			path: role.path,
			ownerPath: role.owner,
			conceptMapGroups: await role.stream.collect(),
		})) || [],
	);

	const relationConceptMapGroups = await Promise.all(
		relationStreams?.map(async (relation) => ({
			relation: relation.relation,
			entity: relation.entity,
			conceptMapGroups: await relation.stream.collect(),
		})) || [],
	);
	await transaction.close();
	res.rawTqlRes = {
		entity: entityConceptMapGroups,
		...(rolesConceptMapGroups?.length && { roles: rolesConceptMapGroups }),
		...(relationConceptMapGroups?.length && {
			relations: relationConceptMapGroups,
		}),
	};
	// console.log('rawTqlRes', res.rawTqlRes);
};
