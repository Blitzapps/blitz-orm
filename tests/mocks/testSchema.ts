import { v4 as uuidv4 } from 'uuid';

import type { BormSchema, DataField } from '../../src/index';

export const name: DataField = {
  shared: true,
  path: 'name',
  cardinality: 'ONE',
  contentType: 'TEXT',
};

export const description: DataField = {
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

export const string: Omit<DataField, 'path'> = {
  cardinality: 'ONE',
  contentType: 'TEXT',
};

export const id: DataField = {
  shared: true,
  path: 'id',
  cardinality: 'ONE',
  default: { type: 'function', value: () => uuidv4() },
  validations: { required: true, unique: true },
  contentType: 'ID',
  rights: ['CREATE'],
};

export const testSchema: BormSchema = {
  entities: {
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
          target: 'role',
          /// rights => Either you want to make it 1) read only 2)replace only 3) update only 4) delete only 5) create only ...
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
        { ...id },
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
        { ...string, path: 'sessionToken', validations: { unique: true } },
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
        { ...string, path: 'identifier' },
        { ...string, path: 'token', validations: { unique: true } },
        { ...timestamp, path: 'expires' },
      ],
    },
  },
  relations: {
    ThingRelation: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'ThingRelation' },
      // defaultDBConnector: { id: 'tdb', path: 'User·Account' }, //todo: when Dbpath != relation name
      dataFields: [{ ...id }],
      roles: {
        things: {
          cardinality: 'MANY',
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
    UserTag: {
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
    UserTagGroup: {
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
    SpaceObj: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'SpaceObj' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
      dataFields: [id],
      roles: {
        space: {
          cardinality: 'ONE',
        },
      },
    },
    SpaceDef: {
      extends: 'SpaceObj',
      defaultDBConnector: { id: 'default', as: 'SpaceObj', path: 'SpaceDef' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
      dataFields: [description],
    },
    Kind: {
      extends: 'SpaceDef',
      dataFields: [{ ...string, path: 'name', rights: ['CREATE', 'UPDATE'] }],
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
    },
    Field: {
      extends: 'SpaceDef',
      dataFields: [
        { ...string, path: 'name' },
        { ...string, path: 'cardinality' },
      ],
      roles: {
        kinds: {
          cardinality: 'MANY',
        },
      },
      defaultDBConnector: { id: 'default', as: 'SpaceDef', path: 'Field' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
    },
    DataField: {
      extends: 'Field',
      dataFields: [
        { ...string, path: 'type' },
        { ...string, path: 'computeType' },
      ],
      defaultDBConnector: { id: 'default', as: 'Field', path: 'DataField' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
    },
    Self: {
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
};
