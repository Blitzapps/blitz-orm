export type TQLRequest = {
	// queries
	entity?: string;
	roles?: { path: string; request: string; owner: string }[];
	relations?: { relation: string; entity: string; request: string }[];
	// mutations
	insertionMatches?: string;
	deletionMatches?: string;
	creations?: string;
	insertions?: string;
	deletions?: string;
};

export type TQLEntityMutation = {
	entity: string;
	relations?: { relation: string; entity: string; request: string }[];
};
