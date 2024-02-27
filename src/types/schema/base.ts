import type { DBConnector, DataField, LinkField, RoleField, EnrichedBQLMutationBlock } from '..';

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
			hooks?: Hooks;
	  }
	| {
			idFields: readonly string[];
			defaultDBConnector: DBConnector; // at least one default connector
			dataFields?: readonly DataField[];
			linkFields?: readonly LinkField[];
			hooks?: Hooks;
	  };

export type BormRelation = BormEntity & {
	defaultDBConnector: DBConnector & { path: string }; /// mandatory in relations
	roles?: { [key: string]: RoleField };
};

export type BormOperation = 'create' | 'update' | 'delete' | 'link' | 'unlink' | 'replace' | 'match';
export type BormTrigger = 'onCreate' | 'onUpdate' | 'onDelete' | 'onLink' | 'onUnlink' | 'onReplace' | 'onMatch';

export type Hooks = {
	pre?: readonly PreHook[];
	//post?: PostHook[];
};

export type PreHook = {
	triggers: {
		[K in BormTrigger]?: () => boolean;
	};
	actions: readonly Action[];
};

//export type PostHook = any;

export type Action = { name?: string; description?: string } & (TransFormAction | ValidateAction);

export type NodeFunctionParams = [
	currentNode: EnrichedBQLMutationBlock,
	parentNode: EnrichedBQLMutationBlock,
	context: Record<string, any>,
];

export type TransFormAction = {
	type: 'transform';
	fn: (...args: NodeFunctionParams) => Partial<EnrichedBQLMutationBlock>;
};

export type ValidateAction = {
	type: 'validate';
	fn: (...args: NodeFunctionParams) => boolean;
	severity: 'error' | 'warning' | 'info';
	message: string;
};
