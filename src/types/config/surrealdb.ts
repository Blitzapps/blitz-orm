import type { Surreal } from 'surrealdb.node';

export interface SurrealDBProviderObject {
	provider: 'surrealDB';
	url: string;
	namespace: string;
	username: string;
	password: string;
}

export type SurrealDBHandles = Map<string, { client: Surreal }>;
