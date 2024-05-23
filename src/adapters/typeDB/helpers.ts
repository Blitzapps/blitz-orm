import { SessionType } from 'typedb-driver';
import type { BormConfig, DBHandles } from '../../types';

export const getSessionOrOpenNewOne = async (dbHandles: DBHandles, config: BormConfig) => {
	const singleHandlerV0 = config.dbConnectors[0].id;
	let session = dbHandles.typeDB?.get(singleHandlerV0)?.session;
	const client = dbHandles.typeDB?.get(singleHandlerV0)?.client;

	if (!session || !session.isOpen()) {
		if (!client) {
			throw new Error('Client not found');
		}
		session = await client.session(config.dbConnectors[0].dbName, SessionType.DATA);
		dbHandles.typeDB?.set(singleHandlerV0, { client, session });
	}

	return { client, session };
};
