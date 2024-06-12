import type {
	TypeDBProvider as TypeDBProvider,
	TypeDBClusterProvider as TypeDBClusterProvider,
	TypeDBHandles,
} from './typedb';
import type { SurrealDBProviderObject as SurrealDBProvider, SurrealDBHandles } from './surrealdb';

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
	dbConnectors: [Provider, ...Provider[]]; // minimum one
};

export type Provider = TypeDBProvider | TypeDBClusterProvider | SurrealDBProvider;

export interface CommonProvider {
	id: string;
	dbName: string;
}

export type DBConnector = {
	id: string;
	subs?: string;
	path?: string; // * Overrides the default db path
	as?: string;
};

type AllDbHandles = {
	typeDB: TypeDBHandles;
	surrealDB: SurrealDBHandles;
	typeDBCluster: any; //todo
};
type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type DBHandles = AtLeastOne<AllDbHandles>;

export type DBHandleKey = keyof DBHandles;
