import { isArray, listify, mapEntries, shake } from 'radash';

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
		node: BQLMutationBlock,
	): {
		preDeletionBatch?: any[];
		deletionMatch?: string;
		insertionMatch?: string;
		deletion?: string;
		insertion?: string;
		op: string;
	} => {
		// This function converts a node into a TypeQL object.
		// It takes a BQLMutationBlock as input and returns an object with the following properties:
		// preDeletionBatch, deletionMatch, insertionMatch, deletion, insertion, and op.
		// The function first extracts the operation type, the node's bzId, and the current schema.
		// It then determines the thingDbPath based on the defaultDBConnector or the node's entity or relation.
		// The idValue is extracted from the node, and the idField is determined based on the idFields in the current schema.
		// Note: Composite ids are not currently supported.
		const op = node.$op as string;
		const bzId = `$${node.$bzId}`;
		const currentSchema = getCurrentSchema(schema, node);
		const { idFields, defaultDBConnector } = currentSchema;

		const thingDbPath = defaultDBConnector?.path || node.$entity || node.$relation;

		const idValue = node.$id;

		const idField = idFields?.[0];

		const attributes = listify(node, (k, v) => {
			// The listify function is used to generate a list of attributes for the node.
			// It iterates over the node's properties and returns a string for each property that doesn't start with '$', 
			// is not the idField, and is not undefined or null.
			// For each property, it finds the corresponding data field in the current schema and determines the fieldDbPath.
			// If the fieldDbPath is not found, it returns an empty string.
			// Otherwise, it returns a string that represents the attribute in TypeQL format.
			// The format of the string depends on the contentType of the currentDataField.
			// For 'TEXT', 'ID', and 'EMAIL' contentTypes, the string is in the format `has ${dbField} '${v}'`.
			// For 'NUMBER' and 'BOOLEAN' contentTypes, the string is in the format `has ${dbField} ${v}`.
			if (k.startsWith('$') || k === idField || v === undefined || v === null) {
				return '';
			}
			const currentDataField = currentSchema.dataFields?.find((x) => x.path === k);
			const fieldDbPath = currentDataField?.path;

			if (!fieldDbPath) {
				return '';
			}
			const dbField = currentDataField.dbPath;

			if (['TEXT', 'ID', 'EMAIL'].includes(currentDataField.contentType)) {
				return `has ${dbField} '${v}'`;
			}
			// For 'NUMBER' and 'BOOLEAN' contentTypes, the string is in the format `has ${dbField} ${v}`.
			// For 'DATE' contentType, the value is first checked to ensure it is not NaN.
			// If the value is an instance of Date, the string is in the format `has ${dbField} ${v.toISOString().replace('Z', '')}`.
			// Otherwise, the value is converted to a Date and the string is in the format `has ${dbField} ${new Date(v).toISOString().replace('Z', '')}`.
			// If the contentType is not supported, an error is thrown.
			// The resulting list of attribute strings is then filtered to remove any empty strings.
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

		// The attributesVar is a string that represents the variable for the attributes in TypeQL format.
		const attributesVar = `${bzId}-atts`;

		const isLocalId: boolean = node[Symbol.for('isLocalId') as any];

		// The idValueTQL is a string that represents the id value in TypeQL format.
		// If the idValue is an array, it is converted to a string using the join method with '|' as the separator.
		// Otherwise, the idValue is converted to a string.
		const idValueTQL = isArray(idValue) ? `like '${idValue.join('|')}'` : `'${idValue}'`;

		// The idAttributes is a list of strings that represent the id attributes in TypeQL format.
		// If the id is not a local id and the idValue exists, the idAttributes includes a string in the format `has ${idField} ${idValueTQL}`.
		// Otherwise, the idAttributes is an empty list.
		// Note: If the node is a relation, only the id fields are added in the lines where the roles are also added to avoid defining them twice.
		const idAttributes =
			!isLocalId && idValue 
				? [`has ${idField} ${idValueTQL}`]
				: [];

		// The allAttributes is a string that represents all the attributes (id and other attributes) in TypeQL format.
		// It is generated by joining the idAttributes and attributes with a comma and filtering out any empty strings.
		const allAttributes = [...idAttributes, ...attributes].filter((x) => x).join(',');

		// The getDeletionMatchInNodes function generates a string that represents the deletion match in TypeQL format.
		const getDeletionMatchInNodes = () => {
			if (k.startsWith('$') || k === idField) {
				return '';
			}
			const currentDataField = currentSchema.dataFields?.find((x) => x.path === k);
			const fieldDbPath = currentDataField?.path;

			if (!fieldDbPath) {
				return '';
			}
			const dbField = currentDataField.dbPath;

			return `{${attributesVar} isa ${dbField};}`;
		}).filter((x) => x);

		// The isLocalId is a boolean that indicates whether the node's id is a local id.
		// Local ids are only used to define links between stuff but are not in the database.
		const isLocalId: boolean = node[Symbol.for('isLocalId') as any];

		const idValueTQL = isArray(idValue) ? `like '${idValue.join('|')}'` : `'${idValue}'`;
		const idAttributes =
			!isLocalId && idValue // it must have id values, and they must be realDBIds
				? // if it is a relation, add only the id fields in the lines where we add the roles also so it does not get defined twice
				  [`has ${idField} ${idValueTQL}`]
				: [];

		const allAttributes = [...idAttributes, ...attributes].filter((x) => x).join(',');

		// The getDeletionMatchInNodes function generates a string that represents the deletion match in TypeQL format.
		// If the operation is 'delete', 'unlink', or 'match', the string is in the format `${bzId} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`.
		// If the operation is 'update' and there are matchAttributes, the string is in the format `${bzId} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')}, has ${attributesVar}; ${matchAttributes.join(' or ')};`.
		// Otherwise, an empty string is returned.
		// Note: The function assumes that parents belong to grandparents.
		const getDeletionMatchInNodes = () => {
			if (op === 'delete' || op === 'unlink' || op === 'match') {
				return `${bzId} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`;
			}
			if (op === 'update') {
				if (!matchAttributes.length) {
					throw new Error('update without attributes');
				}
				return `${bzId} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')}, has ${attributesVar}; ${matchAttributes.join(' or ')};`;
			}
			return '';
		// The getInsertionMatchInNodes function generates a string that represents the insertion match in TypeQL format.
		// If the operation is 'update', 'link', or 'match', the string is in the format `${bzId} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`.
		// Otherwise, an empty string is returned.
		// Note: The function assumes that parents belong to grandparents.
		const getInsertionMatchInNodes = () => {
			if (op === 'update' || op === 'link' || op === 'match') {
				return `${bzId} isa ${[thingDbPath, ...idAttributes].filter((x) => x).join(',')};`;
			}
			return '';
		};

		// If the node has an entity or relation, the function returns an object with the following properties:
		// op, deletionMatch, insertionMatch, insertion, and deletion.
		// The values of these properties are determined based on the operation type and whether there are attributes or matchAttributes.
		// If the node does not have an entity or relation, an error is thrown.
		if (node.$entity || node.$relation) {
			return {
				op,
				deletionMatch: getDeletionMatchInNodes(),
				insertionMatch: getInsertionMatchInNodes(),
				insertion:
					op === 'create'
						? `${bzId} isa ${[thingDbPath, allAttributes].filter((x) => x).join(',')};`
						: op === 'update' && attributes.length
						? `${bzId} ${attributes.join(',')};`
						: '',
				deletion:
					op === 'delete'
						? `${bzId} isa ${thingDbPath};`
						: op === 'update' && matchAttributes.length
						? `${bzId} has ${attributesVar};`
						: '',
			};
		}

		throw new Error('in attributes');
	};

	const edgeToTypeQL = (
		node: BQLMutationBlock,
	): {
		preDeletionBatch?: any[];
		deletionMatch?: string;
		insertionMatch?: string;
		deletion?: string;
		insertion?: string;
		op: string;
	} => {
		const op = node.$op as string;
		const currentSchema = getCurrentSchema(schema, node);
		const bzId = `$${node.$bzId}`;
		const idValue = node.$id;

		const relationDbPath = currentSchema.defaultDBConnector?.path || node.$relation;

		const roleFields = 'roles' in currentSchema ? listify(currentSchema.roles, (k) => k) : [];

		const roleDbPaths =
			node.$relation &&
			'roles' in currentSchema &&
			mapEntries(currentSchema.roles, (k, v) => [k, v.dbConnector?.path || k]);

		// roles can be specified in three ways, either they are a roleField in the node, they are the children of something, or they have a default/computed link
		// 1) roleFields

		const fromRoleFields = listify(node, (k: string, v) => {
			if (!roleFields.includes(k)) {
				return null;
			}
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
			: `${bzId} ${roles} ${
					node[Symbol.for('edgeType') as any] === 'linkField' || op === 'delete' || op === 'unlink'
						? `isa ${relationDbPath}`
						: ''
			  }`;

		const relationTqlWithoutRoles = `${bzId}  ${
			node[Symbol.for('edgeType') as any] === 'linkField' || op === 'delete' ? `isa ${relationDbPath}` : ''
		}`;

		const getInsertionsInEdges = () => {
			if (!relationTql) {
				return '';
			}
			if (op === 'link') {
				return `${relationTql};`;
			}
			if (op === 'create') {
				return `${relationTql}, has id '${idValue}';`;
			}
			return '';
		};

		const getInsertionMatchInEdges = () => {
			if (!relationTql) {
				return '';
			}
			// if (op === 'link') return `${relationTql};`;
			// if (op === 'create') return `${relationTqlWithoutRoles};`;
			if (op === 'match') {
				return `${relationTql};`;
			}
			return '';
		};

		const getDeletionMatchInEdges = () => {
			if (!relationTql) {
				return '';
			}
			/// edge delete: we are removing an automatic relation
			if (op === 'delete') {
				return `${relationTql};`;
			}
			/// edge unlink means: We are editing a real relation's roles
			if (op === 'unlink') {
				/*  return `${bzId} ($roles-${node.$bzId}: $players-${node.$bzId}) isa ${relationDbPath}; ${fromRoleFields
          .map((role) => `{$roles-${node.$bzId} type ${relationDbPath}:${role?.path};}`)
          .join(` or `)};`; */
				/// unlinking more than one role is not supported yet
				/// this got commented as the match brings what is needed but will probably need a refacto
				/// this is coded as generating a match block in [parseBQLmutation.ts], toEdges(edgeType1)
				// return `${bzId} ${roles} isa ${relationDbPath};`;
			}
			if (op === 'match') {
				return `${relationTql};`;
			}
			return '';
		};

		const getDeletionsInEdges = () => {
			if (!relationTql) {
				return '';
			}
			// todo: same as insertions, better manage the ids here
			if (op === 'delete') {
				return `${relationTqlWithoutRoles};`;
			}
			if (op === 'unlink') {
				return `${bzId} ${roles};`;
			}
			// if (op === 'unlink') return `${bzId} ($roles-${node.$bzId}: $players-${node.$bzId});`;
			return '';
		};

		/* const getPreDeletionBatch = () => {
      if (op === 'unlink') {
        return fromRoleFields
          .filter((y) => y)
          .map((x) => {
            return {
              match: `${bzId} (${x?.path}: $${x?.id}) isa ${relationDbPath};`,
              deletion: `${bzId} (${x?.path}: $${x?.id}) ${
                node[Symbol.for('edgeType') as any] === 'linkField' ? `isa ${relationDbPath}` : ''
              }`,
            };
          });
      }
      return [];
    }; */

		return {
			// preDeletionBatch: getPreDeletionBatch(),
			deletionMatch: getDeletionMatchInEdges(),
			insertionMatch: getInsertionMatchInEdges(),
			deletion: getDeletionsInEdges(),
			insertion: getInsertionsInEdges(),
			op: '',
		};
	};

	const toTypeQL = (
		nodes: BQLMutationBlock[] | BQLMutationBlock,
		mode?: 'nodes' | 'edges',
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
					return shake({ preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion }, (z) => !z); /// ! WARNING: falsy values are removed (0, "", etc)
				})
				.filter((y) => y);
		}
		const { preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion } = typeQL(nodes);

		return shake({ preDeletionBatch, insertionMatch, deletionMatch, insertion, deletion }, (z) => !z); /// ! WARNING: falsy values are removed (0, "", etc)
	};

	// const thingStreams = thingsWithOps.map((x) => toTypeQL([...x.thingDependencies, ...x.edgeDependencies]));
	// const edgeStreams = edgesWithOps.map((x) => toTypeQL([...x.thingDependencies, ...x.edgeDependencies], 'edges'));

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
		(x) => !x,
	);
	req.tqlRequest = tqlRequest;
};
