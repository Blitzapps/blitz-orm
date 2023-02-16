import { listify, mapEntries, shake } from 'radash';

import { getCurrentSchema } from '../../helpers';
import type { BQLMutationBlock } from '../../types';
import type { PipelineOperation } from '../pipeline';

export const buildTQLMutation: PipelineOperation = async (req) => {
  const { bqlRequest, schema } = req;
  if (!bqlRequest) {
    throw new Error('BQL request not parsed');
  }
  const { mutation } = bqlRequest;
  if (!mutation) {
    throw new Error('BQL request is not a mutation');
  }

  // todo: Split attributes and edges
  const nodeToTypeQL = (
    node: BQLMutationBlock
  ): {
    deletionMatch?: string;
    insertionMatch?: string;
    deletion?: string;
    insertion?: string;
    op: string;
  } => {
    // console.log('--------nodeToTypeQL-----------');
    // console.log('id', node.$id);
    const op = node.$op as string;
    const id = node.$tempId || node.$id; // by default is $id but we use tempId when client specified one
    const currentSchema = getCurrentSchema(schema, node);
    const thingDbPath = currentSchema.defaultDBConnector?.path || node.$entity || node.$relation;

    const { idFields } = currentSchema;

    if (!idFields) throw new Error('no idFields');
    // todo: composite ids
    const idField = idFields[0];

    const attributes = listify(node, (k, v) => {
      // @ts-expect-error
      if (k.startsWith('$') || k === idField || !v) return '';
      // if (k.startsWith('$') || !v) return '';
      const currentDataField = currentSchema.dataFields?.find((x) => x.path === k);
      // console.log('currentDataField', currentDataField);
      const fieldDbPath = currentDataField?.path;

      if (!fieldDbPath) {
        // throw new Error('noFieldDbPath');
        return ``;
      }
      const dbField = currentDataField.dbPath;

      if (['TEXT', 'ID', 'EMAIL'].includes(currentDataField.contentType)) {
        return `has ${dbField} '${v}'`;
      }
      if (['NUMBER'].includes(currentDataField.contentType)) {
        return `has ${dbField} ${v}`;
      }
      if (currentDataField.contentType === 'DATE') {
        if (Number.isNaN(v.valueOf())) {
          throw new Error('Invalid format, Nan Date');
        }
        if (v instanceof Date) {
          return `has ${dbField} ${v.toISOString().replace('Z', '')}`;
        }
        return `has ${dbField} ${new Date(v).toISOString().replace('Z', '')}`;
      }
      throw new Error(`Unsupported contentType ${currentDataField.contentType}`);
    }).filter((x) => x);

    const attributesVar = `$${id}-atts`;

    const matchAttributes = listify(node, (k, v) => {
      // @ts-expect-error
      if (k.startsWith('$') || k === idField || !v) return '';
      // if (k.startsWith('$') || !v) return '';
      const currentDataField = currentSchema.dataFields?.find((x) => x.path === k);
      // console.log('currentDataField', currentDataField);
      const fieldDbPath = currentDataField?.path;

      if (!fieldDbPath) {
        // throw new Error('noFieldDbPath');
        return ``;
      }
      const dbField = currentDataField.dbPath;

      return `{${attributesVar} isa ${dbField};}`;
    }).filter((x) => x);

    // todo: composite ids
    const idFieldValue = node[idField] || node.$id;
    const idDataField = currentSchema.dataFields?.find((x) => x.path === idField);

    // todo default could be just a value, using the function by default
    const idDefaultValue = node.$op === 'create' ? idDataField?.default?.value() : null;

    const idValue = idFieldValue || idDefaultValue;

    const idAttributes = idValue // it must have id values.
      ? // if it is a relation, add only the id fields in the lines where we add the roles also so it does not get defined twice
        [`has ${idField} '${idValue}'`]
      : [];

    const allAttributes = [...idAttributes, ...attributes].filter((x) => x).join(',');

    const getDeletionMatch = () => {
      if (node.$tempId) return '';
      // todo: ensure parents belong to grandparents. [https://github.com/Blitzapps/blitz/issues/9]
      if (op === 'delete' || op === 'unlink' || op === 'noop') {
        return `$${id} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`;
      }
      if (op === 'update') {
        if (!matchAttributes.length) throw new Error('update without attributes');
        return `$${id} isa ${thingDbPath}, ${
          idAttributes[0] // todo: Multiple attributes
        }, has ${attributesVar};
        ${matchAttributes.join(' or ')};
      `;
      }
      return '';
    };

    const getInsertionMatch = () => {
      // todo: ensure parents belong to grandparents. [https://github.com/Blitzapps/blitz/issues/9]
      if (node.$tempId) return '';
      if (op === 'update' || op === 'link' || op === 'noop') {
        return `$${id} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`;
      }
      return '';
    };

    if (node.$entity || node.$relation) {
      return {
        op,
        deletionMatch: getDeletionMatch(),
        insertionMatch: getInsertionMatch(),
        insertion:
          op === 'create'
            ? `$${id} isa ${[thingDbPath, allAttributes].filter((x) => x).join(',')};`
            : op === 'update' && attributes.length
            ? `$${id} ${attributes.join(',')};`
            : '',
        deletion:
          op === 'delete'
            ? `$${id} isa ${thingDbPath};`
            : op === 'update' && matchAttributes.length
            ? `$${id} has ${attributesVar};`
            : '',
      };
    }

    throw new Error('in attributes');
  };

  const edgeToTypeQL = (
    node: BQLMutationBlock
  ): {
    deletionMatch?: string;
    insertionMatch?: string;
    deletion?: string;
    insertion?: string;
    op: string;
  } => {
    const op = node.$op as string;
    const id = node.$tempId || node.$id; // by default is $id but we use tempId when client specified one
    const currentSchema = getCurrentSchema(schema, node);

    const relationDbPath = currentSchema.defaultDBConnector?.path || node.$relation;

    const roleFields = 'roles' in currentSchema ? listify(currentSchema.roles, (k) => k) : [];

    const roleDbPaths =
      node.$relation &&
      'roles' in currentSchema &&
      mapEntries(currentSchema.roles, (k, v) => [k, v.dbConnector?.path || k]);

    // roles can be specified in three ways, either they are a roleField in the node, they are the children of something, or they have a default/computed link
    // 1) roleFields
    const fromRoleFields = listify(node, (k: string, v) => {
      if (!roleFields.includes(k)) return null;
      if (!('roles' in currentSchema)) {
        throw new Error('This should have roles! ');
      }
      const roleDbPath = roleDbPaths[k];
      if (Array.isArray(v)) {
        return v.map((x) => ({ path: roleDbPath, id: x }));
      }
      return { path: roleDbPath, id: v };
    })
      .filter((x) => x)
      .flat();

    const fromRoleFieldsTql = fromRoleFields.map((x) => (x ? `${x.path}: $${x.id}` : ''));

    const roles = fromRoleFields.length > 0 ? `( ${fromRoleFieldsTql.join(' , ')} )` : '';

    // console.log('roles', roles);

    const relationTql = !roles
      ? ''
      : `$${id} ${roles} ${node[Symbol.for('edgeType') as any] === 'linkField' ? `isa ${relationDbPath}` : ''}`;

    const getInsertions = () => {
      if (!relationTql) return '';
      if (op === 'link') return `${relationTql};`;
      // todo: properly assign id attributes to simple edges, or remove them or something
      if (op === 'create') return `${relationTql}, has id '${id}';`;
      return '';
    };

    const getDeletions = () => {
      if (!relationTql) return '';
      if (op === 'unlink') return `${relationTql};`;
      return '';
    };
    return {
      deletionMatch: '',
      insertionMatch: '',
      deletion: getDeletions(),
      insertion: getInsertions(),
      op: '',
    };
  };

  const toTypeQL = (
    nodes: BQLMutationBlock[] | BQLMutationBlock,
    mode?: 'nodes' | 'edges'
  ):
    | {
        insertionMatch?: string;
        deletionMatch?: string;
        insertion?: string;
        deletion?: string;
      }[]
    | {
        insertionMatch?: string;
        deletionMatch?: string;
        insertion?: string;
        deletion?: string;
      } => {
    const typeQL = mode === 'edges' ? edgeToTypeQL : nodeToTypeQL;
    if (Array.isArray(nodes)) {
      return nodes
        .map((x) => {
          const { insertionMatch, deletionMatch, insertion, deletion } = typeQL(x);
          return shake({ insertionMatch, deletionMatch, insertion, deletion }, (z) => !z);
        })
        .filter((y) => y);
    }
    const { insertionMatch, deletionMatch, insertion, deletion } = typeQL(nodes);

    return shake({ insertionMatch, deletionMatch, insertion, deletion }, (z) => !z);
  };

  const nodeOperations = toTypeQL(mutation.things);
  const arrayNodeOperations = Array.isArray(nodeOperations) ? nodeOperations : [nodeOperations];
  const edgeOperations = toTypeQL(mutation.edges, 'edges');
  const arrayEdgeOperations = Array.isArray(edgeOperations) ? edgeOperations : [edgeOperations];
  const allOperations = [...arrayNodeOperations, ...arrayEdgeOperations];
  // console.log('allOperations', allOperations);

  // todo: split BQL mutation in N DBstreams per DB
  // todo: then pack them per DB,
  // const dbHandleList = config.dbConnectors.map((x) => x.id);

  const tqlRequest = shake(
    {
      insertionMatches: allOperations
        .map((x) => x.insertionMatch)
        .join(' ')
        .trim(),
      deletionMatches: allOperations
        .map((x) => x.deletionMatch)
        .join(' ')
        .trim(),
      insertions: allOperations
        .map((x) => x.insertion)
        .join(' ')
        .trim(),
      deletions: allOperations
        .map((x) => x.deletion)
        .join(' ')
        .trim(),
      // ...(typeQLRelations?.length && { relations: typeQLRelations }),
    },
    (x) => !x
  );
  req.tqlRequest = tqlRequest;
};
