import type { TypeDBDriver, TypeDBCredential, TypeDBSession } from 'typedb-driver';

export interface TypeDBProviderObject {
	provider: 'typeDB';
	url: string;
}

export interface TypeDBClusterProviderObject {
	provider: 'typeDBCluster';
	addresses: string[];
	credentials: TypeDBCredential;
}

export type TypeDBHandles = Map<string, { client: TypeDBDriver; session: TypeDBSession }>;
