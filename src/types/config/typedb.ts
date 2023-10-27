import type { TypeDBClient, TypeDBCredential, TypeDBSession } from 'typedb-client';

export interface TypeDBProviderObject {
	provider: 'typeDB';
	url: string;
}

export interface TypeDBClusterProviderObject {
	provider: 'typeDBCluster';
	addresses: string[];
	credentials: TypeDBCredential;
}

export type TypeDBHandles = Map<string, { client: TypeDBClient; session: TypeDBSession }>;
