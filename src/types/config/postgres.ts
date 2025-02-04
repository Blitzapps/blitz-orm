import type { Client } from 'pg';
import type { CommonProvider } from './base';

export interface PostgresDBProvider extends CommonProvider {
	provider: 'postgresDB';
	host: string;
	port: number;
	user: string;
	password: string;
}

export type PostgresDBHandles = Map<string, { client: Client }>;
