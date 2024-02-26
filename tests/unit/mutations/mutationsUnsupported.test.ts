import 'jest';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';

describe('Mutations: Unsupported', () => {
	let dbName: string;
	let bormClient: BormClient;

	beforeAll(async () => {
		const { dbName: configDbName, bormClient: configBormClient } = await init();
		if (!configBormClient) {
			throw new Error('Failed to initialize BormClient');
		}
		dbName = configDbName;
		bormClient = configBormClient;
	}, 20000);

	it("notYet1[format] Can't update on link", async () => {
		expect(bormClient).toBeDefined();
		try {
			await bormClient.mutate({
				$thing: 'Thing',
				$thingType: 'entity',
				$id: 'temp1',
				root: {
					$op: 'link',
					$id: 'tr10',
					moreStuff: 'stuff', //this does not even exist in the schema, and thats fine
				},
			});
		} catch (error: any) {
			if (error instanceof Error) {
				expect(error.message).toBe("[Unsupported] Can't update fields on Link / Unlink");
			} else {
				expect(true).toBe(false);
			}
			return;
		}
		throw new Error('Expected mutation to throw an error');
	});

	afterAll(async () => {
		await cleanup(bormClient, dbName);
	});
});
