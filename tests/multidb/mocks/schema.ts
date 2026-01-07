import { v4 as uuidv4 } from 'uuid';
import type { BormSchema, DataField } from '../../../src';

const id: DataField = {
  path: 'id',
  shared: true,
  default: { type: 'fn', fn: () => uuidv4() },
  validations: { required: true, unique: true },
  contentType: 'ID',
  rights: ['CREATE'],
};

const typeDBSchema: BormSchema = {
  entities: {
    User: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'User' },
      dataFields: [
        id,
        {
          contentType: 'TEXT',
          path: 'name',
        },
        {
          contentType: 'TEXT',
          path: 'email',
        },
      ],
      linkFields: [
        {
          path: 'ownedSpaces',
          cardinality: 'MANY',
          relation: 'SpaceOwner',
          plays: 'owner',
          target: 'role',
          targetRole: 'space',
        },
        {
          path: 'spaces',
          cardinality: 'MANY',
          relation: 'SpaceMember',
          plays: 'member',
          target: 'role',
          targetRole: 'space',
        },
        {
          path: 'projects',
          cardinality: 'MANY',
          relation: 'ProjectExecutor',
          plays: 'executor',
          target: 'role',
          targetRole: 'project',
        },
      ],
    },
    Space: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'Space' },
      dataFields: [
        id,
        {
          contentType: 'TEXT',
          path: 'name',
        },
      ],
      linkFields: [
        {
          path: 'owner',
          cardinality: 'ONE',
          relation: 'SpaceOwner',
          plays: 'space',
          target: 'role',
          targetRole: 'owner',
        },
        {
          path: 'members',
          cardinality: 'MANY',
          relation: 'SpaceMember',
          plays: 'space',
          target: 'role',
          targetRole: 'member',
        },
        {
          path: 'projects',
          cardinality: 'MANY',
          relation: 'SpaceProject',
          plays: 'space',
          target: 'role',
          targetRole: 'projects',
        },
      ],
    },
    Project: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'Space' },
      dataFields: [
        id,
        {
          contentType: 'TEXT',
          path: 'name',
        },
      ],
      linkFields: [
        {
          path: 'space',
          cardinality: 'ONE',
          relation: 'SpaceProject',
          plays: 'project',
          target: 'role',
          targetRole: 'space',
        },
        {
          path: 'executors',
          cardinality: 'MANY',
          relation: 'ProjectExecutor',
          plays: 'project',
          target: 'role',
          targetRole: 'executor',
        },
      ],
    },
  },
  relations: {
    SpaceOwner: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'SpaceOwner' },
      dataFields: [id],
      roles: {
        space: { cardinality: 'ONE' },
        owner: { cardinality: 'ONE' },
      },
    },
    SpaceMember: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'SpaceMember' },
      dataFields: [id],
      roles: {
        space: { cardinality: 'ONE' },
        member: { cardinality: 'ONE' },
      },
    },
    SpaceProject: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'SpaceProject' },
      dataFields: [id],
      roles: {
        space: { cardinality: 'ONE' },
        project: { cardinality: 'ONE' },
      },
    },
    ProjectExecutor: {
      idFields: ['id'],
      defaultDBConnector: { id: 'typeDB', path: 'ProjectExecutor' },
      dataFields: [id],
      roles: {
        project: { cardinality: 'ONE' },
        executor: { cardinality: 'ONE' },
      },
    },
  },
};

const surrealDBSchema: BormSchema = {
  entities: {
    task: {
      idFields: ['id'],
      defaultDBConnector: { id: 'surrealDB', path: 'task' },
      dataFields: [
        id,
        {
          contentType: 'TEXT',
          path: 'name',
        },
      ],
      linkFields: [
        {
          path: 'executors',
          cardinality: 'MANY',
          relation: 'person',
          plays: 'tasks',
          target: 'relation',
        },
      ],
    },
  },
  relations: {
    company: {
      idFields: ['id'],
      defaultDBConnector: { id: 'surrealDB', path: 'company' },
      dataFields: [
        id,
        {
          contentType: 'TEXT',
          path: 'name',
        },
      ],
      roles: {
        employees: { cardinality: 'MANY' },
      },
      linkFields: [],
    },
    person: {
      idFields: ['id'],
      defaultDBConnector: { id: 'surrealDB', path: 'person' },
      dataFields: [
        id,
        {
          contentType: 'TEXT',
          path: 'name',
        },
        {
          contentType: 'TEXT',
          path: 'email',
        },
      ],
      roles: {
        tasks: { cardinality: 'MANY' },
      },
      linkFields: [
        {
          path: 'company',
          cardinality: 'MANY',
          relation: 'company',
          plays: 'employees',
          target: 'relation',
        },
      ],
    },
  },
};

export const schema: BormSchema = {
  entities: {
    ...typeDBSchema.entities,
    ...surrealDBSchema.entities,
  },
  relations: {
    ...typeDBSchema.relations,
    ...surrealDBSchema.relations,
  },
};
