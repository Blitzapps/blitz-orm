import type { TypeDBDriver, TypeDBSession } from 'typedb-driver';
import type { CommonProvider } from './base';

export interface TypeDBProvider extends CommonProvider {
  provider: 'typeDB';
  url: string;
}

export interface TypeDBClusterProvider extends CommonProvider {
  provider: 'typeDBCluster';
  addresses: string[];
  username: string;
  password: string;
  tlsRootCAPath?: string;
}

export type TypeDBHandles = Map<string, { client: TypeDBDriver; session: TypeDBSession }>;
