import type { LinkedFieldWithThing, BormEntity, BormRelation, DBHandleKey } from '..';
import type { AdapterContext } from '../../adapters';
import type { SharedMetadata, SuqlMetadata } from '../symbols';
import type { RoleField, DataField, LinkField } from './fields';

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
	allExtends?: string[];
	subTypes?: string[];
};

export type EnrichedBormEntity = Omit<BormEntity, 'linkFields' | 'idFields' | 'dataFields'> & {
	extends?: string;
	thingType: 'entity';
	idFields: string[];
} & SharedEnrichedProps;

export type EnrichedBormRelation = Omit<BormRelation, 'linkFields' | 'dataFields'> & {
	thingType: 'relation';
	roles: { [key: string]: EnrichedRoleField };
	idFields: string[];
} & SharedEnrichedProps;

export type EnrichedRoleField = RoleField & {
	name: string;
	playedBy?: LinkedFieldWithThing[]; // computed variable.
	$things: string[]; //all potential candidates
	fieldType: 'roleField';
	[SharedMetadata]: {
		inheritanceOrigin: string;
	};
	[SuqlMetadata]: {
		queryPath: string;
	};
};

export type EnrichedDataField = DataField & {
	dbPath: string;
	[SharedMetadata]: {
		inheritanceOrigin: string;
	};
};

export type EnrichedLinkField = LinkField & {
	name: string; // same as the key it has, maybe to rename to key
	relation: string;
	plays: string;
	$things: string[]; //all potential candidates
	fieldType: 'linkField';
	[SharedMetadata]: {
		inheritanceOrigin: string;
	};
	[SuqlMetadata]: {
		queryPath: string;
	};
} & (
		| {
				target: 'role';
				//filter?: Filter | Filter[]; // * if specified, filters the things automatically
				targetRoles?: string[]; // * these are the roles that are played by the opposite entity.
				oppositeLinkFieldsPlayedBy: LinkedFieldWithThing[]; // * these are all the potential linkFields that are in the other side of the tunnel
		  }
		| {
				target: 'relation';
				//filter?: Filter | Filter[]; // * if specified, filters the things, if not, we get every entity playing the opposite role
				oppositeLinkFieldsPlayedBy: Pick<LinkedFieldWithThing, 'thing' | 'thingType' | 'plays'>[]; // * just a copy of the information already in base level
		  }
	);
