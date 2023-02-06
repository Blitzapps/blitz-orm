import { v4 as uuidv4 } from 'uuid';

import type { BormSchema, DataField } from '../../src/index';

export const name: DataField = {
  shared: true,
  path: 'name',
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
        },
      ],
    },
    User: {
      idFields: ['id'], // could be a namecomposite key
      defaultDBConnector: { id: 'default' }, // in the future multiple can be specified in the config file. Either they fetch full schemas or they will require a relation to merge attributes from different databases
      dataFields: [
        // dbConnector: {db: TypeDB, type: 'attribute', value: 'User.id'} // each field could be configured with a dbConnectors array, but if it is specified at top level, the id used directly
        { ...id },
        { ...name, rights: ['CREATE', 'UPDATE'] },
        {
          path: 'email',
          cardinality: 'ONE',
          // dbConnectors: [{ id: 'tbc', path: 'email' }], //no need, if no specified it usses the name
          contentType: 'EMAIL',
          validations: { unique: true },
          rights: ['CREATE'],
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
    Space: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default' },
      dataFields: [
        // dbConnector: {db: TypeDB, type: 'attribute', value: 'User.id'} // each field could be configured with a dbConnectors array, but if it is specified at top level, the id used directly
        { ...id },
        { ...name, rights: ['CREATE', 'UPDATE'] },
      ],
      linkFields: [
        {
          path: 'users',
          cardinality: 'MANY',
          relation: 'Space-User',
          plays: 'spaces',
          target: 'role',
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
  },
  relations: {
    'User-Accounts': {
      // id: 'User·Accounts',
      // name: "User·Accounts",
      // class: 'OWNED',
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'User-Accounts' },
      // defaultDBConnector: { id: 'tdb', path: 'User·Account' }, //todo: when Dbpath != relation name
      dataFields: [{ ...id }],
      roles: {
        accounts: {
          cardinality: 'MANY',

          // path: 'accounts', // path for json reference
          // key: 'account', // replaced by path in the dbConnector
          // cardinality: 'MANY',
          // ordered: false,
          // embedded: true, // this means that accounts are removed when their user is removed.
          // rights: ['CREATE', 'UPDATE', 'DELETE'],
          // dbConnector: { id: 'typeDB', as: 'owned', path: 'account' }, // can specify a path here db key if different from path
        },

        user: {
          cardinality: 'ONE',

          // path: 'user',
          // cardinality: 'ONE',
          // rights: ['LINK'],
          // dbConnector: { id: 'typeDB', as: 'owner', path: 'user' },
        },
      },
    },
    'Space-User': {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'Space-User' },
      dataFields: [{ ...id }],
      roles: {
        spaces: {
          cardinality: 'MANY',
          /* path: 'spaces', // path for json reference
          cardinality: 'MANY',
          rights: ['CREATE', 'UPDATE', 'DELETE'],
          dbConnector: { id: 'typeDB', as: 'reling', path: 'space' }, */
        },
        users: {
          cardinality: 'MANY',
          /*
          path: 'users',
          cardinality: 'MANY',
          rights: ['LINK'],
          dbConnector: { id: 'typeDB', as: 'reling', path: 'user' }, */
        },
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
      },
    },
  },
};
