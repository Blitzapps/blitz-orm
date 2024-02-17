//* File auto generated with buildSchema.ts
export const typesSchema = {
	entities: {
		Hook: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'Hook',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					contentType: 'TEXT',
					path: 'requiredOption',
					default: {
						type: 'value',
						value: 'a',
					},
					validations: {
						required: true,
						enum: ['a', 'b', 'c'],
					},
					cardinality: 'ONE',
					dbPath: 'Hook·requiredOption',
				},
				{
					path: 'manyOptions',
					cardinality: 'MANY',
					contentType: 'TEXT',
					validations: {
						enum: ['a', 'b', 'c'],
					},
					dbPath: 'Hook·manyOptions',
				},
				{
					path: 'fnValidatedField',
					contentType: 'TEXT',
					validations: {},
					cardinality: 'ONE',
					dbPath: 'Hook·fnValidatedField',
				},
				{
					contentType: 'DATE',
					path: 'timestamp',
					default: {
						type: 'fn',
					},
					cardinality: 'ONE',
					dbPath: 'Hook·timestamp',
				},
			],
			linkFields: [
				{
					path: 'hookParent',
					cardinality: 'ONE',
					relation: 'HookParent',
					plays: 'hooks',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'hookParent',
							thing: 'HookParent',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'asMainHookOf',
					cardinality: 'ONE',
					relation: 'HookParent',
					plays: 'mainHook',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'asMainHook',
							thing: 'HookParent',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'Hook',
			thingType: 'entity',
			computedFields: ['id', 'requiredOption', 'timestamp'],
			virtualFields: [],
			requiredFields: ['id', 'requiredOption'],
			enumFields: ['requiredOption', 'manyOptions'],
			fnValidatedFields: ['fnValidatedField'],
		},
		Thing: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'Thing',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					path: 'stuff',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
					cardinality: 'ONE',
					dbPath: 'Thing·stuff',
				},
			],
			linkFields: [
				{
					path: 'things',
					cardinality: 'MANY',
					relation: 'ThingRelation',
					plays: 'things',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'things',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'root',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'root',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'root',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'extra',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'extra',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'extra',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'Thing',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		SubthingOne: {
			extends: 'Thing',
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					path: 'stuff',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
					cardinality: 'ONE',
					dbPath: 'Thing·stuff',
				},
			],
			allExtends: ['Thing'],
			idFields: ['id'],
			linkFields: [
				{
					path: 'things',
					cardinality: 'MANY',
					relation: 'ThingRelation',
					plays: 'things',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'things',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'root',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'root',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'root',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'extra',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'extra',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'extra',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'SubthingOne',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		SubthingTwo: {
			extends: 'Thing',
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					path: 'stuff',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
					cardinality: 'ONE',
					dbPath: 'Thing·stuff',
				},
			],
			allExtends: ['Thing'],
			idFields: ['id'],
			linkFields: [
				{
					path: 'things',
					cardinality: 'MANY',
					relation: 'ThingRelation',
					plays: 'things',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'things',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'root',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'root',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'root',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'extra',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'extra',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'extra',
							thing: 'ThingRelation',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'SubthingTwo',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		Account: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'Account',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					path: 'provider',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
					cardinality: 'ONE',
					dbPath: 'Account·provider',
				},
			],
			linkFields: [
				{
					path: 'user',
					cardinality: 'ONE',
					relation: 'User-Accounts',
					plays: 'accounts',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'accounts',
							relation: 'User-Accounts',
							cardinality: 'MANY',
							plays: 'user',
							target: 'role',
							thing: 'User',
							thingType: 'entity',
						},
					],
				},
			],
			name: 'Account',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		User: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					shared: true,
					path: 'name',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'name',
				},
				{
					path: 'email',
					contentType: 'EMAIL',
					validations: {
						unique: true,
					},
					rights: ['CREATE', 'DELETE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'User·email',
				},
			],
			linkFields: [
				{
					path: 'accounts',
					relation: 'User-Accounts',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Accounts',
							plays: 'accounts',
							target: 'role',
							thing: 'Account',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'sessions',
					relation: 'User-Sessions',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Sessions',
							plays: 'sessions',
							target: 'role',
							thing: 'Session',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'spaces',
					relation: 'Space-User',
					cardinality: 'MANY',
					plays: 'users',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'users',
							cardinality: 'MANY',
							relation: 'Space-User',
							plays: 'spaces',
							target: 'role',
							thing: 'Space',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'user-tags',
					relation: 'UserTag',
					cardinality: 'MANY',
					plays: 'users',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'user-tags',
							thing: 'UserTag',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'User',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		SuperUser: {
			extends: 'User',
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					path: 'power',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'SuperUser·power',
				},
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					shared: true,
					path: 'name',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'name',
				},
				{
					path: 'email',
					contentType: 'EMAIL',
					validations: {
						unique: true,
					},
					rights: ['CREATE', 'DELETE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'User·email',
				},
			],
			allExtends: ['User'],
			idFields: ['id'],
			linkFields: [
				{
					path: 'accounts',
					relation: 'User-Accounts',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Accounts',
							plays: 'accounts',
							target: 'role',
							thing: 'Account',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'sessions',
					relation: 'User-Sessions',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Sessions',
							plays: 'sessions',
							target: 'role',
							thing: 'Session',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'spaces',
					relation: 'Space-User',
					cardinality: 'MANY',
					plays: 'users',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'users',
							cardinality: 'MANY',
							relation: 'Space-User',
							plays: 'spaces',
							target: 'role',
							thing: 'Space',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'user-tags',
					relation: 'UserTag',
					cardinality: 'MANY',
					plays: 'users',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'user-tags',
							thing: 'UserTag',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'SuperUser',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		God: {
			extends: 'SuperUser',
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					path: 'isEvil',
					contentType: 'BOOLEAN',
					cardinality: 'ONE',
					dbPath: 'God·isEvil',
				},
				{
					path: 'power',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'SuperUser·power',
				},
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					shared: true,
					path: 'name',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'name',
				},
				{
					path: 'email',
					contentType: 'EMAIL',
					validations: {
						unique: true,
					},
					rights: ['CREATE', 'DELETE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'User·email',
				},
			],
			allExtends: ['SuperUser', 'User'],
			idFields: ['id'],
			linkFields: [
				{
					path: 'accounts',
					relation: 'User-Accounts',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Accounts',
							plays: 'accounts',
							target: 'role',
							thing: 'Account',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'sessions',
					relation: 'User-Sessions',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Sessions',
							plays: 'sessions',
							target: 'role',
							thing: 'Session',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'spaces',
					relation: 'Space-User',
					cardinality: 'MANY',
					plays: 'users',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'users',
							cardinality: 'MANY',
							relation: 'Space-User',
							plays: 'spaces',
							target: 'role',
							thing: 'Space',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'user-tags',
					relation: 'UserTag',
					cardinality: 'MANY',
					plays: 'users',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'user-tags',
							thing: 'UserTag',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'God',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		Space: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					shared: true,
					path: 'name',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'name',
				},
			],
			linkFields: [
				{
					path: 'users',
					cardinality: 'MANY',
					relation: 'Space-User',
					plays: 'spaces',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'spaces',
							relation: 'Space-User',
							cardinality: 'MANY',
							plays: 'users',
							target: 'role',
							thing: 'User',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'objects',
					cardinality: 'MANY',
					relation: 'SpaceObj',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'objects',
							thing: 'SpaceObj',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'definitions',
					cardinality: 'MANY',
					relation: 'SpaceDef',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'definitions',
							thing: 'SpaceDef',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'kinds',
					cardinality: 'MANY',
					relation: 'Kind',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'kinds',
							thing: 'Kind',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'fields',
					cardinality: 'MANY',
					relation: 'Field',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'fields',
							thing: 'Field',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'dataFields',
					cardinality: 'MANY',
					relation: 'DataField',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'dataFields',
							thing: 'DataField',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'selfs',
					cardinality: 'MANY',
					relation: 'Self',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'selfs',
							thing: 'Self',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'userTagGroups',
					cardinality: 'MANY',
					relation: 'UserTagGroup',
					plays: 'space',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'userTagGroups',
							thing: 'UserTagGroup',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'Space',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		Color: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					path: 'isBlue',
					contentType: 'BOOLEAN',
					isVirtual: true,
					default: {
						type: 'fn',
					},
					cardinality: 'ONE',
					dbPath: 'Color·isBlue',
				},
				{
					path: 'totalUserTags',
					contentType: 'NUMBER',
					isVirtual: true,
					default: {
						type: 'fn',
					},
					cardinality: 'ONE',
					dbPath: 'Color·totalUserTags',
				},
			],
			linkFields: [
				{
					path: 'user-tags',
					cardinality: 'MANY',
					relation: 'UserTagGroup',
					plays: 'color',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'color',
							target: 'role',
							cardinality: 'ONE',
							plays: 'tags',
							relation: 'UserTagGroup',
							thing: 'UserTag',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'group',
					target: 'relation',
					cardinality: 'ONE',
					plays: 'color',
					relation: 'UserTagGroup',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'group',
							thing: 'UserTagGroup',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'Color',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: ['isBlue', 'totalUserTags'],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		Power: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					shared: true,
					path: 'description',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'description',
				},
			],
			linkFields: [
				{
					path: 'space-user',
					cardinality: 'ONE',
					relation: 'Space-User',
					plays: 'power',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'space-user',
							thing: 'Space-User',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'Power',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		Session: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					path: 'expires',
					contentType: 'DATE',
					cardinality: 'ONE',
					dbPath: 'Session·expires',
				},
				{
					contentType: 'TEXT',
					path: 'sessionToken',
					validations: {
						unique: true,
					},
					cardinality: 'ONE',
					dbPath: 'Session·sessionToken',
				},
			],
			linkFields: [
				{
					path: 'user',
					cardinality: 'ONE',
					relation: 'User-Sessions',
					plays: 'sessions',
					target: 'role',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'sessions',
							relation: 'User-Sessions',
							cardinality: 'MANY',
							plays: 'user',
							target: 'role',
							thing: 'User',
							thingType: 'entity',
						},
					],
				},
			],
			name: 'Session',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		VerificationToken: {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					contentType: 'TEXT',
					path: 'identifier',
					cardinality: 'ONE',
					dbPath: 'VerificationToken·identifier',
				},
				{
					contentType: 'TEXT',
					path: 'token',
					validations: {
						unique: true,
					},
					cardinality: 'ONE',
					dbPath: 'VerificationToken·token',
				},
				{
					path: 'expires',
					contentType: 'DATE',
					cardinality: 'ONE',
					dbPath: 'VerificationToken·expires',
				},
			],
			name: 'VerificationToken',
			thingType: 'entity',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
	},
	relations: {
		'ThingRelation': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'ThingRelation',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				things: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'things',
							cardinality: 'MANY',
							relation: 'ThingRelation',
							plays: 'things',
							target: 'relation',
							thing: 'Thing',
							thingType: 'entity',
						},
					],
					name: 'things',
				},
				root: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'root',
							cardinality: 'ONE',
							relation: 'ThingRelation',
							plays: 'root',
							target: 'relation',
							thing: 'Thing',
							thingType: 'entity',
						},
					],
					name: 'root',
				},
				extra: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'extra',
							cardinality: 'ONE',
							relation: 'ThingRelation',
							plays: 'extra',
							target: 'relation',
							thing: 'Thing',
							thingType: 'entity',
						},
					],
					name: 'extra',
				},
			},
			name: 'ThingRelation',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'User-Accounts': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'User-Accounts',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				accounts: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Accounts',
							plays: 'accounts',
							target: 'role',
							thing: 'Account',
							thingType: 'entity',
						},
					],
					name: 'accounts',
				},
				user: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'accounts',
							relation: 'User-Accounts',
							cardinality: 'MANY',
							plays: 'user',
							target: 'role',
							thing: 'User',
							thingType: 'entity',
						},
					],
					name: 'user',
				},
			},
			name: 'User-Accounts',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'User-Sessions': {
			defaultDBConnector: {
				id: 'default',
				path: 'User-Sessions',
			},
			idFields: ['id'],
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				user: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'sessions',
							relation: 'User-Sessions',
							cardinality: 'MANY',
							plays: 'user',
							target: 'role',
							thing: 'User',
							thingType: 'entity',
						},
					],
					name: 'user',
				},
				sessions: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'user',
							cardinality: 'ONE',
							relation: 'User-Sessions',
							plays: 'sessions',
							target: 'role',
							thing: 'Session',
							thingType: 'entity',
						},
					],
					name: 'sessions',
				},
			},
			name: 'User-Sessions',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'Space-User': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'Space-User',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				spaces: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'users',
							cardinality: 'MANY',
							relation: 'Space-User',
							plays: 'spaces',
							target: 'role',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'spaces',
				},
				users: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'spaces',
							relation: 'Space-User',
							cardinality: 'MANY',
							plays: 'users',
							target: 'role',
							thing: 'User',
							thingType: 'entity',
						},
					],
					name: 'users',
				},
				power: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'space-user',
							cardinality: 'ONE',
							relation: 'Space-User',
							plays: 'power',
							target: 'relation',
							thing: 'Power',
							thingType: 'entity',
						},
					],
					name: 'power',
				},
			},
			name: 'Space-User',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'UserTag': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'UserTag',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					shared: true,
					path: 'name',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'name',
				},
			],
			roles: {
				users: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'user-tags',
							relation: 'UserTag',
							cardinality: 'MANY',
							plays: 'users',
							target: 'relation',
							thing: 'User',
							thingType: 'entity',
						},
					],
					name: 'users',
				},
			},
			linkFields: [
				{
					path: 'color',
					target: 'role',
					cardinality: 'ONE',
					plays: 'tags',
					relation: 'UserTagGroup',
					oppositeLinkFieldsPlayedBy: [
						{
							path: 'user-tags',
							cardinality: 'MANY',
							relation: 'UserTagGroup',
							plays: 'color',
							target: 'role',
							thing: 'Color',
							thingType: 'entity',
						},
					],
				},
				{
					path: 'group',
					target: 'relation',
					cardinality: 'ONE',
					plays: 'tags',
					relation: 'UserTagGroup',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'group',
							thing: 'UserTagGroup',
							thingType: 'relation',
						},
					],
				},
			],
			name: 'UserTag',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'UserTagGroup': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'UserTagGroup',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				tags: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'color',
							target: 'role',
							cardinality: 'ONE',
							plays: 'tags',
							relation: 'UserTagGroup',
							thing: 'UserTag',
							thingType: 'relation',
						},
						{
							path: 'group',
							target: 'relation',
							cardinality: 'ONE',
							plays: 'tags',
							relation: 'UserTagGroup',
							thing: 'UserTag',
							thingType: 'relation',
						},
					],
					name: 'tags',
				},
				color: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'user-tags',
							cardinality: 'MANY',
							relation: 'UserTagGroup',
							plays: 'color',
							target: 'role',
							thing: 'Color',
							thingType: 'entity',
						},
						{
							path: 'group',
							target: 'relation',
							cardinality: 'ONE',
							plays: 'color',
							relation: 'UserTagGroup',
							thing: 'Color',
							thingType: 'entity',
						},
					],
					name: 'color',
				},
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'userTagGroups',
							cardinality: 'MANY',
							relation: 'UserTagGroup',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			name: 'UserTagGroup',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'SpaceObj': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'SpaceObj',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'objects',
							cardinality: 'MANY',
							relation: 'SpaceObj',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			name: 'SpaceObj',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'SpaceDef': {
			extends: 'SpaceObj',
			defaultDBConnector: {
				id: 'default',
				as: 'SpaceObj',
				path: 'SpaceDef',
			},
			dataFields: [
				{
					shared: true,
					path: 'description',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'description',
				},
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			allExtends: ['SpaceObj'],
			idFields: ['id'],
			roles: {
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'definitions',
							cardinality: 'MANY',
							relation: 'SpaceDef',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			name: 'SpaceDef',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'Kind': {
			extends: 'SpaceDef',
			dataFields: [
				{
					contentType: 'TEXT',
					path: 'name',
					rights: ['CREATE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'Kind·name',
				},
				{
					shared: true,
					path: 'description',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'description',
				},
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			linkFields: [
				{
					path: 'fields',
					relation: 'Field',
					cardinality: 'MANY',
					plays: 'kinds',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'fields',
							thing: 'Field',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'dataFields',
					relation: 'DataField',
					cardinality: 'MANY',
					plays: 'kinds',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'dataFields',
							thing: 'DataField',
							thingType: 'relation',
						},
					],
				},
			],
			defaultDBConnector: {
				id: 'default',
				as: 'SpaceDef',
				path: 'Kind',
			},
			hooks: {
				pre: [
					{
						triggers: {},
						actions: [
							{
								type: 'validate',
								severity: 'error',
								message: 'Name must not exist, or be less than 15 characters',
							},
							{
								type: 'transform',
							},
						],
					},
				],
			},
			allExtends: ['SpaceDef', 'SpaceObj'],
			idFields: ['id'],
			roles: {
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'kinds',
							cardinality: 'MANY',
							relation: 'Kind',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			name: 'Kind',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'Field': {
			extends: 'SpaceDef',
			dataFields: [
				{
					contentType: 'TEXT',
					path: 'name',
					cardinality: 'ONE',
					dbPath: 'Field·name',
				},
				{
					contentType: 'TEXT',
					path: 'cardinality',
					cardinality: 'ONE',
					dbPath: 'Field·cardinality',
				},
				{
					shared: true,
					path: 'description',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'description',
				},
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				kinds: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'fields',
							relation: 'Field',
							cardinality: 'MANY',
							plays: 'kinds',
							target: 'relation',
							thing: 'Kind',
							thingType: 'relation',
						},
					],
					name: 'kinds',
				},
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'fields',
							cardinality: 'MANY',
							relation: 'Field',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			defaultDBConnector: {
				id: 'default',
				as: 'SpaceDef',
				path: 'Field',
			},
			allExtends: ['SpaceDef', 'SpaceObj'],
			idFields: ['id'],
			name: 'Field',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'DataField': {
			extends: 'Field',
			dataFields: [
				{
					contentType: 'TEXT',
					path: 'type',
					cardinality: 'ONE',
					dbPath: 'DataField·type',
				},
				{
					contentType: 'TEXT',
					path: 'computeType',
					cardinality: 'ONE',
					dbPath: 'DataField·computeType',
				},
				{
					contentType: 'TEXT',
					path: 'name',
					cardinality: 'ONE',
					dbPath: 'Field·name',
				},
				{
					contentType: 'TEXT',
					path: 'cardinality',
					cardinality: 'ONE',
					dbPath: 'Field·cardinality',
				},
				{
					shared: true,
					path: 'description',
					contentType: 'TEXT',
					cardinality: 'ONE',
					dbPath: 'description',
				},
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			linkFields: [
				{
					path: 'values',
					relation: 'DataValue',
					cardinality: 'MANY',
					plays: 'dataField',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'values',
							thing: 'DataValue',
							thingType: 'relation',
						},
					],
				},
				{
					path: 'expression',
					relation: 'Expression',
					cardinality: 'ONE',
					plays: 'dataField',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'expression',
							thing: 'Expression',
							thingType: 'relation',
						},
					],
				},
			],
			defaultDBConnector: {
				id: 'default',
				as: 'Field',
				path: 'DataField',
			},
			allExtends: ['Field', 'SpaceDef', 'SpaceObj'],
			idFields: ['id'],
			roles: {
				kinds: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'dataFields',
							relation: 'DataField',
							cardinality: 'MANY',
							plays: 'kinds',
							target: 'relation',
							thing: 'Kind',
							thingType: 'relation',
						},
					],
					name: 'kinds',
				},
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'dataFields',
							cardinality: 'MANY',
							relation: 'DataField',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			name: 'DataField',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'Expression': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				as: 'Expression',
				path: 'Expression',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					contentType: 'TEXT',
					path: 'value',
					rights: ['CREATE', 'UPDATE'],
					cardinality: 'ONE',
					dbPath: 'Expression·value',
				},
			],
			roles: {
				dataField: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'expression',
							relation: 'Expression',
							cardinality: 'ONE',
							plays: 'dataField',
							target: 'relation',
							thing: 'DataField',
							thingType: 'relation',
						},
					],
					name: 'dataField',
				},
			},
			name: 'Expression',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'DataValue': {
			idFields: ['id'],
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
				{
					contentType: 'TEXT',
					path: 'type',
					cardinality: 'ONE',
					dbPath: 'DataValue·type',
				},
			],
			roles: {
				dataField: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'values',
							relation: 'DataValue',
							cardinality: 'MANY',
							plays: 'dataField',
							target: 'relation',
							thing: 'DataField',
							thingType: 'relation',
						},
					],
					name: 'dataField',
				},
			},
			defaultDBConnector: {
				id: 'default',
				path: 'DataValue',
			},
			name: 'DataValue',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'Self': {
			idFields: ['id', 'id'],
			extends: 'SpaceObj',
			defaultDBConnector: {
				id: 'default',
				as: 'SpaceObj',
				path: 'Self',
			},
			roles: {
				owner: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'owned',
							cardinality: 'MANY',
							relation: 'Self',
							plays: 'owner',
							target: 'relation',
							thing: 'Self',
							thingType: 'relation',
						},
					],
					name: 'owner',
				},
				space: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'selfs',
							cardinality: 'MANY',
							relation: 'Self',
							plays: 'space',
							target: 'relation',
							thing: 'Space',
							thingType: 'entity',
						},
					],
					name: 'space',
				},
			},
			linkFields: [
				{
					path: 'owned',
					cardinality: 'MANY',
					relation: 'Self',
					plays: 'owner',
					target: 'relation',
					oppositeLinkFieldsPlayedBy: [
						{
							plays: 'owned',
							thing: 'Self',
							thingType: 'relation',
						},
					],
				},
			],
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			allExtends: ['SpaceObj'],
			name: 'Self',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
		'HookParent': {
			idFields: ['id'],
			defaultDBConnector: {
				id: 'default',
				path: 'HookParent',
			},
			dataFields: [
				{
					shared: true,
					path: 'id',
					default: {
						type: 'fn',
					},
					validations: {
						required: true,
						unique: true,
					},
					contentType: 'ID',
					rights: ['CREATE'],
					cardinality: 'ONE',
					dbPath: 'id',
				},
			],
			roles: {
				hooks: {
					cardinality: 'MANY',
					playedBy: [
						{
							path: 'hookParent',
							cardinality: 'ONE',
							relation: 'HookParent',
							plays: 'hooks',
							target: 'relation',
							thing: 'Hook',
							thingType: 'entity',
						},
					],
					name: 'hooks',
				},
				mainHook: {
					cardinality: 'ONE',
					playedBy: [
						{
							path: 'asMainHook',
							cardinality: 'ONE',
							relation: 'HookParent',
							plays: 'mainHook',
							target: 'relation',
							thing: 'Hook',
							thingType: 'entity',
						},
					],
					name: 'mainHook',
				},
			},
			name: 'HookParent',
			thingType: 'relation',
			computedFields: ['id'],
			virtualFields: [],
			requiredFields: ['id'],
			enumFields: [],
			fnValidatedFields: [],
		},
	},
} as const;
