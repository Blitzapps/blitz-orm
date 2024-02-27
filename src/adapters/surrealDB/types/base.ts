import type { BaseResponse } from '../../../types';

export type SurrealDbResponse = {} & BaseResponse;

export type EnrichedBqlQueryRelation = {
	$thingType: 'relation';
	$plays: string;
	$playedBy: {
		path: string;
		relation: string;
		plays: string;
		target: string;
		thing: string;
		thingType: string;
	};
	$path: string;
	$dbPath: undefined;
	$as: string;
	$var: string;
	$thing: string;
	$fields: Array<any>;
	$excludedFields: undefined;
	$fieldType: string;
	$target: string;
	$intermediary: string;
	$justId: boolean;
	$id: undefined;
	$filter: {};
	$idNotIncluded: boolean;
	$filterByUnique: boolean;
	$filterProcessed: boolean;
};

export type EnrichedBqlQueryEntity = {
	$thingType: 'entity';
	$plays: string;
	$playedBy: {
		path: string;
		cardinality: 'ONE' | 'MANY';
		relation: string;
		plays: string;
		target: string;
		thing: string;
		thingType: string;
	};
	$path: string;
	$dbPath: undefined;
	$as: string;
	$var: string;
	$thing: string;
	$fields: Array<any>;
	$excludedFields: undefined;
	$fieldType: string;
	$target: string;
	$intermediary: string;
	$justId: boolean;
	$id: undefined;
	$filter: {};
	$idNotIncluded: boolean;
	$filterByUnique: boolean;
	$filterProcessed: boolean;
};

export type EnrichedBqlQueryAttribute = {
	$path: string;
	$dbPath: string;
	$thingType: 'attribute';
	$as: string;
	$var: string;
	$fieldType: 'data';
	$excludedFields: undefined;
	$justId: boolean;
	$id: undefined;
	$filter: undefined;
	$isVirtual: undefined;
	$filterProcessed: boolean;
};

export type EnrichedBqlQuery = {
	$path: string;
	$thing: string;
	$thingType: 'entity' | 'relation';
	$filter?: { id: string };
	$fields: Array<EnrichedBqlQueryAttribute | EnrichedBqlQueryEntity | EnrichedBqlQueryRelation>;
	$idNotIncluded?: boolean;
};
