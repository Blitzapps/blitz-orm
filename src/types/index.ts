import { TypeDBClient, TypeDBCredential, TypeDBSession } from 'typedb-client';

export type BormConfig = {
  server: {
    provider: 'blitz-orm-js';
  };
  // queryDefaults
  query?: {
    noMetadata?: boolean;
    simplifiedLinks?: boolean;
    debugger?: boolean;
  };
  mutation?: {
    noMetadata?: boolean;
  };
  dbConnectors: [ProviderObject, ...ProviderObject[]]; // minimum one
};

export type ProviderObject =
  | (TypeDBProviderObject & CommonProperties)
  | (TypeDBClusterProviderObject & CommonProperties);

export interface CommonProperties {
  id: string;
  dbName: string;
}

export type Provider = 'typeDB' | 'typeDBCluster';

export interface TypeDBProviderObject {
  provider: 'typeDB';
  url: string;
}

export interface TypeDBClusterProviderObject {
  provider: 'typeDBCluster';
  addresses: string[];
  credentials: TypeDBCredential;
}

// export type DBType = "typeDB" | "dgraph";

export type DBConnector = {
  id: string;
  subs?: string;
  path?: string; // * Overrides the default db path
  as?: string;
};

type TypeDBHandles = Map<string, { client: TypeDBClient; session: TypeDBSession }>;

export type DBHandles = {
  typeDB: TypeDBHandles;
};

// Schemas

export type BormSchema = {
  entities: { [s: string]: BormEntity };
  relations: { [s: string]: BormRelation };
};

export type EnrichedBormSchema = {
  entities: { [s: string]: EnrichedBormEntity };
  relations: { [s: string]: EnrichedBormRelation };
};

export type BormEntity =
  | {
      extends: string;
      idFields?: string[];
      defaultDBConnector: DBConnector; // at least one default connector
      dataFields?: DataField[];
      linkFields?: LinkField[];
    }
  | {
      extends?: string;
      idFields: string[];
      defaultDBConnector: DBConnector; // at least one default connector
      dataFields?: DataField[];
      linkFields?: LinkField[];
    };

export type BormRelation = BormEntity & {
  defaultDBConnector: DBConnector & { path: string }; /// mandatory in relations
  roles?: { [key: string]: RoleField };
};

export type EnrichedBormEntity = Omit<BormEntity, 'linkFields' | 'idFields' | 'dataFields'> & {
  extends?: string;
  allExtends?: string[];
  idFields: string[];
  thingType: 'entity';
  name: string;
  computedFields: string[];
  linkFields?: EnrichedLinkField[];
  dataFields?: EnrichedDataField[];
};

export type EnrichedBormRelation = Omit<BormRelation, 'linkFields' | 'dataFields'> & {
  thingType: 'relation';
  name: string;
  computedFields: string[];
  linkFields?: EnrichedLinkField[];
  dataFields?: EnrichedDataField[];
  roles: { [key: string]: EnrichedRoleField };
};

export type LinkField = BormField & {
  relation: string;
  plays: string;
} & (
    | {
        target: 'role';
        filter?: Filter | Filter[];
      }
    | {
        target: 'relation';
      }
  );

export type LinkedFieldWithThing = LinkField & {
  thing: string;
  thingType: ThingType;
};

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

export type LinkFilter = {
  $thing?: string;
  $thingType?: string;
  $role?: string;
  [key: string]: string | number | Filter | undefined;
};

export type Filter = DataFilter | LinkFilter | MiddleFilter;

export type MiddleFilter = {
  $and?: Filter[];
  $or?: Filter[];
};

export type DataFilter = RequireAtLeastOne<{
  $eq?: any;
  $ge?: number | string;
}>;

export type EnrichedLinkField = BormField & {
  name: string; // same as the key it has
  relation: string;
  plays: string;
} & (
    | {
        target: 'role';
        filter?: Filter | Filter[]; // * if specified, filters the things, if not, we get every entity playing the opposite role
        oppositeLinkFieldsPlayedBy: LinkedFieldWithThing[]; // * these are all the linkfields that play the
      }
    | {
        target: 'relation';
        oppositeLinkFieldsPlayedBy: Pick<LinkedFieldWithThing, 'thing' | 'thingType' | 'plays'>[]; // * just a copy of the information already in base level
      }
  );

export type BormField = {
  path: string;
  cardinality: CardinalityType;
  ordered?: boolean;
  embedded?: boolean;
  rights?: RightType[];
};

export type RoleField = {
  // LATER?: path: string;
  // YES: validations => For exzample make one of the roles required
  // YES: default => Why not, one relation could have a default value
  cardinality: CardinalityType;
  // MAYBE: rigths => Why not, maybe relation.particular child has better rigths than otherchild.relation.particular child
  // NO: ordered => This can be really messy. Probably roles should never be ordered as relations are precisely the ones having the index
  dbConnector?: DBConnector;
};

export type EnrichedRoleField = RoleField & {
  playedBy?: LinkedFieldWithThing[]; // computed variable.
  name: string;
};

export type DataField = BormField & {
  shared?: boolean;
  default?: any; // todo: is either a value or a fn that return a value of the type datatype
  contentType: ContentType;
  validations?: any; // todo
  dbConnectors?: [DBConnector, ...DBConnector[]];
};

export type EnrichedDataField = DataField & {
  dbPath: string;
};

export type ThingType = 'entity' | 'relation' | 'attribute';

export type RightType = 'CREATE' | 'DELETE' | 'UPDATE' | 'LINK' | 'UNLINK';

export type ContentType =
  | 'ID'
  | 'JSON'
  | 'COLOR'
  | 'BOOLEAN'
  | 'POINT'
  | 'FILE'
  | 'EMAIL'
  | 'PHONE'
  | 'WEEK_DAY'
  | 'DURATION'
  | 'HOUR'
  | 'TIME'
  | 'DATE'
  | 'RATING'
  | 'CURRENCY'
  | 'PERCENTAGE'
  | 'NUMBER_DECIMAL'
  | 'NUMBER'
  | 'URL'
  | 'PASSWORD'
  | 'LANGUAGE_TEXT'
  | 'RICH_TEXT'
  | 'TEXT';

export type CardinalityType = 'ONE' | 'MANY' | 'INTERVAL';

export type RelationClassType = 'SYMMETRICAL' | 'OWNED';

type RequiredKey<T, K extends keyof T> = T & { [P in K]-?: T[P] };

type WithRequired<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & RequiredKey<T, K>;

export type BQLMutationBlock = {
  [key: string]: any;
  $id?: string | string[];
  $filter?: Filter | Filter[]; // todo: keyof BQLmutationBlock
  $tempId?: string;
  $op?: string;
} & ({ $entity: string } | { $relation: string }); // | { $attribute: string });
export type FilledBQLMutationBlock = WithRequired<BQLMutationBlock, '$tempId' | '$op'>;

export type BQLFieldObj = { $path: string } & Omit<RawBQLQuery, '$entity' | '$relation'>;
export type BQLField = string | BQLFieldObj;

export type RawBQLQuery = {
  $id?: string | string[];
  $filter?: Record<string, any>; // todo
  $fields?: BQLField[]; // nested don't need it, is specified by the parent. Todo: enrich queries and mutations so nested do show their types
  $excludedFields?: BQLField[];
} & ({ $entity: string } | { $relation: string });

export type RawBQLMutation = (
  | {
      $entity: string;
    }
  | {
      $relation: string;
    }
) &
  Record<string, any>; /// TODO : explicitly type available fields

export type ParsedBQLQuery = Omit<RawBQLQuery, '$entity' | '$relation'> & {
  // $entity: { name: string; definition: BormEntity };
  $localFilters?: Record<string, any>; // todo:
  $nestedFilters?: Record<string, any>; // todo:
} & ({ $entity: EnrichedBormEntity } | { $relation: EnrichedBormRelation });

export type ParsedBQLMutation = {
  things: BQLMutationBlock[];
  edges: BQLMutationBlock[];
};

export type TQLRequest = {
  // queries
  entity?: string;
  roles?: { path: string; request: string; owner: string }[];
  relations?: { relation: string; entity: string; request: string }[];
  // mutations
  insertionMatches?: string;
  deletionMatches?: string;
  insertions?: string;
  deletions?: string;
};

export type TQLEntityMutation = {
  entity: string;
  relations?: { relation: string; entity: string; request: string }[];
};

export type BQLResponseSingle = (({ $entity: string; $id: string } | undefined) & Record<string, any>) | string | null;

export type BQLResponseMulti = BQLResponseSingle[];

export type BQLResponse = BQLResponseSingle | BQLResponseMulti;
