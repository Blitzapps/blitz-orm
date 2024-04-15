import type { BQLField } from '..';
import { QueryPath } from '../symbols';

export type Sorter = { field: string; desc?: boolean } | string;

export type FilterValue = string | number | boolean | string[] | number[] | boolean[];
export type PositiveFilter = { [field: string]: FilterValue };
export type NegativeFilter = { $not?: PositiveFilter };
export type Filter = PositiveFilter | NegativeFilter;

export type RawBQLQuery = {
	$id?: string | string[];
	$filter?: Filter;
	$fields?: BQLField[]; // nested don't need it, is specified by the parent. Todo: enrich queries and mutations so nested do show their types
	$excludedFields?: BQLField[];
	$sort?: Sorter[];
	$offset?: number;
	$limit?: number;
} & ({ $entity: string } | { $relation: string } | { $thing: string; $thingType: 'entity' | 'relation' });


export type EnrichedAttributeQuery = {
  $fieldType: 'data';
  $thingType: 'attribute';
  $path: string;
  $dbPath: string;
  $as: string;
  $var: string;
  $justId: boolean;
  $id: string,
  $isVirtual?: boolean;
};

// TODO: Update type based on these example
// Link opposite thing
// {
//   "path":"spaces",
//   "relation":"Space-User",
//   "cardinality":"MANY",
//   "plays":"users",
//   "target":"role",
//   "thing":"User",
//   "thingType":"entity"
// }
// {
//   "plays":"objects",
//   "thing":"SpaceObj",
//   "thingType":"relation"
// }
// Role played by
// {
//   "path":"things",
//   "cardinality":"MANY",
//   "relation":"ThingRelation",
//   "plays":"things",
//   "target":"relation",
//   "thing":"Thing",
//   "thingType":"entity"
// }
// {
//   "path":"user-tags",
//   "relation":"UserTag",
//   "cardinality":"MANY",
//   "plays":"users",
//   "target":"relation",
//   "thing":"User",
//   "thingType":"entity"
// }
export type PlayedBy = {
  path: string;
  cardinality: 'ONE' | 'MANY';
  relation: string;
  plays: string;
  target: 'role' | 'relation';
  thing: string;
  thingType: 'entity' | 'relation'
};

export type EnrichedLinkQuery = {
  $fieldType: 'link';
  $thingType: 'entity' | 'relation';
  $thing: string;
  $plays: string;
  $playedBy: PlayedBy;
  $path: string;
  $dbPath: string;
  $as: string;
  $var: string;
  $fields: EnrichedFieldQuery[];
  $target: 'relation' | 'role';
  $intermediary?: string;
  $justId: boolean;
  $id: string,
  $idNotIncluded?: boolean,
  $filter?: Filter;
  $filterByUnique: boolean;
  $filterProcessed: boolean;
	$sort?: Sorter[];
  $offset?: number;
  $limit?: number;
  [QueryPath]: string;
};

export type EnrichedRoleQuery = {
  $fieldType: 'role',
  $thingType: 'relation';
  $thing: string,
  $path: string,
  $dbPath: string,
  $as: string,
  $var: string,
  $fields: EnrichedFieldQuery[],
  $intermediary: string,
  $justId: string,
  $id: string,
  $idNotIncluded?: boolean,
  $filter?: Filter,
  $filterByUnique: boolean,
  $playedBy: PlayedBy,
  $filterProcessed: boolean,
	$sort?: Sorter[];
  $offset?: number,
  $limit?: number,
  [QueryPath]: string;
};

export type EnrichedFieldQuery = EnrichedAttributeQuery | EnrichedLinkQuery | EnrichedRoleQuery;

export type EnrichedEntityQuery = {
  $thingType: 'entity';
  $thing: string;
  $path: string;
  $fields: (EnrichedAttributeQuery | EnrichedLinkQuery)[];
  $idNotIncluded?: boolean,
  $filter?: Filter;
  $filterByUnique: boolean;
	$sort?: Sorter[];
  $offset?: number,
  $limit?: number,
  [QueryPath]: string;
};

export type EnrichedRelationQuery = {
  $thingType: 'relation';
  $thing: string;
  $path: string;
  $fields: EnrichedFieldQuery[];
  $idNotIncluded?: boolean,
  $filter?: Filter;
  $filterByUnique: boolean;
	$sort?: Sorter[];
  $offset?: number,
  $limit?: number,
  [QueryPath]: string;
};

export type EnrichedBQLQuery = EnrichedEntityQuery | EnrichedRelationQuery;
