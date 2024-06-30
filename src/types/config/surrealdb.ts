import type { Surreal } from 'surrealdb.js';
import type { CommonProvider } from './base';

type SurrealDBProviderConfig = {
	linkMode: 'edges' | 'computed-refs';
};
export interface SurrealDBProviderObject extends CommonProvider {
	provider: 'surrealDB';
	providerConfig: SurrealDBProviderConfig;
	url: string;
	namespace: string;
	username: string;
	password: string;
}

export type SurrealDBHandles = Map<string, { client: Surreal; providerConfig: SurrealDBProviderConfig }>;
