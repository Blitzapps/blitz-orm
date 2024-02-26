import type { LinkedFieldWithThing, Filter, BormEntity, BormRelation, DBHandleKey } from '..';
import type { AdapterContext } from '../../adapters';
import type { RoleField, DataField, BormField } from './fields';

export type EnrichedBormSchema = {
	entities: { [s: string]: EnrichedBormEntity };
	relations: { [s: string]: EnrichedBormRelation };
};

type SharedEnrichedProps = {
	name: string;
	computedFields: string[];
	virtualFields: string[];
	requiredFields: string[];
	enumFields: string[];
	fnValidatedFields: string[];
	linkFields?: EnrichedLinkField[];
	dataFields?: EnrichedDataField[];
	db: DBHandleKey;
	dbContext: AdapterContext;
};

export type EnrichedBormEntity = Omit<BormEntity, 'linkFields' | 'idFields' | 'dataFields'> & {
	extends?: string;
	thingType: 'entity';
	allExtends?: string[];
	idFields: string[];
} & SharedEnrichedProps;

export type EnrichedBormRelation = Omit<BormRelation, 'linkFields' | 'dataFields'> & {
	thingType: 'relation';
	roles: { [key: string]: EnrichedRoleField };
} & SharedEnrichedProps;

export type EnrichedRoleField = RoleField & {
	playedBy?: LinkedFieldWithThing[]; // computed variable.
	name: string;
	fieldType: 'roleField';
};

export type EnrichedDataField = DataField & {
	dbPath: string;
};

export type EnrichedLinkField = BormField & {
	name: string; // same as the key it has
	relation: string;
	plays: string;
	fieldType: 'linkField';
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
