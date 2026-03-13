import type { SurrealClient } from '../../adapters/surrealDB/client';
import type { CommonProvider } from './base';

export interface SurrealDBProviderObject extends CommonProvider {
  provider: 'surrealDB';
  url: string;
  namespace: string;
  username: string;
  password: string;
}

export type SurrealDBHandles = Map<
  string,
  {
    client: SurrealClient;
  }
>;
