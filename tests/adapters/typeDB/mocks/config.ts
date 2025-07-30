import dotenv from 'dotenv';
import type { BormConfig } from '../../../../src';

dotenv.config();

// eslint-disable-next-line turbo/no-undeclared-env-vars
const typeDbUrl = process.env.TYPE_DB_URL as string;
if (!typeDbUrl) {
  throw new Error('TYPE_DB_URL is not defined');
}

export const typeDBTestConfig: BormConfig = {
  server: {
    provider: 'blitz-orm-js',
  },
  dbConnectors: [
    {
      id: 'default',
      provider: 'typeDB',
      dbName: 'test',
      url: typeDbUrl,
    },
  ],
};
