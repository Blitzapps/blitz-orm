import type { BQLField, EnrichedBormEntity, EnrichedBormRelation } from '..';

export type RawBQLQuery = {
	$id?: string | string[];
	$filter?: Record<string, any>; // todo
	$fields?: BQLField[]; // nested don't need it, is specified by the parent. Todo: enrich queries and mutations so nested do show their types
	$excludedFields?: BQLField[];
} & ({ $entity: string } | { $relation: string } | { $thing: string; $thingType: 'entity' | 'relation' });

export type ParsedBQLQuery = Omit<RawBQLQuery, '$entity' | '$relation' | '$thing' | '$thingType'> & {
	// $entity: { name: string; definition: BormEntity };
	$localFilters?: Record<string, any>; // todo:
	$nestedFilters?: Record<string, any>; // todo:
} & ({ $entity: EnrichedBormEntity } | { $relation: EnrichedBormRelation });
