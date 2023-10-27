export type ThingType = 'entity' | 'relation' | 'attribute';

export type BormMetadata = {
	$id: string;
	$entity?: string;
	$relation?: string; //instead of a union, two optionals from now. Wil lchange when using $thing and $thingType
	$tempId?: string;
};

export type WithBormMetadata<T> = T extends any[] // if it's an array
	? T[number] extends object // if array items are objects
		? Array<WithBormMetadataObject<T[number]>> // recursively apply metadata only to object items in the array
		: T // if array items are not objects, return the array type as is
	: T extends object // if it's just an object
	? WithBormMetadataObject<T> // apply metadata and recursively process properties
	: T; // else leave it as is

type WithBormMetadataObject<T> = {
	[K in keyof T]: WithBormMetadata<T[K]>;
} & BormMetadata;

export type BQLResponseSingle = Record<string, any>;

export type BQLResponseMulti = BQLResponseSingle[];

export type BQLResponse = BQLResponseSingle | BQLResponseMulti;
