import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import { SessionType } from 'typedb-driver';
import type { BormConfig } from '../../types';

export const getSessionOrOpenNewOne = async (
	handler: { client: TypeDBDriver; session: TypeDBSession },
	config: BormConfig,
) => {
	let { session } = handler;
	const { client } = handler;

	if (!session || !session.isOpen()) {
		if (!client) {
			throw new Error('Client not found');
		}
		session = await client.session(config.dbConnectors[0].dbName, SessionType.DATA);

		// eslint-disable-next-line no-param-reassign
		handler = { client, session };
	}

	return { client, session };
};
