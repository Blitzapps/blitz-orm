import type { BormConfig, DBHandles, EnrichedBormSchema } from '../types';
import { defineTQLSchema } from '../adapters/typeDB/schema/define';

export const bormDefine = async (config: BormConfig, schema: EnrichedBormSchema, dbHandles: DBHandles) => {
	const schemas = async () => {
		const typeDBEntries = await Promise.all(
			[...(dbHandles.typeDB || [])].map(async ([key]) => [key, await defineTQLSchema(key, config, schema, dbHandles)]),
		);

		const typeDBEntriesFixed = typeDBEntries.map((entry) => [entry[0], entry[1]] as const);
		return {
			typeDB: new Map(typeDBEntriesFixed),
			surrealDB: new Map([...(dbHandles.surrealDB || [])].map(([key]) => [key, key] as const)),
		};
	};
	return await schemas();

	// TYPE DB TRANSACTIONS

	// 4. Closing sessions
};
