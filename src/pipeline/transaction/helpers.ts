import { SessionType } from 'typedb-driver';
import type { BormConfig, DBHandles } from '../../types';

/**
 * Retrieves an existing session or opens a new session for the specified database handler.
 * @param dbHandles - The database handles object.
 * @param config - The BormConfig object.
 * @returns An object containing the client and session.
 * @throws Error if the client is not found or if the session cannot be opened.
 */
export const getSessionOrOpenNewOne = async (dbHandles: DBHandles, config: BormConfig) => {
	const singleHandlerV0 = config.dbConnectors[0].id;
	let session = dbHandles.typeDB.get(singleHandlerV0)?.session;
	const client = dbHandles.typeDB.get(singleHandlerV0)?.client;

	if (!session || !session.isOpen()) {
		if (!client) {
			throw new Error('Client not found');
		}
		session = await client.session(config.dbConnectors[0].dbName, SessionType.DATA);
		dbHandles.typeDB.set(singleHandlerV0, { client, session });
	}

	return { client, session };
};
