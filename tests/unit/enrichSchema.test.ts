import { describe, expect, it } from 'vitest';
import { enrichSchema as enrichSchemaOld } from '../../src/enrichSchema';
import { enrichSchema } from '../../src/enrichSchemaNew';
import { schema } from '../mocks/schema';
import type { DBHandles } from '../../src';

describe('enrichSchema', () => {
	const dbHandles: DBHandles = {
		surrealDB: new Map([['default', { client: null, providerConfig: { linkMode: 'refs' as const } }]]),
	};

	it('should match the original implementation', () => {
		const enrichedSchemaOld = enrichSchemaOld(schema, dbHandles);
		const enrichedSchemaNew = enrichSchema(schema, dbHandles);
		//expect(enrichedSchemaNew.entities.Account).toEqual(enrichedSchemaOld.entities.Account);
		//expect(enrichedSchemaNew.relations.UserTagGroup).toEqual(enrichedSchemaOld.relations.UserTagGroup);
		expect(enrichedSchemaNew.relations.FlexRefRel).toEqual(enrichedSchemaOld.relations.FlexRefRel);
		expect(enrichedSchemaNew).toEqual(enrichedSchemaOld);
	});
});
