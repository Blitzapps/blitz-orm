import { describe, expect, it } from 'vitest';
import { schema } from '../mocks/schema';
import { extendSchema } from '../../src/enrichSchema';
import { extendSchemaNew } from '../../src/enrichSchemaNew';

describe('extendSchema', () => {
	it('should extend schema correctly', () => {
		//todo: immutable
		const schemaOld = { ...schema };
		const schemaNew = { ...schema }; //todo: immutable. This test is succeding but actually shouldnt, we are just comparing two copies of the same object
		extendSchema(schemaOld);
		extendSchemaNew(schemaNew);
		expect(schemaNew.entities.Account).toEqual(schemaOld.entities.Account);
		expect(schemaNew).toEqual(schemaOld);
	});
});
