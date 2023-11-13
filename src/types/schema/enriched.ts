import type { LinkedFieldWithThing, Filter, BormEntity, BormRelation } from '..';
import type { RoleField, DataField, BormField } from './fields';

export type EnrichedBormSchema = {
	entities: { [s: string]: EnrichedBormEntity };
	relations: { [s: string]: EnrichedBormRelation };
};

export type EnrichedBormEntity = Omit<BormEntity, 'linkFields' | 'idFields' | 'dataFields'> & {
	extends?: string;
	allExtends?: string[];
	idFields: string[];
	thingType: 'entity';
	name: string;
	computedFields: string[];
	virtualFields: string[];
	linkFields?: EnrichedLinkField[];
	dataFields?: EnrichedDataField[];
};

export type EnrichedBormRelation = Omit<BormRelation, 'linkFields' | 'dataFields'> & {
	thingType: 'relation';
	name: string;
	computedFields: string[];
	virtualFields: string[];
	linkFields?: EnrichedLinkField[];
	dataFields?: EnrichedDataField[];
	roles: { [key: string]: EnrichedRoleField };
};

export type EnrichedRoleField = RoleField & {
	playedBy?: LinkedFieldWithThing[]; // computed variable.
	name: string;
};

export type EnrichedDataField = DataField & {
	dbPath: string;
};

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
