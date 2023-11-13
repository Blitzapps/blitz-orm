/** @type {import('jest').Config} */

const config = {
	testEnvironment: 'node',
	preset: 'ts-jest',
	transform: {
		'^.+.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
	},
	// testNamePattern: ".*\\.test\\.ts$",
};

module.exports = config;
