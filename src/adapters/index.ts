import type { DBHandleKey } from '../types';

export type AdapterContext = {
  mutation: {
    splitArray$Ids: boolean;
    requiresParseBQL: boolean;
  };
};

export const adapterContext: Record<DBHandleKey, AdapterContext> = {
  typeDB: {
    mutation: {
      splitArray$Ids: true,
      requiresParseBQL: true,
    },
  },
  surrealDB: {
    mutation: {
      splitArray$Ids: false, //probably not needed
      requiresParseBQL: false, //probably not needed
    },
  },
} as const;
