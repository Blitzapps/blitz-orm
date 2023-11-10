/**
 * Runs a TQL query operation.
 * @param req - The request object, containing the database handles, TQL request, BQL request, and configuration.
 * @param res - The response object.
 * @throws Error if the BQL request is not parsed, if the TQL request is not built, if the TQL request does not contain an entity, if the BQL request is not a query, or if the transaction cannot be created.
 */
export const runTQLQuery: PipelineOperation = async (req, res) => {
  // Destructure the request object to get the necessary properties
  const { dbHandles, bqlRequest, tqlRequest, config } = req;
  
  // Check if the BQL request is parsed
  if (!bqlRequest) {
    throw new Error('BQL request not parsed');
  }
  
  // Check if the TQL request is built
  if (!tqlRequest) {
    throw new Error('TQL request not built');
  }
  
  // Check if the TQL request contains an entity
  if (!tqlRequest.entity) {
    throw new Error('BQL request error, no entities');
  }
  
  // Check if the BQL request is a query
  const { query } = bqlRequest;
  if (!query) {
    throw new Error('BQL request is not a query');
  }

  // Get the session or open a new one
  const { session } = await getSessionOrOpenNewOne(dbHandles, config);

  // Start a new transaction
  const transaction = await session.transaction(TransactionType.READ);
  
  // Check if the transaction is created
  if (!transaction) {
    throw new Error("Can't create transaction");
  }
  
  // Get the entity stream from the transaction
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
  // Collect the roles concept map groups from the roles streams
  const rolesConceptMapGroups = await Promise.all(
    rolesStreams?.map(async (role) => ({
      path: role.path,
      ownerPath: role.owner,
      conceptMapGroups: await role.stream.collect(),
    })) || [],
  );

  // Collect the relation concept map groups from the relation streams
  const relationConceptMapGroups = await Promise.all(
    relationStreams?.map(async (relation) => ({
      relation: relation.relation,
      entity: relation.entity,
      conceptMapGroups: await relation.stream.collect(),
    })) || [],
  );
  
  // Close the transaction
  await transaction.close();
  
  // Set the raw TQL response in the response object
  res.rawTqlRes = {
    entity: entityConceptMapGroups,
    ...(rolesConceptMapGroups?.length && { roles: rolesConceptMapGroups }),
    ...(relationConceptMapGroups?.length && {
      relations: relationConceptMapGroups,
    }),
  };
  // console.log('rawTqlRes', res.rawTqlRes);
};
  const rolesStreams = tqlRequest.roles?.map((role) => ({
    ...role,
    stream: transaction.query.getGroup(role.request),
  }));

  // Map the relations in the TQL request to their corresponding streams
  const relationStreams = tqlRequest.relations?.map((relation) => ({
    ...relation,
    stream: transaction.query.getGroup(relation.request),
  }));
  
  // Collect the entity concept map groups from the entity stream
  const entityConceptMapGroups = await entityStream.collect();
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
