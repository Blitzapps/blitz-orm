import { v4 as uuidv4 } from 'uuid';

import type { BormSchema, DataField } from '../../src/index';
import { isArray } from 'radash';
//* when updating, please run `pnpm test:buildSchema`

const name: DataField = {
	shared: true,
	path: 'name',

	contentType: 'TEXT',
};

const description: DataField = {
	shared: true,
	path: 'description',
	contentType: 'TEXT',
};

const timestamp: DataField = {
	path: 'timestamp',
	contentType: 'DATE',
};

const id: DataField = {
	shared: true,
	path: 'id',
	default: { type: 'fn', fn: () => uuidv4() },
	validations: { required: true, unique: true },
	contentType: 'ID',
	rights: ['CREATE'],
};

const isEmail = (val: string) => val.includes('@'); //basic on purpose
const isGmail = (val: string) => val.includes('gmail.com'); //basic on purpose

export const testSchema: BormSchema = {
	entities: {
		Hook: {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'Hook' },
			dataFields: [
				{ ...id },
				{
					contentType: 'TEXT',
					path: 'requiredOption',
					validations: { required: true, enum: ['a', 'b', 'c'] as string[] },
				},
				{
					path: 'manyOptions',
					cardinality: 'MANY',
					contentType: 'TEXT',
					validations: { enum: ['a', 'b', 'c'] as string[] },
				},
				{
					path: 'fnValidatedField',
					contentType: 'TEXT',
					validations: {
						fn: (val) => {
							if (isEmail(val) && isGmail(val)) {
								return true;
							}
							if (val.startsWith('secretTest')) {
								throw new Error(`"${val}" starts with "secretTest" and that's not allowed.`);
							}
							return false;
						},
					},
				},
				{
					contentType: 'DATE',
					path: 'timestamp',
					default: {
						type: 'fn',
						fn: () => new Date().toISOString(),
					},
				},
			],
			linkFields: [
				{
					path: 'hookParent',
					cardinality: 'ONE',
					relation: 'HookParent',
					plays: 'hooks',
					target: 'relation',
				},
				{ path: 'asMainHookOf', cardinality: 'ONE', relation: 'HookParent', plays: 'mainHook', target: 'relation' },
				{
					path: 'otherTags',
					cardinality: 'MANY',
					relation: 'HookATag',
					plays: 'hookTypeA',
					target: 'role',
				},
				{
					path: 'tagA',
					cardinality: 'MANY',
					relation: 'HookATag',
					plays: 'otherHooks',
					target: 'role',
				},
			],
			hooks: {
				pre: [
					{
						triggers: {
							onCreate: () => true,
							onUpdate: () => true,
						},
						actions: [
							{
								type: 'validate',
								fn: ({ id: idC }, { id: idP }) => {
									if (idP) {
										if (!idP.includes('hey')) {
											throw new Error(`The parent of "${idC}" does not have 'hey' in its id ("${idP}").`);
										}
									}
									return true;
								}, //in general this would be run at the attribute level instead, as we use a single attribute, but is for testing
								severity: 'error',
								message: 'Default message',
							},
						],
					},
				],
			},
		},
		Thing: {
			idFields: ['id'], // could be a composite key
			defaultDBConnector: { id: 'default', path: 'Thing' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [
				{ ...id },
				{
					path: 'stuff',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
				},
			],
			linkFields: [
				{
					path: 'things',
					cardinality: 'MANY',
					relation: 'ThingRelation',
					plays: 'things',
					target: 'relation',
				},
				{
					path: 'root',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'root',
					target: 'relation',
				},
				{
					path: 'extra',
					cardinality: 'ONE',
					relation: 'ThingRelation',
					plays: 'extra',
					target: 'relation',
				},
			],
		},
		SubthingOne: {
			extends: 'Thing',
			defaultDBConnector: { id: 'default', as: 'Thing', path: 'SubthingOne' },
		},
		SubthingTwo: {
			extends: 'Thing',
			defaultDBConnector: { id: 'default', as: 'Thing', path: 'SubthingTwo' },
		},
		Account: {
			idFields: ['id'], // could be a composite key
			defaultDBConnector: { id: 'default', path: 'Account' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [
				{ ...id },
				{
					path: 'provider',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
				},
				{
					path: 'isSecureProvider',
					contentType: 'BOOLEAN',
					isVirtual: true,
				},
				{
					path: 'profile',
					contentType: 'JSON',
				},
			],
			linkFields: [
				{
					path: 'user',
					cardinality: 'ONE',
					relation: 'User-Accounts',
					plays: 'accounts',
					target: 'role',
					/// rights => Either you want to make it 1) read only 2)replace only 3) update only 4) delete only 5) create only ...
				},
			],
		},
		User: {
			idFields: ['id'], // could be a namecomposite key
			defaultDBConnector: { id: 'default' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [
				id,
				{ ...name, rights: ['CREATE', 'UPDATE'] },
				{
					path: 'email',
					contentType: 'EMAIL',
					validations: { unique: true },
					rights: ['CREATE', 'DELETE', 'UPDATE'],
				},
			],
			linkFields: [
				{
					path: 'accounts',
					relation: 'User-Accounts',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
				},
				{
					path: 'sessions',
					relation: 'User-Sessions',
					cardinality: 'MANY',
					plays: 'user',
					target: 'role',
				},
				{
					path: 'spaces',
					relation: 'Space-User',
					cardinality: 'MANY',
					plays: 'users',
					target: 'role',
				},
				{
					path: 'user-tags',
					relation: 'UserTag',
					cardinality: 'MANY',
					plays: 'users',
					target: 'relation',
				},
			],
			hooks: {
				pre: [
					{
						triggers: {
							onCreate: () => true,
							onUpdate: () => true,
						},
						//condition: () => true,
						actions: [
							{
								name: 'Validate tf1 test',
								type: 'validate',
								message: 'Failed test tf1',
								severity: 'error',
								fn: ({ $op, $id }, _parent, _context, { email: dbEmail, spaces: dbSpaces }) => {
									if ($op === 'update' && $id === 'mf1-user') {
										if (dbEmail !== 'john@email.com') {
											throw new Error(
												'The email of the test tf1 should be recovered here from the db and be john@email.com',
											);
										}
										if (
											!(
												dbSpaces.length === 1 &&
												dbSpaces[0].dataFields?.length === 4 &&
												dbSpaces[0].dataFields.find((df: any) => df.$id === 'mf1-dataField-1').expression ===
													'mf1-expression-1'
											)
										) {
											throw new Error(
												'The user should have one space and 4 datafields. Datafield 1 should have expression mf1-expression already in db',
											);
										}
										return true;
									} else {
										return true;
									}
								},
							},
							{
								name: 'Add children',
								type: 'transform',
								fn: ({ name, spaces }) =>
									name === 'cheatCode' && !spaces
										? {
												spaces: [{ id: 'secret', name: 'TheSecretSpace' }],
											}
										: {},
							},
							{
								name: 'from context',
								description: 'Add space from context',
								type: 'transform',
								fn: ({ $op, name, spaces }, _, { spaceId }) =>
									$op === 'create' && name === 'cheatCode2' && !spaces
										? {
												spaces: [{ id: spaceId }],
											}
										: {},
							},
						],
					},
					{
						actions: [
							{
								description: 'Use %var to replace name',
								type: 'transform',
								fn: ({ $op, '%name': varName }) => ($op === 'create' && varName ? { name: `secret-${varName}` } : {}),
							},
						],
					},
				],
			},
		},
		SuperUser: {
			extends: 'User',
			defaultDBConnector: { id: 'default', as: 'User', path: 'SuperUser' },
			dataFields: [
				{
					path: 'power',
					contentType: 'TEXT',
				},
			],
		},
		God: {
			extends: 'SuperUser',
			defaultDBConnector: { id: 'default', as: 'SuperUser', path: 'God' },
			dataFields: [
				{
					path: 'isEvil',
					contentType: 'BOOLEAN',
				},
			],
		},
		Space: {
			idFields: ['id'],
			defaultDBConnector: { id: 'default' },
			dataFields: [{ ...id }, { ...name, rights: ['CREATE', 'UPDATE'] }],
			linkFields: [
				{
					path: 'users',
					cardinality: 'MANY',
					relation: 'Space-User',
					plays: 'spaces',
					target: 'role',
				},
				{
					path: 'objects',
					cardinality: 'MANY',
					relation: 'SpaceObj',
					plays: 'space',
					target: 'relation',
				},
				{
					path: 'definitions',
					cardinality: 'MANY',
					relation: 'SpaceDef',
					plays: 'space',
					target: 'relation',
				},
				{
					path: 'kinds',
					cardinality: 'MANY',
					relation: 'Kind',
					plays: 'space',
					target: 'relation',
				},
				{
					path: 'fields',
					cardinality: 'MANY',
					relation: 'Field',
					plays: 'space',
					target: 'relation',
				},
				{
					path: 'dataFields',
					cardinality: 'MANY',
					relation: 'DataField',
					plays: 'space',
					target: 'relation',
				},
				{
					path: 'selfs',
					cardinality: 'MANY',
					relation: 'Self',
					plays: 'space',
					target: 'relation',
				},
				{
					path: 'userTagGroups',
					cardinality: 'MANY',
					relation: 'UserTagGroup',
					plays: 'space',
					target: 'relation',
				},
			],
		},
		Color: {
			idFields: ['id'],
			defaultDBConnector: { id: 'default' },
			dataFields: [
				{ ...id },
				/* todo: test ids different than 'id' {
          path: 'name',
          
          validations: { required: true, unique: true },
          contentType: 'TEXT',
          rights: ['CREATE'],
        }, */
				{
					path: 'isBlue',
					contentType: 'BOOLEAN', //no boolean yet
					isVirtual: true,
					default: {
						type: 'fn',
						fn: ({ id }) => (id === 'blue' ? true : false),
					},
				},
				{
					path: 'totalUserTags',
					contentType: 'NUMBER',
					isVirtual: true,
					default: {
						type: 'fn',
						fn: ({ ['user-tags']: userTags }) => (userTags ? userTags.length : 0),
					},
				},
				{ path: 'value', contentType: 'TEXT' },
			],
			linkFields: [
				{
					path: 'user-tags',
					cardinality: 'MANY',
					relation: 'UserTagGroup',
					plays: 'color',
					target: 'role',
				},
				{
					path: 'group',
					target: 'relation',
					cardinality: 'ONE',
					plays: 'color',
					relation: 'UserTagGroup',
				},
			],
			hooks: {
				pre: [
					{
						actions: [
							{
								type: 'transform',
								fn: ({ $op, value }, b, c, { value: dbValue }) => {
									if ($op === 'update' && value === dbValue && value === 'gold') {
										return { value: 'bronze' };
									} else {
										return {};
									}
								},
							},
						],
					},
				],
			},
		},
		Power: {
			idFields: ['id'],
			defaultDBConnector: { id: 'default' },
			dataFields: [{ ...id }, { ...description }],
			linkFields: [
				{
					path: 'space-user',
					cardinality: 'ONE',
					relation: 'Space-User',
					plays: 'power',
					target: 'relation',
				},
			],
		},
		Session: {
			idFields: ['id'],
			defaultDBConnector: { id: 'default' },
			dataFields: [
				{ ...id },
				{ ...timestamp, path: 'expires' },
				{ contentType: 'TEXT', path: 'sessionToken', validations: { unique: true } },
			],
			linkFields: [
				{
					path: 'user',
					cardinality: 'ONE',
					relation: 'User-Sessions',
					plays: 'sessions',
					target: 'role',
				},
			],
		},
		VerificationToken: {
			idFields: ['id'],
			defaultDBConnector: { id: 'default' },
			dataFields: [
				{ ...id },
				{ contentType: 'TEXT', path: 'identifier' },
				{ contentType: 'TEXT', path: 'token', validations: { unique: true } },
				{ ...timestamp, path: 'expires' },
			],
		},
	},
	relations: {
		'ThingRelation': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'ThingRelation' },
			// defaultDBConnector: { id: 'tdb', path: 'User·Account' }, //todo: when Dbpath != relation name
			dataFields: [
				{ ...id },
				{
					path: 'moreStuff',
					contentType: 'TEXT',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
				},
			],
			roles: {
				things: {
					cardinality: 'MANY',
				},
				root: { cardinality: 'ONE' },
				extra: { cardinality: 'ONE' },
			},
		},
		'User-Accounts': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'User-Accounts' },
			// defaultDBConnector: { id: 'tdb', path: 'User·Account' }, //todo: when Dbpath != relation name
			dataFields: [{ ...id }],
			roles: {
				accounts: {
					cardinality: 'MANY',
				},
				user: { cardinality: 'ONE' },
			},
		},
		'User-Sessions': {
			defaultDBConnector: { id: 'default', path: 'User-Sessions' },
			idFields: ['id'],
			dataFields: [{ ...id }],
			roles: {
				user: { cardinality: 'ONE' },
				sessions: {
					cardinality: 'MANY',
				},
			},
		},
		'Space-User': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'Space-User' },
			dataFields: [{ ...id }],
			roles: {
				spaces: { cardinality: 'MANY' },
				users: { cardinality: 'MANY' },
				power: { cardinality: 'ONE' },
			},
		},
		'UserTag': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'UserTag' },
			dataFields: [{ ...id }, { ...name }],
			roles: {
				users: {
					cardinality: 'MANY',
				},
			},
			linkFields: [
				{
					path: 'color',
					target: 'role',
					cardinality: 'ONE',
					plays: 'tags',
					relation: 'UserTagGroup',
				},
				{
					path: 'group',
					target: 'relation',
					cardinality: 'ONE',
					plays: 'tags',
					relation: 'UserTagGroup',
				},
			],
		},
		'UserTagGroup': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'UserTagGroup' },
			dataFields: [{ ...id }],
			roles: {
				tags: {
					cardinality: 'MANY',
				},
				color: { cardinality: 'ONE' },
				space: { cardinality: 'ONE' },
			},
		},
		'SpaceObj': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'SpaceObj' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [id],
			roles: {
				space: { cardinality: 'ONE' },
			},
			hooks: {
				pre: [
					{
						actions: [
							{
								type: 'transform',
								fn: ({ $op, id }) => {
									if ($op !== 'create') {
										return {};
									}
									if (!id) {
										throw new Error('id is required');
									}
									if (id.startsWith('secret')) {
										return {
											id: `${id}-YES!`,
										};
									} else {
										return {};
									}
								},
							},
						],
					},
				],
			},
		},
		'SpaceDef': {
			extends: 'SpaceObj',
			defaultDBConnector: { id: 'default', as: 'SpaceObj', path: 'SpaceDef' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [description],
		},
		'Kind': {
			extends: 'SpaceDef',
			dataFields: [{ contentType: 'TEXT', path: 'name', rights: ['CREATE', 'UPDATE'] }],
			linkFields: [
				{
					path: 'fields',
					relation: 'Field',
					cardinality: 'MANY',
					plays: 'kinds',
					target: 'relation',
				},
				{
					path: 'dataFields',
					relation: 'DataField',
					cardinality: 'MANY',
					plays: 'kinds',
					target: 'relation',
				},
			],
			defaultDBConnector: { id: 'default', as: 'SpaceDef', path: 'Kind' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			hooks: {
				pre: [
					{
						triggers: {
							onCreate: () => true,
							onUpdate: () => true,
						},
						//condition: () => true,
						actions: [
							{
								type: 'validate',
								fn: ({ name }) => !name || Boolean(name.length < 15), //in general this would be run at the attribute level instead, as we use a single attribute, but is for testing
								severity: 'error',
								message: 'Name must not exist, or be less than 15 characters',
							},
							{
								type: 'validate',
								fn: ({ fields }) => {
									if (!fields) {
										return true;
									}
									fields.some((f: any) => f.name === 'forbiddenName');
									throw new Error("You can't have a field named 'forbiddenName'");
								}, //in general this would be run at the attribute level instead, as we use a single attribute, but is for testing
								severity: 'error',
								message: 'Name must not exist, or be less than 15 characters',
							},
							{
								type: 'transform',
								fn: ({ name }) =>
									name === 'secretName'
										? {
												name: 'Not a secret',
											}
										: {},
							},
						],
					},
				],
			},
		},
		'Field': {
			extends: 'SpaceDef',
			dataFields: [
				{ contentType: 'TEXT', path: 'name' },
				{ contentType: 'TEXT', path: 'cardinality' },
			],
			roles: {
				kinds: {
					cardinality: 'MANY',
				},
			},
			defaultDBConnector: { id: 'default', as: 'SpaceDef', path: 'Field' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
		},
		'DataField': {
			extends: 'Field',
			dataFields: [
				{ contentType: 'TEXT', path: 'type' },
				{ contentType: 'TEXT', path: 'computeType' },
			],
			linkFields: [
				{
					path: 'values',
					relation: 'DataValue',
					cardinality: 'MANY',
					plays: 'dataField',
					target: 'relation',
				},
				{
					path: 'expression',
					relation: 'Expression',
					cardinality: 'ONE',
					plays: 'dataField',
					target: 'relation',
				},
			],

			defaultDBConnector: { id: 'default', as: 'Field', path: 'DataField' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
		},
		'Expression': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', as: 'Expression', path: 'Expression' },
			dataFields: [
				id,
				{ contentType: 'TEXT', path: 'value', rights: ['CREATE', 'UPDATE'] },
				{ contentType: 'TEXT', path: 'type' },
			],
			roles: {
				dataField: { cardinality: 'ONE' },
			},
		},
		'DataValue': {
			idFields: ['id'],
			dataFields: [id, { contentType: 'TEXT', path: 'type' }],
			roles: {
				dataField: { cardinality: 'ONE' },
			},
			defaultDBConnector: { id: 'default', path: 'DataValue' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
		},
		'Self': {
			idFields: ['id'],
			extends: 'SpaceObj',
			defaultDBConnector: { id: 'default', as: 'SpaceObj', path: 'Self' },
			roles: {
				owner: { cardinality: 'ONE' },
			},
			linkFields: [
				{
					path: 'owned',
					cardinality: 'MANY',
					relation: 'Self',
					plays: 'owner',
					target: 'relation',
				},
			],
		},
		'HookParent': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'HookParent' },
			dataFields: [{ ...id }],
			roles: {
				hooks: { cardinality: 'MANY' },
				mainHook: { cardinality: 'ONE' },
			},
		},
		'HookATag': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'HookATag' },
			dataFields: [{ ...id }],
			roles: {
				hookTypeA: { cardinality: 'ONE' },
			},
			hooks: {
				pre: [
					{
						triggers: {
							onCreate: () => true,
							onUpdate: () => true,
						},
						actions: [
							{
								type: 'validate',
								fn: ({ hookTypeA }) => {
									return !isArray(hookTypeA);
								},
								severity: 'error',
								message: "Can't be an array",
							},
						],
					},
				],
			},
		},
	},
} as const;
