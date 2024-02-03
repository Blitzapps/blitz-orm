import { v4 as uuidv4 } from 'uuid';

import type { BormSchema, DataField } from '../../src/index';
//* when updating, please run `pnpm test:buildSchema`

const name: DataField = {
	shared: true,
	path: 'name',
	cardinality: 'ONE',
	contentType: 'TEXT',
};

const description: DataField = {
	shared: true,
	path: 'description',
	contentType: 'TEXT',
	cardinality: 'ONE',
};

const timestamp: DataField = {
	path: 'timestamp',
	cardinality: 'ONE',
	contentType: 'DATE',
};

const id: DataField = {
	shared: true,
	path: 'id',
	cardinality: 'ONE',
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
					cardinality: 'ONE',
					path: 'requiredOption',
					default: { type: 'value', value: 'a' },
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
					cardinality: 'ONE',
					contentType: 'TEXT',
					validations: {
						fn: (val) => (isEmail(val) && isGmail(val)) ?? false,
					},
				},
				{
					cardinality: 'ONE',
					contentType: 'DATE',
					path: 'timestamp',
					default: {
						type: 'fn',
						fn: () => new Date().toISOString().replace('Z', ''),
					},
				},
			],
		},
		Thing: {
			idFields: ['id'], // could be a composite key
			defaultDBConnector: { id: 'default', path: 'Thing' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [
				{ ...id },
				{
					path: 'stuff',
					contentType: 'TEXT',
					cardinality: 'ONE',
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
			defaultDBConnector: { id: 'default' },
		},
		SubthingTwo: {
			extends: 'Thing',
			defaultDBConnector: { id: 'default' },
		},
		Account: {
			idFields: ['id'], // could be a composite key
			defaultDBConnector: { id: 'default', path: 'Account' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [
				{ ...id },
				{
					path: 'provider',
					contentType: 'TEXT',
					cardinality: 'ONE',
					rights: ['CREATE', 'UPDATE', 'DELETE'],
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
					cardinality: 'ONE',
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
		},
		SuperUser: {
			extends: 'User',
			defaultDBConnector: { id: 'default' },
			dataFields: [
				{
					path: 'power',
					contentType: 'TEXT',
					cardinality: 'ONE',
				},
			],
		},
		God: {
			extends: 'SuperUser',
			defaultDBConnector: { id: 'default' },
			dataFields: [
				{
					path: 'isEvil',
					contentType: 'BOOLEAN',
					cardinality: 'ONE',
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
          cardinality: 'ONE',
          validations: { required: true, unique: true },
          contentType: 'TEXT',
          rights: ['CREATE'],
        }, */
				{
					path: 'isBlue',
					cardinality: 'ONE',
					contentType: 'BOOLEAN', //no boolean yet
					isVirtual: true,
					default: {
						type: 'fn',
						fn: ({ id }) => (id === 'blue' ? true : false),
					},
				},
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
				{ cardinality: 'ONE', contentType: 'TEXT', path: 'sessionToken', validations: { unique: true } },
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
				{ contentType: 'TEXT', cardinality: 'ONE', path: 'identifier' },
				{ contentType: 'TEXT', cardinality: 'ONE', path: 'token', validations: { unique: true } },
				{ ...timestamp, path: 'expires' },
			],
		},
	},
	relations: {
		'ThingRelation': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'ThingRelation' },
			// defaultDBConnector: { id: 'tdb', path: 'User·Account' }, //todo: when Dbpath != relation name
			dataFields: [{ ...id }],
			roles: {
				things: {
					cardinality: 'MANY',
				},
				root: {
					cardinality: 'ONE',
				},
				extra: {
					cardinality: 'ONE',
				},
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
				user: {
					cardinality: 'ONE',
				},
			},
		},
		'User-Sessions': {
			defaultDBConnector: { id: 'default', path: 'User-Sessions' },
			idFields: ['id'],
			dataFields: [{ ...id }],
			roles: {
				user: {
					cardinality: 'ONE',
				},
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
				color: {
					cardinality: 'ONE',
				},
				space: {
					cardinality: 'ONE',
				},
			},
		},
		'SpaceObj': {
			idFields: ['id'],
			defaultDBConnector: { id: 'default', path: 'SpaceObj' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [id],
			roles: {
				space: {
					cardinality: 'ONE',
				},
			},
		},
		'SpaceDef': {
			extends: 'SpaceObj',
			defaultDBConnector: { id: 'default', as: 'SpaceObj', path: 'SpaceDef' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
			dataFields: [description],
		},
		'Kind': {
			extends: 'SpaceDef',
			dataFields: [{ contentType: 'TEXT', cardinality: 'ONE', path: 'name', rights: ['CREATE', 'UPDATE'] }],
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
								type: 'transform',
								fn: ({ name }) =>
									name === 'secretKind'
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
				{ contentType: 'TEXT', cardinality: 'ONE', path: 'name' },
				{ contentType: 'TEXT', cardinality: 'ONE', path: 'cardinality' },
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
				{ contentType: 'TEXT', cardinality: 'ONE', path: 'type' },
				{ contentType: 'TEXT', cardinality: 'ONE', path: 'computeType' },
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
			dataFields: [id, { contentType: 'TEXT', cardinality: 'ONE', path: 'value', rights: ['CREATE', 'UPDATE'] }],
			roles: {
				dataField: {
					cardinality: 'ONE',
				},
			},
		},
		'DataValue': {
			idFields: ['id'],
			dataFields: [id, { contentType: 'TEXT', cardinality: 'ONE', path: 'type' }],
			roles: {
				dataField: {
					cardinality: 'ONE',
				},
			},
			defaultDBConnector: { id: 'default', path: 'DataValue' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
		},
		'Self': {
			idFields: ['id'],
			extends: 'SpaceObj',
			defaultDBConnector: { id: 'default', as: 'SpaceObj', path: 'Self' },
			roles: {
				owner: {
					cardinality: 'ONE',
				},
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
	},
} as const;
