import type { LinkedFieldWithThing, BormEntity, BormRelation, DBHandleKey } from '..';
import type { AdapterContext } from '../../adapters';
import type { SharedMetadata, SuqlMetadata } from '../symbols';
import type { RoleField, DataField, LinkField, RefField } from './fields';

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
	refFields: { [key: string]: EnrichedRefField };
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
	path: string;
	playedBy?: LinkedFieldWithThing[]; // computed variable.
	impactedLinkFields?: LinkedFieldWithThing[]; // computed variable.
	$things: string[]; //all potential candidates
	fieldType: 'roleField';
	inherited: boolean;
	[SharedMetadata]: {
		inheritanceOrigin?: string;
		fieldType: 'roleField';
	};
	[SuqlMetadata]: {
		queryPath: string;
	};
};

export type EnrichedRefField = RefField & {
	dbPath: string; //not inside any symbol because it could be configured by the user
	[SharedMetadata]: {
		inheritanceOrigin?: string;
		fieldType: 'refField';
	};
};

export type EnrichedDataField = DataField & {
	dbPath: string;
	inherited: boolean;
	[SharedMetadata]: {
		inheritanceOrigin?: string;
		fieldType: 'dataField';
	};
	[SuqlMetadata]: {
		dbPath: string;
	};
};

//todo: remove all internal metadata and put them in Extension or SharedMetadata
export type EnrichedLinkField = LinkField & {
	name: string; // same as the key it has, maybe to rename to key
	relation: string;
	plays: string;
	$things: string[]; //all potential candidates
	fieldType: 'linkField'; //todo: remove
	inherited: boolean;
	[SharedMetadata]: {
		//todo: Move everything that the user can't touch here here
		inheritanceOrigin?: string;
		fieldType: 'linkField';
	};
	[SuqlMetadata]: {
		queryPath: string;
	};
} & (
		| {
				target: 'role';
				//filter?: Filter | Filter[]; // * if specified, filters the things automatically
				targetRoles?: string[]; // * these are the roles that are played by the opposite entity.
				pathToRelation: string; // We create a default one if there is none. Todo: Give them a more exclusive name and hide it from the user
				oppositeLinkFieldsPlayedBy: LinkedFieldWithThing[]; // * these are all the potential linkFields that are in the other side of the tunnel
		  }
		| {
				target: 'relation';
				//filter?: Filter | Filter[]; // * if specified, filters the things, if not, we get every entity playing the opposite role
				oppositeLinkFieldsPlayedBy: Pick<LinkedFieldWithThing, 'thing' | 'thingType' | 'plays'>[]; // * just a copy of the information already in base level
		  }
	);
