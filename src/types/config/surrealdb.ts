import type { SurrealClient } from '../../adapters/surrealDB/client';
import type { CommonProvider } from './base';

export type SurrealDBProviderConfig = {
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

export type SurrealDBHandles = Map<
  string,
  {
    client: SurrealClient;
    providerConfig: SurrealDBProviderConfig;
  }
>;
