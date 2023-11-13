export type LinkFilter = {
	$thing?: string;
	$thingType?: string;
	$role?: string;
	[key: string]: string | number | Filter | undefined;
};

export type Filter = DataFilter | LinkFilter | MiddleFilter;

export type MiddleFilter = {
	$and?: Filter[];
	$or?: Filter[];
};

type RequireAtLeastOne<T> = {
	[K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

export type DataFilter = RequireAtLeastOne<{
	$eq?: any;
	$ge?: number | string;
}>;
