import type { TypeDBProviderObject, TypeDBClusterProviderObject, TypeDBHandles } from './typedb';
import type { SurrealDBProviderObject, SurrealDBHandles } from './surrealdb';

export type QueryConfig = {
	noMetadata?: boolean;
	returnNulls?: boolean;
	simplifiedLinks?: boolean;
	debugger?: boolean;
};

export type MutationConfig = {
	noMetadata?: boolean;
	preQuery?: boolean;
	ignoreNonexistingThings?: boolean;
	context?: Record<string, any>;
};

export type BormConfig = {
	server: {
		provider: 'blitz-orm-js';
	};
	// queryDefaults
	query?: QueryConfig;
	mutation?: MutationConfig;
	dbConnectors: [ProviderObject, ...ProviderObject[]]; // minimum one
};

export type ProviderObject =
	| (TypeDBProviderObject & CommonProperties)
	| (TypeDBClusterProviderObject & CommonProperties)
	| (SurrealDBProviderObject & CommonProperties);

export interface CommonProperties {
	id: string;
	dbName: string;
}

export type Provider = 'typeDB' | 'typeDBCluster' | 'surrealDB';

export type DBConnector = {
	id: string;
	subs?: string;
	path?: string; // * Overrides the default db path
	as?: string;
};

type AllDbHandles = {
	typeDB: TypeDBHandles;
	surrealDB: SurrealDBHandles;
};
type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type DBHandles = AtLeastOne<AllDbHandles>;

export type DBHandleKey = keyof DBHandles;
