import { TypeDBHandles } from "./typedb";

export interface SurrealDBProviderObject {
	provider: 'surrealDB';
	url: string;
  username: string;
  password: string;
}

export type SurrealDBHandles = TypeDBHandles