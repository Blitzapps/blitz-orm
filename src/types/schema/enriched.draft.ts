/**
 * These types are design for SurrealDB query in mind. For other DBs or for mutation, they may be missing some fields.
 */

import type { DataField, DiscreteCardinality } from "./fields";

export type DRAFT_EnrichedBormSchema = Record<string, DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation>;

export interface DRAFT_EnrichedBormEntity extends EnrichedBormThing {
  type: 'entity';
  fields: Record<string, DRAFT_EnrichedBaseBormField>;
}

export interface DRAFT_EnrichedBormRelation extends EnrichedBormThing {
  type: 'relation';
  fields: Record<string, DRAFT_EnrichedBormField>;
}

interface EnrichedBormThing {
  name: string;
  idFields: [string, ...string[]];
  extends?: string;
  subTypes: string[];
  indexes:  Index[];
}

export type DRAFT_EnrichedBaseBormField =
  | DRAFT_EnrichedBormConstantField
  | DRAFT_EnrichedBormComputedField
  | DRAFT_EnrichedBormDataField
  | DRAFT_EnrichedBormLinkField
  | DRAFT_EnrichedBormRefField;

export type DRAFT_EnrichedBormField = DRAFT_EnrichedBaseBormField | DRAFT_EnrichedBormRoleField;

export interface DRAFT_EnrichedBormConstantField {
  type: 'constant';
  name: string;
  contentType: DataField['contentType'];
  cardinality: DiscreteCardinality;
  value: unknown;
}

export interface DRAFT_EnrichedBormComputedField {
  type: 'computed';
  name: string;
  contentType: DataField['contentType'];
  cardinality: DiscreteCardinality;
  fn: (currentNode: Record<string, unknown>) => unknown;
}

export interface DRAFT_EnrichedBormDataField {
  type: 'data';
  name: string;
  contentType: DataField['contentType'];
  cardinality: DiscreteCardinality;
  unique: boolean;
}

export interface DRAFT_EnrichedBormRoleField {
  type: 'role';
  name: string;
  cardinality: DiscreteCardinality;
  opposite: {
    thing: string;
    path: string;
    cardinality: DiscreteCardinality;
  };
}

export interface DRAFT_EnrichedBormLinkField {
  type: 'link';
  name: string;
  cardinality: DiscreteCardinality;
  opposite: {
    thing: string;
    path: string;
    cardinality: DiscreteCardinality;
  };
}

/**
 * Content type REF allows referencing any record in the database.
 * Content type FLEX allows storing any type of data including reference to any record in the database.
 */
export interface DRAFT_EnrichedBormRefField {
  type: 'ref';
  name: string;
  contentType: 'REF' | 'FLEX';
  cardinality: 'ONE' | 'MANY';
}

export type Index = SingleIndex | CompositeIndex;

export interface SingleIndex {
  type: 'single';
  field: string;
}

export interface CompositeIndex {
  type: 'composite';
  fields: [string, ...string[]];
}