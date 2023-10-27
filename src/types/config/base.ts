import type { TypeDBProviderObject, TypeDBClusterProviderObject, TypeDBHandles } from './typedb';

export type BormConfig = {
	server: {
		provider: 'blitz-orm-js';
	};
	// queryDefaults
	query?: {
		noMetadata?: boolean;
		simplifiedLinks?: boolean;
		debugger?: boolean;
	};
	mutation?: {
		noMetadata?: boolean;
	};
	dbConnectors: [ProviderObject, ...ProviderObject[]]; // minimum one
};

export type ProviderObject =
	| (TypeDBProviderObject & CommonProperties)
	| (TypeDBClusterProviderObject & CommonProperties);

export interface CommonProperties {
	id: string;
	dbName: string;
}

export type Provider = 'typeDB' | 'typeDBCluster';

export type DBConnector = {
	id: string;
	subs?: string;
	path?: string; // * Overrides the default db path
	as?: string;
};

export type DBHandles = {
	typeDB: TypeDBHandles;
};
