import type { Surreal } from 'surrealdb';
import type { CommonProvider } from './base';

type SurrealDBProviderConfig = {
	linkMode: 'edges' | 'refs';
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
