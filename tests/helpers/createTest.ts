import 'jest';

import BormClient from "../../src";
import { assertDefined } from '../../src/helpers';
import { afterAll, beforeAll, describe } from 'vitest';

type TestContext = {
	query: BormClient['query'];
	mutate: BormClient['mutate'];
	define: BormClient['define'];
};

export const createTest = (name: string, test: (ctx: TestContext) => void) => {
	const runTest = (init: () => Promise<{ client: BormClient; clean?: () => void | Promise<void> }>) => {
		let client: BormClient;
		let clean: (() => void | Promise<void>) | undefined;
		const ctx: TestContext = {
			define: (...params) => {
				assertDefined(client);
				return client.define(...params);
			},
			query: (...params) => {
				assertDefined(client);
				return client.query(...params);
			},
			mutate: (...params) => {
				assertDefined(client);
				return client.mutate(...params);
			}
		};

		beforeAll(async () => {
			const res = await init();
			client = res.client;
			clean = res.clean;
		}, 25000);

		describe(name, () => {
			test(ctx);

			afterAll(async () => {
				await clean?.();
			});
		});
	};

	return runTest;
};