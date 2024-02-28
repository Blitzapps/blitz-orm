import type { BaseResponse } from '../../../types';

export type SurrealDbResponse = BaseResponse;

type EnrichedBQLQueryThingProps = {
	$thing: string;
	$thingType: string;
	$as: string;
	$fields: Array<any>;
	$excludedFields?: Array<any>;
	$id?: string;

	// other common props
	$path: string;
	$dbPath: string;
	$var: string;
	$fieldType: string;
	$filter?: Record<string, string>;
	$filterProcessed: boolean;
};

type EnrichedBqlQueryRelationOrEntityProps = {
	$plays: string;
	$target: string;
	$intermediary: string;
	$justId: boolean;
	$idNotIncluded: boolean;
	$filterByUnique: boolean;
};

type EnrichedBqlQueryPlayedBy = {
	path: string;
	relation: string;
	plays: string;
	target: string;
	thing: string;
	thingType: string;
};

export type EnrichedBqlQueryRelation = {
	$thingType: 'relation';
	$playedBy: EnrichedBqlQueryPlayedBy;
} & EnrichedBqlQueryRelationOrEntityProps &
	EnrichedBQLQueryThingProps;

export type EnrichedBqlQueryEntity = {
	$thingType: 'entity';
	$playedBy: {
		cardinality: 'ONE' | 'MANY';
	} & EnrichedBqlQueryPlayedBy;
} & EnrichedBqlQueryRelationOrEntityProps &
	EnrichedBQLQueryThingProps;

export type EnrichedBqlQueryAttribute = {
	$thingType: 'attribute';
	$fieldType: 'data';
	$justId: boolean;
	$isVirtual: undefined;
} & EnrichedBQLQueryThingProps;

export type EnrichedBqlQuery = {
	$path: string;
	$thing: string;
	$thingType: 'entity' | 'relation';
	$filter?: { id: string };
	$fields: Array<EnrichedBqlQueryAttribute | EnrichedBqlQueryEntity | EnrichedBqlQueryRelation>;
	$idNotIncluded?: boolean;
};
