import type { DBConnector, Filter, ThingType, RawBQLQuery } from '..';

export type BormField = {
	path: string;
	cardinality: CardinalityType;
	ordered?: boolean;
	embedded?: boolean;
	rights?: readonly RightType[];
};

export type RoleField = {
	// LATER?: path: string;
	// YES: validations => For exzample make one of the roles required
	// YES: default => Why not, one relation could have a default value
	cardinality: CardinalityType;
	// MAYBE: rigths => Why not, maybe relation.particular child has better rigths than otherchild.relation.particular child
	// NO: ordered => This can be really messy. Probably roles should never be ordered as relations are precisely the ones having the index
	dbConnector?: DBConnector;
};

export type LinkField = BormField & {
	relation: string;
	plays: string;
} & (
		| {
				target: 'role';
				filter?: Filter | Filter[];
		  }
		| {
				target: 'relation';
		  }
	);

export type LinkedFieldWithThing = LinkField & {
	thing: string;
	thingType: ThingType;
};

export type DataField = BormField & {
	shared?: boolean;
	default?: any; // todo: is either a value or a fn that return a value of the type datatype
	contentType: ContentType;
	validations?: any; // todo
	isVirtual?: boolean;
	dbConnectors?: [DBConnector, ...DBConnector[]];
};

export type ContentType =
	| 'ID'
	| 'JSON'
	| 'COLOR'
	| 'BOOLEAN'
	| 'POINT'
	| 'FILE'
	| 'EMAIL'
	| 'PHONE'
	| 'WEEK_DAY'
	| 'DURATION'
	| 'HOUR'
	| 'TIME'
	| 'DATE'
	| 'RATING'
	| 'CURRENCY'
	| 'PERCENTAGE'
	| 'NUMBER_DECIMAL'
	| 'NUMBER'
	| 'URL'
	| 'PASSWORD'
	| 'LANGUAGE_TEXT'
	| 'RICH_TEXT'
	| 'TEXT';

export type ContentTypeMapping = {
	ID: string;
	JSON: any;
	COLOR: string;
	BOOLEAN: boolean;
	POINT: { x: number; y: number };
	FILE: string;
	EMAIL: string;
	PHONE: string;
	WEEK_DAY: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
	DURATION: number;
	HOUR: number;
	TIME: Date;
	DATE: Date;
	RATING: number;
	CURRENCY: number;
	PERCENTAGE: number;
	NUMBER_DECIMAL: number;
	NUMBER: number;
	URL: string;
	PASSWORD: string;
	LANGUAGE_TEXT: string;
	RICH_TEXT: string;
	TEXT: string;
};

export type CardinalityType = 'ONE' | 'MANY' | 'INTERVAL';

export type RightType = 'CREATE' | 'DELETE' | 'UPDATE' | 'LINK' | 'UNLINK';

export type BQLFieldObj = { $path: string; $as?: string } & Omit<
	RawBQLQuery,
	'$entity' | '$relation' | '$thing' | '$thingType'
>;
export type BQLField = string | BQLFieldObj;
