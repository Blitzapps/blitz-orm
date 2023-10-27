import type { DBConnector, DataField, LinkField, RoleField } from '..';

export type BormSchema = {
	entities: { [s: string]: BormEntity };
	relations: { [s: string]: BormRelation };
};

export type BormEntity =
	| {
			extends: string; //if extends, the rest are optional
			idFields?: readonly string[];
			defaultDBConnector: DBConnector; // at least one default connector
			dataFields?: readonly DataField[];
			linkFields?: readonly LinkField[];
	  }
	| {
			extends?: string;
			idFields: readonly string[];
			defaultDBConnector: DBConnector; // at least one default connector
			dataFields?: readonly DataField[];
			linkFields?: readonly LinkField[];
	  };

export type BormRelation = BormEntity & {
	defaultDBConnector: DBConnector & { path: string }; /// mandatory in relations
	roles?: { [key: string]: RoleField };
};
