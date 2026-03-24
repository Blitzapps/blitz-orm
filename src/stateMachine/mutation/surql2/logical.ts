import type { RecordId } from 'surrealdb';
import type { DataSource, Filter } from '../../query/surql2/logical';

export type { DataSource, Filter } from '../../query/surql2/logical';

export interface LogicalMutation {
  matches: Match[];
  subMatches: SubMatch[];
  creates: CreateMut[];
  updates: UpdateMut[];
  deletes: DeleteMut[];
  /** "Link all" operations: create intermediary relations for all existing entities */
  linkAlls?: LinkAllOp[];
}

export interface LinkAllOp {
  /** Tables to scan for existing entities */
  oppositeThings: string[];
  /** The intermediary relation table */
  relation: string;
  /** The role field for the parent entity */
  playsField: string;
  /** The role field for the target entity */
  targetRoleField: string;
  /** Cardinality of the plays role */
  playsCardinality: 'ONE' | 'MANY';
  /** Cardinality of the target role */
  targetCardinality: 'ONE' | 'MANY';
  /** Parent entity thing name */
  parentThing: string;
  /** Parent entity id */
  parentId: string;
}

export interface Match {
  name: string;
  source: DataSource;
  filter?: Filter | Filter[];
}

export interface SubMatch {
  name: string;
  parent: string;
  path: string;
  cardinality: 'ONE' | 'MANY';
  /** True when path is a COMPUTED link field (use computedFieldNameSurrealDB for escaping) */
  isComputed?: boolean;
  ids?: string[];
  filter?: Filter | Filter[];
}

export interface CreateMut {
  name: string;
  thing: string;
  id: string;
  tempId?: string;
  op: 'create';
  /** True for auto-generated intermediary relation creates */
  isIntermediary?: boolean;
  values: Record<string, ValueMut>;
}

export interface UpdateMut {
  name: string;
  match: string;
  op: 'update';
  values: Record<string, ValueMut>;
}

export interface DeleteMut {
  name: string;
  match: string;
  op: 'delete';
}

export type ValueMut =
  | DataFieldValueMut
  | RefFieldValueMut
  | FlexFieldValueMut
  | RoleFieldValueMut
  | NullValueMut
  | EmptyValueMut;

export interface NullValueMut {
  type: 'null';
  path: string;
}

export interface EmptyValueMut {
  type: 'empty';
  path: string;
}

// --- Data fields ---

export type DataFieldValueMut = OneDataFieldValueMut | ManyDataFieldValueMut;

export interface OneDataFieldValueMut {
  type: 'data_field';
  cardinality: 'ONE';
  path: string;
  value: unknown;
}

export interface ManyDataFieldValueMut {
  type: 'data_field';
  cardinality: 'MANY';
  path: string;
  value: unknown[];
}

// --- Ref fields ---

export type RefFieldValueMut = OneRefFieldValueMut | ManyRefFieldValueMut;

export interface OneRefFieldValueMut {
  type: 'ref_field';
  cardinality: 'ONE';
  path: string;
  value: string; // "Thing:id"
}

export interface ManyRefFieldValueMut {
  type: 'ref_field';
  cardinality: 'MANY';
  path: string;
  value: string[]; // ["Thing:id", ...]
}

// --- Flex fields ---

export type FlexFieldValueMut = OneFlexFieldValueMut | ManyFlexFieldValueMut;

export type FlexValue = string | number | boolean | null | Date | RecordId | FlexValue[] | { [key: string]: FlexValue };

export interface OneFlexFieldValueMut {
  type: 'flex_field';
  cardinality: 'ONE';
  path: string;
  value: FlexValue;
}

export interface ManyFlexFieldValueMut {
  type: 'flex_field';
  cardinality: 'MANY';
  path: string;
  value: FlexValue[];
}

// --- Role fields ---

export type RoleFieldValueMut = OneRoleFieldValueMut | ManyRoleFieldValueMut;

export interface OneRoleFieldValueMut {
  type: 'role_field';
  cardinality: 'ONE';
  path: string;
  ref: Ref;
}

export type ManyRoleFieldValueMut = ManyRoleFieldReplaceValueMut | ManyRoleFieldPatchValueMut;

export interface ManyRoleFieldReplaceValueMut {
  type: 'role_field';
  cardinality: 'MANY';
  op: 'replace';
  path: string;
  refs: Ref[];
}

export interface ManyRoleFieldPatchValueMut {
  type: 'role_field';
  cardinality: 'MANY';
  op: 'patch';
  path: string;
  links: Ref[];
  unlinks: Ref[];
}

export interface Ref {
  thing: string;
  /** Additional table names for subtypes (used when resolving extended types) */
  subTypes?: string[];
  id: string;
}
