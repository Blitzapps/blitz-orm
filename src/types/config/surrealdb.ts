import type { CommonProvider } from './base';
import type { SimpleSurrealClient } from '../../adapters/surrealDB/client';

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

export type SurrealDBHandles = Map<string, { client: SimpleSurrealClient; providerConfig: SurrealDBProviderConfig }>;
