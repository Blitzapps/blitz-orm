import { describe, expect, it } from 'vitest';
import { enrichSchema as enrichSchemaOld } from '../../src/enrichSchema';
import { enrichSchema } from '../../src/enrichSchemaNew';
import { enrichSchema as enrichSchemaNew } from '../../src/enrichSchemaNew_NEW';
import { schema } from '../mocks/schema';
import type { DBHandles } from '../../src';

describe('enrichSchema', () => {
	const dbHandles: DBHandles = {
		surrealDB: new Map([['default', { client: null, providerConfig: { linkMode: 'refs' as const } }]]),
	};

	it('should match the original implementation', () => {
		const enrichedSchemaNewNew = enrichSchemaNew(deepClone(schema), dbHandles);
		const enrichedSchemaNew = enrichSchema(deepClone(schema), dbHandles);
		const enrichedSchemaOld = enrichSchemaOld(deepClone(schema), dbHandles);
		console.log('\n> enrichedSchemaNewNew\n', JSON.stringify(enrichedSchemaNewNew));
		// expect(enrichedSchemaNewNew).toEqual(enrichedSchemaNew);
		expect(enrichedSchemaNewNew).toEqual(enrichedSchemaOld);
		// expect(enrichedSchemaNew).toEqual(enrichedSchemaOld);
		//expect(enrichedSchemaNew.entities.Account).toEqual(enrichedSchemaOld.entities.Account);
		//expect(enrichedSchemaNew.relations.UserTagGroup).toEqual(enrichedSchemaOld.relations.UserTagGroup);
		// expect(enrichedSchemaNew.relations.FlexRefRel).toEqual(enrichedSchemaOld.relations.FlexRefRel);
	});
});

const deepClone = <T>(obj: T): T => {
	if (typeof obj === 'object') {
		if (obj === null) {
			return obj;
		}
		if (Array.isArray(obj)) {
			return obj.map((i) => deepClone(i)) as T;
		}
		return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepClone(v)])) as T;
	}
	return obj;
};
