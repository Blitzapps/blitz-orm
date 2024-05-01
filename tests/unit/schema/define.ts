import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';

export const testSchemaDefine = createTest('Schema', (client) => {
	it('TODO:b1[create] Basic', async () => {
		/*
    todo: Now we can't use the name of the relation if the relation has been extended. 
    */
		expect(client).toBeDefined();

		await client.define();
	});
});
