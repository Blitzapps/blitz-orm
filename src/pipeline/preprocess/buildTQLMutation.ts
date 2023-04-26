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

  const getDependencies = (path: string, allNodes: BQLMutationBlock[]): BQLMutationBlock[] => {
    const pathDeps = path.split('.');
    const dependencies = pathDeps.map((_: string, i: number) => pathDeps.slice(0, -i).join('.'));
    const includedItself = [...dependencies, path];
    return allNodes.filter((x) => includedItself.includes(x[Symbol.for('path') as any]));
  };

  const getNodesWithOps = (nodes: BQLMutationBlock[]) =>
    nodes
      .filter((x) => x.$op !== 'noop')
      .map((y) => {
        const path = y[Symbol.for('path') as any];

        return {
          path,
          node: y,
          thingDependencies: getDependencies(path, mutation.things),
          edgeDependencies: getDependencies(path, mutation.edges),
        };
      });
  const thingsWithOps = getNodesWithOps(mutation.things);
  const edgesWithOps = getNodesWithOps(mutation.edges);
  // console.log('thingsWithOps', thingsWithOps);
  // console.log('edgesWithOps', edgesWithOps);

  // todo: Split attributes and edges
  const nodeToTypeQL = (
    node: BQLMutationBlock
  ): {
    preDeletionBatch?: any[];
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

    const getDeletionMatchInNodes = () => {
      // if (node.$tempId) return ''; /// commented because we need tempIds to work when replacing a unlink/link all operation
      // todo: ensure parents belong to grandparents. [https://github.com/Blitzapps/blitz/issues/9]
      if (op === 'delete' || op === 'unlink' || op === 'noop') {
        return `$${id} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`;
      }
      if (op === 'update') {
        if (!matchAttributes.length) throw new Error('update without attributes');
        return `$${id} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')}, has ${attributesVar};
        ${matchAttributes.join(' or ')};
      `;
      }
      return '';
    };

    const getInsertionMatchInNodes = () => {
      // todo: ensure parents belong to grandparents. [https://github.com/Blitzapps/blitz/issues/9]
      // if (node.$tempId) return ''; /// same as getDeletionMatch
      if (op === 'update' || op === 'link' || op === 'noop') {
        return `$${id} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`;
      }
      return '';
    };

    if (node.$entity || node.$relation) {
      return {
        op,
        deletionMatch: getDeletionMatchInNodes(),
        insertionMatch: getInsertionMatchInNodes(),
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
    preDeletionBatch?: any[];
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

    /// if one of the roles's id is undefined it means it applies to every object of that thingType so we need to create an id for it
    const fromRoleFieldsTql = fromRoleFields.map((x) => {
      if (!x?.path) {
        throw new Error('Object without path');
      }
      return `${x.path}: $${x.id}`;
    });

    const roles = fromRoleFields.length > 0 ? `( ${fromRoleFieldsTql.join(' , ')} )` : '';

    // console.log('roles', roles);

    const relationTql = !roles
      ? ''
      : `$${id} ${roles} ${
          node[Symbol.for('edgeType') as any] === 'linkField' || op === 'delete' || op === 'unlink'
            ? `isa ${relationDbPath}`
            : ''
        }`;

    const relationTqlWithoutRoles = `$${id}  ${
      node[Symbol.for('edgeType') as any] === 'linkField' || op === 'delete' ? `isa ${relationDbPath}` : ''
    }`;

    const getInsertionsInEdges = () => {
      if (!relationTql) return '';
      if (op === 'link') return `${relationTql};`;
      // todo: properly assign id attributes to simple edges, or remove them or something
      if (op === 'create') return `${relationTql}, has id '${id}';`;
      return '';
    };

    const getDeletionMatchInEdges = () => {
      if (!relationTql) return '';
      /// edge delete: we are removing an automatic relation
      if (op === 'delete') return `${relationTql};`;
      /// edge unlink means: We are editing a real relation's roles
      if (op === 'unlink') {
        /// unlinking more than one role is not supported yet
        return `$${id} ${roles} isa ${relationDbPath};`;
      }

      return '';
    };

    const getDeletionsInEdges = () => {
      if (!relationTql) return '';
      // todo: same as insertions, better manage the ids here
      if (op === 'delete') return `${relationTqlWithoutRoles};`;
      if (op === 'unlink') return `$${id} ${roles};`;
      return '';
    };

    const getPreDeletionBatch = () => {
      if (op === 'unlink') {
        return fromRoleFields
          .filter((y) => y)
          .map((x) => {
            return {
              match: `$${id} (${x?.path}: $${x?.id}) isa ${relationDbPath};`,
              deletion: `$${id} (${x?.path}: $${x?.id}) ${
                node[Symbol.for('edgeType') as any] === 'linkField' ? `isa ${relationDbPath}` : ''
              }`,
            };
          });
      }
      return [];
    };

    return {
      // preDeletionBatch: getPreDeletionBatch(),
      deletionMatch: getDeletionMatchInEdges(),
      insertionMatch: '',
      deletion: getDeletionsInEdges(),
      insertion: getInsertionsInEdges(),
      op: '',
    };
  };

  const toTypeQL = (
    nodes: BQLMutationBlock[] | BQLMutationBlock,
    mode?: 'nodes' | 'edges'
  ):
    | {
        preDeletionBatch?: any[];
        insertionMatch?: string;
        deletionMatch?: string;
        insertion?: string;
        deletion?: string;
      }[]
    | {
        preDeletionBatch?: any[];
        insertionMatch?: string;
        deletionMatch?: string;
        insertion?: string;
        deletion?: string;
      } => {
    const typeQL = mode === 'edges' ? edgeToTypeQL : nodeToTypeQL;

    if (Array.isArray(nodes)) {
      return nodes
        .map((x) => {
          const { preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion } = typeQL(x);
          return shake({ preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion }, (z) => !z);
        })
        .filter((y) => y);
    }
    const { preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion } = typeQL(nodes);

    return shake({ preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion }, (z) => !z);
  };

  const thingStreams = thingsWithOps.map((x) => toTypeQL([...x.thingDependencies, ...x.edgeDependencies]));
  const edgeStreams = edgesWithOps.map((x) => toTypeQL([...x.thingDependencies, ...x.edgeDependencies], 'edges'));

  // console.log('thingStreams', JSON.stringify(thingStreams, null, 3));
  // console.log('edgeStreams', edgeStreams);

  const nodeOperations = toTypeQL(mutation.things);
  const arrayNodeOperations = Array.isArray(nodeOperations) ? nodeOperations : [nodeOperations];
  const edgeOperations = toTypeQL(mutation.edges, 'edges');
  const arrayEdgeOperations = Array.isArray(edgeOperations) ? edgeOperations : [edgeOperations];
  // console.log('nodeOperations', nodeOperations);
  // console.log('edgeOperations', edgeOperations);

  const allOperations = [...arrayNodeOperations, ...arrayEdgeOperations];
  // console.log('allOperations', allOperations);

  // todo: split BQL mutation in N DBstreams per DB
  // todo: then pack them per DB,
  // const dbHandleList = config.dbConnectors.map((x) => x.id);

  // const creations = [];

  const tqlRequest = shake(
    {
      // preDeletionBatch: allOperations.flatMap((x) => x.preDeletionBatch).filter((y) => y !== undefined),
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
  // console.log('tqlRequest', tqlRequest);
  req.tqlRequest = tqlRequest;
};
