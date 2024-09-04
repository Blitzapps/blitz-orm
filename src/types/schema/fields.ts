import type { DBConnector, Filter, ThingType, RawBQLQuery, BQLMutationBlock } from '..';

export type BormField = {
	path: string;
	cardinality?: DiscreteCardinality;
	ordered?: boolean;
	embedded?: boolean;
	rights?: readonly RightType[];
};

export type RoleField = {
	// LATER?: path: string;
	// YES: validations => For exzample make one of the roles required
	// YES: default => Why not, one relation could have a default value
	cardinality: DiscreteCardinality;
	// MAYBE: rigths => Why not, maybe relation.particular child has better rigths than otherchild.relation.particular child
	// NO: ordered => This can be really messy. Probably roles should never be ordered as relations are precisely the ones having the index
	dbConnector?: DBConnector;
};

export type LinkField = BormField & {
	relation: string;
	cardinality: DiscreteCardinality;
	plays: string;
	isVirtual?: boolean; // LinkFields might be virtual, but roleField cant!
	dbValue?: { surrealDB?: string; typeDB?: string }; //enhance this types and pack it with isVirtual or default  as they work together
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
	//used in the playedBy
	thing: string;
	thingType: ThingType;
	pathToRelation: string;
};

type MultiField = BormField & {
	contentType: 'FLEX';
	default?: { type: 'fn'; fn: (currentNode: BQLMutationBlock) => unknown } | { type: 'value'; value: unknown };
	validations?: {
		enum?: unknown[];
		unique?: boolean;
		fn?: (value: unknown) => boolean;
	};
};
type StringField = BormField & {
	contentType:
		| 'ID'
		| 'COLOR'
		| 'DATE'
		| 'FILE'
		| 'EMAIL'
		| 'PHONE'
		| 'URL'
		| 'PASSWORD'
		| 'LANGUAGE_TEXT'
		| 'RICH_TEXT'
		| 'TEXT'
		| 'JSON';
	default?: { type: 'fn'; fn: (currentNode: BQLMutationBlock) => string } | { type: 'value'; value: string };
	validations?: {
		enum?: string[];
		unique?: boolean;
		fn?: (value: string) => boolean;
	};
};

type NumberField = BormField & {
	contentType: 'DURATION' | 'HOUR' | 'RATING' | 'CURRENCY' | 'PERCENTAGE' | 'NUMBER_DECIMAL' | 'NUMBER';
	default?: { type: 'fn'; fn: (currentNode: BQLMutationBlock) => number } | { type: 'value'; value: number };
	validations?: {
		enum?: number[];
		unique?: boolean;
		fn?: (value: number) => boolean;
	};
};

type DateField = BormField & {
	contentType: 'TIME';
	default?: { type: 'fn'; fn: (currentNode: BQLMutationBlock) => Date } | { type: 'value'; value: Date };
	validations?: {
		enum: Date[];
		fn?: (value: Date) => boolean;
	};
};

type BooleanField = BormField & {
	contentType: 'BOOLEAN';
	default?: { type: 'fn'; fn: (currentNode: BQLMutationBlock) => boolean } | { type: 'value'; value: boolean };
	validations?: {
		enum?: boolean[];
		fn?: (value: boolean) => boolean;
	};
};

type AllDataField = StringField | NumberField | DateField | BooleanField | MultiField;
export type Validations = {
	required?: boolean;
	unique?: boolean;
	enum?: unknown[];
};

export type DataField = BormField & {
	cardinality?: Cardinality;
	shared?: boolean;
	validations?: Validations;
	isVirtual?: boolean;
	dbValue?: { surrealDB?: string; typeDB?: string }; //enhance this types and pack it with isVirtual or default  as they work together
	dbConnectors?: [DBConnector, ...DBConnector[]];
} & AllDataField;

export type ContentType = keyof ContentTypeMapping;

export type ContentTypeMapping = {
	ID: string;
	JSON: string;
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
	DATE: string;
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
	FLEX: unknown;
};

export type DiscreteCardinality = 'ONE' | 'MANY';

export type Cardinality = DiscreteCardinality | 'INTERVAL';

export type RightType = 'CREATE' | 'DELETE' | 'UPDATE' | 'LINK' | 'UNLINK';

export type BQLFieldObj = { $path: string; $as?: string } & Omit<
	RawBQLQuery,
	'$entity' | '$relation' | '$thing' | '$thingType'
>;
export type BQLField = string | BQLFieldObj;
