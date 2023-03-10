import { TransactionType } from 'typedb-client';

import type { PipelineOperation } from '../pipeline';

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

  const singleHandlerV0 = config.dbConnectors[0].id;

  const session = dbHandles.typeDB.get(singleHandlerV0)?.session;
  if (!session?.isOpen()) {
    throw new Error('Session is closed');
  }
  const transaction = await session.transaction(TransactionType.READ);
  if (!transaction) {
    throw new Error("Can't create transaction");
  }
  const entityStream = transaction.query.matchGroup(tqlRequest.entity);

  const rolesStreams = tqlRequest.roles?.map((role) => ({
    ...role,
    stream: transaction.query.matchGroup(role.request),
  }));

  const relationStreams = tqlRequest.relations?.map((relation) => ({
    ...relation,
    stream: transaction.query.matchGroup(relation.request),
  }));
  const entityConceptMapGroups = await entityStream.collect();

  const rolesConceptMapGroups = await Promise.all(
    rolesStreams?.map(async (role) => ({
      path: role.path,
      ownerPath: role.owner,
      conceptMapGroups: await role.stream.collect(),
    })) || []
  );

  const relationConceptMapGroups = await Promise.all(
    relationStreams?.map(async (relation) => ({
      relation: relation.relation,
      entity: relation.entity,
      conceptMapGroups: await relation.stream.collect(),
    })) || []
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
