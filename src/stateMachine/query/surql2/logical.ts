import type { BQLFilterValue, BQLFilterValueList } from "../../../types/requests/parser";

export interface LogicalQuery {
  source: DataSource;
  projection: Projection;
  filter?: Filter;
  limit?: number;
  offset?: number;
  sort?: Sort[];
  cardinality: 'MANY' | 'ONE';
};

export type DataSource = 
  | TableScan
  | RecordPointer
  | SubQuery;

export interface TableScan {
  type: 'table_scan';
  thing: [string, ...string[]];
};

export interface RecordPointer {
  type: 'record_pointer';
  thing: [string, ...string[]];
  ids: string[];
};

export interface SubQuery {
  type: 'subquery';
  source: DataSource;
  /**
   * The link/role field path of the `source` thing. Example: If the source thing is "Post" then path is "author", not "authoredPosts".
   */
  oppositePath: string;
  /**
   * The cardinality of the reference in DB. COMPUTED REFERENCE is always 'MANY'.
   */
  filter?: Filter;
  cardinality: 'MANY' | 'ONE';
};

export interface Projection {
  fields: ProjectionField[];
}

export type ProjectionField = 
  | MetadataField
  | DataField
  | ReferenceField
  | NestedReferenceField
  | FlexField;

export interface MetadataField {
  type: 'metadata';
  path: '$id' | '$thing';
  alias?: string;
};

export interface DataField {
  type: 'data';
  path: string;
  alias?: string;
};

export interface ReferenceField {
  type: 'reference';
  path: string;
  alias?: string;
  cardinality: 'MANY' | 'ONE';
};

export interface NestedReferenceField {
  type: 'nested_reference';
  path: string;
  projection: Projection;
  ids?: string[];
  filter?: Filter;
  alias?: string;
  cardinality: 'MANY' | 'ONE';
  limit?: number;
  offset?: number;
  sort?: Sort[];
};

export interface FlexField {
  type: 'flex';
  path: string;
  alias?: string;
  cardinality: 'MANY' | 'ONE';
};

export type Filter = 
  | ScalarFilter
  | ListFilter
  | RefFilter
  | LogicalOp
  | NotOp
  | NestedFilter
  | NullFilter;

export interface ScalarFilter {
  type: 'scalar';
  op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'CONTAINS' | 'CONTAINSNOT';
  left: string;
  right: BQLFilterValue;
};

export interface ListFilter {
  type: 'list';
  op: 'IN' | 'NOT IN' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE';
  left: string;
  right: BQLFilterValueList;
};

export interface RefFilter {
  type: 'ref';
  op: 'IN' | 'NOT IN' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE';
  left: string;
  right: string[];
  /**
   * Used for reference filter optimization when `cast` is 'record'. If specified the execution may use indexes.
   * If not specified the filter will be transformed into `record::id(<left>) IN [<right>, ...]`,
   * which is a little bit slower than `<left> IN [type::record(<right>), ...]` when both are executed without indexes.
   */
  thing?: [string, ...string[]];
  /**
   * True if it's a link field with target "role".
   */
  tunnel: boolean;
};

export interface NullFilter {
  type: 'null';
  op: 'IS' | 'IS NOT';
  left: string;
  /**
   * True if it's a link field with target "role".
   */
  tunnel: boolean;
}

export interface LogicalOp {
  type: 'and' | 'or';
  filters: Filter[];
};

export interface NotOp {
  type: 'not';
  filter: Filter;
};

export interface NestedFilter {
  type: 'nested';
  filter: Filter;
  path: string;
  cardinality: 'MANY' | 'ONE';
}

export type ScalarList = Scalar[];
export type Scalar = string | number | boolean | null;

export interface Sort {
  field: string;
  desc: boolean;
}
