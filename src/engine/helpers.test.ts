import { getDependencies } from './helpers';
import { test, expect } from 'vitest';
test('Should get the dependencies', () => {
	const fn = (
		{ name }: { name: string },
		{ kinds: unitKinds }: { kinds: string },
		{ spaceId }: { spaceId: string },
	) => {
		console.log(name, unitKinds, spaceId);
	};
	const dep = getDependencies(fn);
	expect(dep).toEqual({
		current: ['name'],
		parent: ['kinds'],
		context: ['spaceId'],
	});
});

test('Should return empty string for unused node params', () => {
	const fn = () => {
		console.log();
	};
	const dep = getDependencies(fn);
	expect(dep).toEqual({
		current: [],
		parent: [],
		context: [],
	});
});

test('Should return empty string for node params that are not destructured', () => {
	const fn = (current: object, parent: object, context: object) => {
		console.log(current, parent, context);
	};
	const dep = getDependencies(fn);
	expect(dep).toEqual({
		current: [],
		parent: [],
		context: [],
	});
});
