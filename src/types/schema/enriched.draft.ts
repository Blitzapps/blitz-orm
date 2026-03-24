/**
 * These types are design for SurrealDB query in mind. For other DBs or for mutation, they may be missing some fields.
 */

import type { ContentType, ContentTypeMapping, DataField, DiscreteCardinality } from './fields';

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
  indexes: Index[];
  hooks?: DRAFT_Hooks;
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

/**
 * Data fields that are computed at runtime by the BORM engine.
 */
export interface DRAFT_EnrichedBormComputedField {
  type: 'computed';
  name: string;
  contentType: DataField['contentType'];
  cardinality: DiscreteCardinality;
  fn: (currentNode: Record<string, unknown>) => unknown;
}

export type DRAFT_DataFieldDefault<CT extends ContentType = ContentType> =
  | { type: 'value'; value: ContentTypeMapping[CT] | null }
  | { type: 'fn'; fn: (currentNode: Record<string, unknown>) => ContentTypeMapping[CT] | null };

export type DRAFT_Validations<CT extends ContentType = ContentType> = {
  required?: boolean;
  unique?: boolean;
  enum?: ContentTypeMapping[CT][];
  fn?: (value: ContentTypeMapping[CT]) => boolean;
};

export interface DRAFT_EnrichedBormDataField<CT extends ContentType = ContentType> {
  type: 'data';
  name: string;
  contentType: CT;
  cardinality: DiscreteCardinality;
  unique: boolean;
  default?: DRAFT_DataFieldDefault<CT>;
  validations?: DRAFT_Validations<CT>;
  isVirtual?: boolean;
  dbValue?: { surrealDB?: string; typeDB?: string };
}

export interface DRAFT_EnrichedBormRoleField {
  type: 'role';
  name: string;
  cardinality: DiscreteCardinality;
  onDelete?: 'CASCADE' | 'UNSET' | 'IGNORE';
  opposite: {
    thing: string;
    path: string;
    cardinality: DiscreteCardinality;
  };
}

export type DRAFT_EnrichedBormLinkField =
  | DRAFT_EnrichedBormLinkFieldTargetRelation
  | DRAFT_EnrichedBormLinkFieldTargetRole;

interface DRAFT_BaseEnrichedBormLinkField {
  type: 'link';
  name: string;
  cardinality: DiscreteCardinality;
  /** The relation this link goes through. */
  relation: string;
  /** The role this entity plays in the relation. */
  plays: string;
  opposite: {
    thing: string;
    path: string;
    cardinality: DiscreteCardinality;
  };
  isVirtual?: boolean;
  // Defined only if isVirtual is true
  dbValue?: { surrealDB?: string; typeDB?: string };
}

export interface DRAFT_EnrichedBormLinkFieldTargetRelation extends DRAFT_BaseEnrichedBormLinkField {
  target: 'relation';
}

export interface DRAFT_EnrichedBormLinkFieldTargetRole extends DRAFT_BaseEnrichedBormLinkField {
  target: 'role';
  /** The target role name on the relation. */
  targetRole: string;
  /** Cardinality of the target role field on the relation.
   *  When MANY, the COMPUTED field result is nested arrays (array of arrays) requiring
   *  array::flatten() in the schema COMPUTED definition.
   *  When ONE, the COMPUTED field result is a flat array. */
  targetRoleCardinality: DiscreteCardinality;
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

// --- Hook types ---

export type DRAFT_BormTrigger = 'onCreate' | 'onUpdate' | 'onDelete' | 'onLink' | 'onUnlink' | 'onReplace' | 'onMatch';

export type DRAFT_TransformAction = {
  type: 'transform';
  fn: (
    currentNode: Record<string, unknown>,
    parentNode: Record<string, unknown>,
    context: Record<string, unknown>,
    // TODO: Pre-query is not implemented for the SurrealDB mutation adapter.
    // Once implemented, this will contain the current DB state of the node.
    dbNode: Record<string, unknown>,
  ) => Partial<Record<string, unknown>>;
};

export type DRAFT_ValidateAction = {
  type: 'validate';
  fn: (
    currentNode: Record<string, unknown>,
    parentNode: Record<string, unknown>,
    context: Record<string, unknown>,
    // TODO: Pre-query is not implemented for the SurrealDB mutation adapter.
    // Once implemented, this will contain the current DB state of the node.
    dbNode: Record<string, unknown>,
  ) => boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type DRAFT_Action = { name?: string; description?: string } & (DRAFT_TransformAction | DRAFT_ValidateAction);

export type DRAFT_PreHook = {
  triggers?: { [K in DRAFT_BormTrigger]?: () => boolean };
  actions: readonly DRAFT_Action[];
};

export type DRAFT_Hooks = {
  pre?: readonly DRAFT_PreHook[];
};
