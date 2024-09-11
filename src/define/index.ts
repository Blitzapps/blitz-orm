import type { BormConfig, DBHandles, EnrichedBormSchema } from '../types';
import { defineTQLSchema } from '../adapters/typeDB/schema/define';
import { defineSURQLSchema } from '../adapters/surrealDB/schema/define';

export const bormDefine = async (config: BormConfig, schema: EnrichedBormSchema, dbHandles: DBHandles) => {
	const schemas = async () => {
		const typeDBEntries = await Promise.all(
			[...(dbHandles.typeDB || [])].map(async ([key]) => [key, await defineTQLSchema(key, config, schema, dbHandles)]),
		);

		const typeDBEntriesFixed = typeDBEntries.map((entry) => [entry[0], entry[1]] as const);

		const surrealDBEntries = await Promise.all(
			[...(dbHandles.surrealDB || [])].map(async ([key]) => [key, defineSURQLSchema(schema)]),
		);

		const surrealDBEntriesFixed = surrealDBEntries.map((entry) => [entry[0], entry[1]] as const);
		return {
			typeDB: Object.fromEntries(typeDBEntriesFixed),
			surrealDB: Object.fromEntries(surrealDBEntriesFixed),
		};
	};
	return await schemas();

	// TYPE DB TRANSACTIONS

	// 4. Closing sessions
};
