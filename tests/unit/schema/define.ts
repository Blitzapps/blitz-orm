import type { DBHandles } from '../../../src';
import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';
import fs from 'fs';
export const testSchemaDefine = createTest('Schema', (client) => {
	it('TODO{S}:b1[create] Basic', async () => {
		expect(client).toBeDefined();

		const dbHandles = client.getDbHandles() as DBHandles;

		const schemas = await client.define();

		if (dbHandles.typeDB?.size) {
			schemas.typeDB.forEach((schema) => {
				expect(schema).toBeDefined();
				expect(schema).toBeTypeOf('string');
				//import tql schema from .tql file
				const tqlSchema = fs.readFileSync('tests/unit/schema/tempSchema.tql', 'utf8');
				expect(schema).toBe(tqlSchema);
			});
		}
	});
});
