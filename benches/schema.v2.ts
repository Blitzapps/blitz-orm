import type { BormSchema, DataField } from '../src';
import { genId } from '../src/helpers';

const id: DataField = {
  path: 'id',
  default: { type: 'fn', fn: () => genId() },
  validations: { required: true, unique: true },
  contentType: 'ID',
  rights: ['CREATE'],
};

export const schema: BormSchema = {
  entities: {},
  relations: {
    t_a: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 't_a' },
      dataFields: [
        id,
        { contentType: 'BOOLEAN', path: 'boolean_1' },
        { contentType: 'NUMBER', path: 'number_1' },
        { contentType: 'TEXT', path: 'string_1' },
        { contentType: 'DATE', path: 'datetime_1' },
      ],
      roles: {},
      linkFields: [
        {
          path: 'ref_one',
          cardinality: 'ONE',
          relation: 't_b',
          plays: 'ref_one',
          target: 'relation',
        },
        {
          path: 'ref_few',
          cardinality: 'MANY',
          relation: 't_b',
          plays: 'ref_few',
          target: 'relation',
        },
        {
          path: 'ref_many',
          cardinality: 'MANY',
          relation: 't_b',
          plays: 'ref_many',
          target: 'relation',
        },
        {
          path: 'fut_one',
          relation: 'tunnel_one',
          plays: 'a',
          target: 'role',
          targetRole: 'b',
          cardinality: 'ONE',
        },
        {
          path: 'fut_few',
          relation: 'tunnel_few',
          plays: 'a',
          target: 'role',
          targetRole: 'b',
          cardinality: 'MANY',
        },
        {
          path: 'fut_many',
          relation: 'tunnel_many',
          plays: 'a',
          target: 'role',
          targetRole: 'b',
          cardinality: 'MANY',
        },
        {
          path: 'tunnel_one',
          relation: 'tunnel_one',
          plays: 'a',
          target: 'relation',
          cardinality: 'ONE',
        },
        {
          path: 'tunnel_few',
          relation: 'tunnel_few',
          plays: 'a',
          target: 'relation',
          cardinality: 'MANY',
        },
        {
          path: 'tunnel_many',
          relation: 'tunnel_many',
          plays: 'a',
          target: 'relation',
          cardinality: 'MANY',
        },
      ],
    },
    t_b: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 't_b' },
      dataFields: [
        id,
        { contentType: 'BOOLEAN', path: 'boolean_1' },
        { contentType: 'NUMBER', path: 'number_1' },
        { contentType: 'TEXT', path: 'string_1' },
        { contentType: 'DATE', path: 'datetime_1' },
      ],
      roles: {
        ref_one: {
          cardinality: 'ONE',
        },
        ref_few: {
          cardinality: 'MANY',
        },
        ref_many: {
          cardinality: 'MANY',
        },
      },
      linkFields: [
        {
          path: 'fut_one',
          relation: 'tunnel_one',
          plays: 'b',
          target: 'role',
          targetRole: 'a',
          cardinality: 'ONE',
        },
        {
          path: 'fut_few',
          relation: 'tunnel_few',
          plays: 'b',
          target: 'role',
          targetRole: 'a',
          cardinality: 'MANY',
        },
        {
          path: 'fut_many',
          relation: 'tunnel_many',
          plays: 'b',
          target: 'role',
          targetRole: 'a',
          cardinality: 'MANY',
        },
        {
          path: 'tunnel_one',
          relation: 'tunnel_one',
          plays: 'b',
          target: 'relation',
          cardinality: 'ONE',
        },
        {
          path: 'tunnel_few',
          relation: 'tunnel_few',
          plays: 'b',
          target: 'relation',
          cardinality: 'MANY',
        },
        {
          path: 'tunnel_many',
          relation: 'tunnel_many',
          plays: 'b',
          target: 'relation',
          cardinality: 'MANY',
        },
      ],
    },
    tunnel_one: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'tunnel_one' },
      dataFields: [id],
      roles: {
        a: {
          cardinality: 'ONE',
        },
        b: {
          cardinality: 'ONE',
        },
      },
      linkFields: [],
    },
    tunnel_few: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'tunnel_few' },
      dataFields: [id],
      roles: {
        a: {
          cardinality: 'ONE',
        },
        b: {
          cardinality: 'ONE',
        },
      },
      linkFields: [],
    },
    tunnel_many: {
      idFields: ['id'],
      defaultDBConnector: { id: 'default', path: 'tunnel_many' },
      dataFields: [id],
      roles: {
        a: {
          cardinality: 'ONE',
        },
        b: {
          cardinality: 'ONE',
        },
      },
      linkFields: [],
    },
  },
};
