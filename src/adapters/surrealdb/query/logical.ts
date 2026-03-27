import type { BQLFilterValue, BQLFilterValueList } from '../../../types/requests/parser';

export interface LogicalQuery {
  source: DataSource;
  projection: Projection;
  filter?: Filter;
  limit?: number;
  offset?: number;
  sort?: Sort[];
  cardinality: 'MANY' | 'ONE';
}

export type DataSource = TableScan | RecordPointer | SubQuery;

export interface TableScan {
  type: 'table_scan';
  thing: [string, ...string[]];
}

export interface RecordPointer {
  type: 'record_pointer';
  thing: [string, ...string[]];
  ids: string[];
}

export interface SubQuery {
  type: 'subquery';
  source: DataSource;
  /**
   * The link/role field path of the `source` thing to the parent thing. Example: If the parent thing is "User" and the source thing is "Post" then the opposite path is "author", not "authoredPosts".
   */
  oppositePath: string;
  /** True when oppositePath is a COMPUTED link field (use computedFieldNameSurrealDB for escaping). */
  isComputedPath?: boolean;
  filter?: Filter;
  /**
   * The cardinality of the sub-query result. If the surql sub-query returns an array the cardinality is 'MANY'. Otherwise it is 'ONE'.
   */
  cardinality: 'MANY' | 'ONE';
}

export interface Projection {
  fields: ProjectionField[];
}

export type ProjectionField =
  | MetadataField
  | DataField
  | RefField
  | ComputedRefField
  | NestedRefField
  | NestedComputedRefField
  | FlexField;

export interface MetadataField {
  type: 'metadata';
  path: '$id' | '$thing';
  alias?: string;
}

export interface DataField {
  type: 'data';
  path: string;
  alias?: string;
}

interface BaseRefField {
  path: string;
  alias?: string;
  resultCardinality: 'MANY' | 'ONE';
  fieldCardinality: 'MANY' | 'ONE';
}

export interface RefField extends BaseRefField {
  type: 'ref';
}

export interface ComputedRefField extends BaseRefField {
  type: 'computed_ref';
}

interface BaseNestedRefField {
  path: string;
  projection: Projection;
  ids?: string[];
  filter?: Filter;
  alias?: string;
  resultCardinality: 'MANY' | 'ONE';
  fieldCardinality: 'MANY' | 'ONE';
  limit?: number;
  offset?: number;
  sort?: Sort[];
}

export interface NestedRefField extends BaseNestedRefField {
  type: 'nested_ref';
}

export interface NestedComputedRefField extends BaseNestedRefField {
  type: 'nested_computed_ref';
}

export interface FlexField {
  type: 'flex';
  path: string;
  alias?: string;
  cardinality: 'MANY' | 'ONE';
}

export type Filter =
  | ScalarFilter
  | ListFilter
  | RefFilter
  | BiRefFilter
  | ComputedBiRefFilter
  | LogicalOp
  | NotOp
  | NestedFilter
  | NestedComputedFilter
  | NullFilter
  | FalsyFilter;

export interface ScalarFilter {
  type: 'scalar';
  op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'CONTAINS' | 'CONTAINSNOT';
  left: string;
  right: BQLFilterValue;
}

export interface ListFilter {
  type: 'list';
  op: 'IN' | 'NOT IN' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE';
  left: string;
  right: BQLFilterValueList;
}

interface BaseRefFilter {
  op: 'IN' | 'NOT IN' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE';
  left: string;
  right: string[];
  /**
   * Used for reference filter optimization when the values are pointers. If specified the execution may use indexes.
   * If not specified the filter will be transformed into `record::id(<left>) IN [<right>, ...]`,
   * which is a little bit slower than `<left> IN [type::record(<right>), ...]` when both are executed without indexes.
   */
  thing?: [string, ...string[]];
  cardinality: 'MANY' | 'ONE';
}

export interface RefFilter extends BaseRefFilter {
  type: 'ref';
}

export interface BiRefFilter extends BaseRefFilter {
  type: 'biref';
  oppositeCardinality: 'MANY' | 'ONE';
}

export interface ComputedBiRefFilter extends BaseRefFilter {
  type: 'computed_biref';
  oppositeCardinality: 'MANY' | 'ONE';
}

export interface NullFilter {
  type: 'null';
  op: 'IS' | 'IS NOT';
  left: string;
  /** True when the field's empty representation is `[]` instead of `NONE`.
   *  Only true for MANY cardinality link fields (COMPUTED fields without array::first wrapper). */
  emptyIsArray: boolean;
}

export interface FalsyFilter {
  type: 'falsy';
}
export interface LogicalOp {
  type: 'and' | 'or';
  filters: Filter[];
}

export interface NotOp {
  type: 'not';
  filter: Filter;
}

export interface BaseNestedFilter {
  filter: Filter;
  path: string;
  cardinality: 'MANY' | 'ONE';
  oppositeCardinality: 'MANY' | 'ONE';
}

export interface NestedFilter extends BaseNestedFilter {
  type: 'nested_ref';
}

export interface NestedComputedFilter extends BaseNestedFilter {
  type: 'nested_computed_ref';
}

export type ScalarList = Scalar[];
export type Scalar = string | number | boolean | null;

export interface Sort {
  field: string;
  desc: boolean;
}
