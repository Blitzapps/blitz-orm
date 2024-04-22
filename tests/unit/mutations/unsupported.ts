import { createTest } from '../../helpers/createTest';
import { expect, it } from 'vitest';

export const testUnsupportedMutation = createTest('Mutation: Unsupported', (ctx) => {
	it("notYet1[format] Can't update on link", async () => {
		try {
			await ctx.mutate({
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
});
