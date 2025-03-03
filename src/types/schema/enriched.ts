import type { BormEntity, BormRelation, DBHandleKey, Hooks, LinkedFieldWithThing } from '..';
import type { AdapterContext } from '../../adapters';
import type { SharedMetadata, SuqlMetadata } from '../symbols';
import type { DataField, LinkField, RefField, RoleField } from './fields';

export type EnrichedBormSchema = {
  entities: { [s: string]: EnrichedBormEntity };
  relations: { [s: string]: EnrichedBormRelation };
};

export type SharedEnrichedProps = {
  name: string;
  computedFields: string[];
  extends?: string;
  idFields: string[];
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
  hooks?: Hooks;
};

export type EnrichedBormEntity = Omit<BormEntity, 'linkFields' | 'idFields' | 'dataFields'> & {
  thingType: 'entity';
} & SharedEnrichedProps;

export type EnrichedBormRelation = Omit<BormRelation, 'linkFields' | 'dataFields'> & {
  thingType: 'relation';
  roles: { [key: string]: EnrichedRoleField };
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
  path: string;
  dbPath: string; //not inside any symbol because it could be configured by the user
  inherited: boolean;
  [SharedMetadata]: {
    inheritanceOrigin?: string;
    fieldType: 'refField';
  };
};

export type EnrichedDataField = DataField & {
  dbPath: string;
  isIdField: boolean;
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
  // name: string; // same as the key it has, maybe to rename to key
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
