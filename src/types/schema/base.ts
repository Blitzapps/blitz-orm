import type { DBConnector, DataField, FilledBQLMutationBlock, LinkField, RoleField } from '..';

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

export type BormOperation = 'create' | 'update' | 'delete' | 'link' | 'unlink';
export type BormTrigger = 'onCreate' | 'onUpdate' | 'onDelete' | 'onLink' | 'onUnlink';

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

export type Action =
	| {
			type: 'validate';
			fn: (currentNode: FilledBQLMutationBlock, parentNode: FilledBQLMutationBlock) => boolean; //parentNode might be {} but thats fine
			severity: 'error' | 'warning' | 'info';
			message: string;
	  }
	| {
			type: 'transform';
			fn: (currentNode: FilledBQLMutationBlock, parentNode?: FilledBQLMutationBlock) => Partial<FilledBQLMutationBlock>;
	  };
