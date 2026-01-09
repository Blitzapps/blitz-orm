import type { AnySurrealClient } from '../../adapters/surrealDB/client';
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
  /**
   * The total number of connections to the SurrealDB server.
   * Setting this to a higher number will increase the concurrency of the queries.
   * totalConnections that is too high will cause the connections to drop.
   * The default is 64.
   */
  totalConnections?: number;
}

export type SurrealDBHandles = Map<string, { client: AnySurrealClient; providerConfig: SurrealDBProviderConfig }>;
