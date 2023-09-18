import { getNodeByPath, TraversalCallbackContext, traverse } from 'object-traversal';
import { isArray, isObject, mapEntries, pick, shake } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { oFilter, getCurrentFields, getCurrentSchema } from '../../helpers';
import type { BQLMutationBlock, FilledBQLMutationBlock } from '../../types';
import type { PipelineOperation } from '../pipeline';

export const parseBQLMutation: PipelineOperation = async (req) => {
  const { filledBqlRequest, schema } = req;

  const listNodes = (blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[]) => {
    // todo: make immutable

    const nodes: BQLMutationBlock[] = [];
    const edges: BQLMutationBlock[] = [];

    /*
    function getIdsByPath(path: string) {
      const ids = nodes.filter((node) => node[Symbol.for('path') as any] === path).map((node) => node.id);
      return ids.length === 1 ? ids[0] : ids;
    } */

    const toNodes = (node: BQLMutationBlock) => {
      // if (node.$op === 'create' && nodes.find((x) => x.$id === node.$id)) throw new Error(`Duplicate id ${node.$id}`);
      if (node.$op === 'create' && nodes.find((x) => x.$bzId === node.$bzId))
        throw new Error(`Duplicate id ${node.$id}`);

      if (node.$tempId && node.$op === 'match') return; /// we don't add to the node list, those that are being matched as they don't need to be matched in db and if they have a $tempId then it means... they are being created in the same query!
      nodes.push(node);
    };

    const toEdges = (edge: BQLMutationBlock) => {
      if (edge.$op === 'create' && edges.find((x) => x.$bzId === edge.$bzId))
        throw new Error(`Duplicate id ${edge.$id}`);
      edges.push(edge);
    };

    const listOp = ({ value: val }: TraversalCallbackContext) => {
      if (!isObject(val)) return;
      const value = val as BQLMutationBlock;

      /// no idea why this is needed lol, but sometimes is indeed undefined 🤷‍♀️
      if (value.$entity || value.$relation) {
        if (!value.$op) throw new Error(`Operation should be defined at this step ${JSON.stringify(value)}`);

        if (!value.$bzId) {
          throw new Error('[internal error] BzId not found');
        }
        /// this is used to group the right delete/unlink operations with the involved things

        const currentThingSchema = getCurrentSchema(schema, value);
        const {
          dataFields: dataFieldPaths,
          roleFields: roleFieldPaths,
          linkFields: linkFieldPaths,
          usedFields,
        } = getCurrentFields(currentThingSchema, value);

        const getChildOp = () => {
          if (value.$op === 'create' || value.$op === 'delete') {
            return value.$op;
          }
          // if its un update because linkfields or rolefields updated, but no attributes, then it a match
          if (value.$op === 'update') {
            const usedDataFields = usedFields.filter((x: string) => dataFieldPaths?.includes(x));
            const usedRoleFields = usedFields.filter((x: string) => roleFieldPaths?.includes(x));
            const usedLinkFields = usedFields.filter((x: string) => linkFieldPaths?.includes(x));
            if (usedDataFields.length > 0) {
              return 'update';
            }
            if (usedRoleFields.length > 0 || usedLinkFields.length > 0) {
              return 'match';
            }
            throw new Error(`No fields on an $op:"update" for node ${JSON.stringify(value)}`);
          }

          return 'match';
        };

        const dataObj = {
          ...(value.$entity && { $entity: value.$entity }),
          ...(value.$relation && { $relation: value.$relation }),
          ...(value.$id && { $id: value.$id }),
          ...(value.$tempId && { $tempId: value.$tempId }),
          ...(value.$filter && { $filter: value.$filter }),
          ...shake(pick(value, dataFieldPaths || [''])),
          $op: getChildOp(),
          $bzId: value.$bzId,
          [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
          // [Symbol.for('dependencies')]: value[Symbol.for('dependencies')],
          [Symbol.for('path')]: value[Symbol.for('path') as any],

          [Symbol.for('parent')]: value[Symbol.for('parent') as any],
          [Symbol.for('isRoot')]: value[Symbol.for('isRoot') as any],
          [Symbol.for('isLocalId')]: value[Symbol.for('isLocalId') as any] || false,
        };

        /// split nodes with multiple ids // why? //no longer doing that
        toNodes(dataObj);

        // console.log('value', isDraft(value) ? current(value) : value);

        // CASE 1: HAVE A PARENT THROUGH LINKFIELDS
        if (
          value[Symbol.for('relation') as any] &&
          value[Symbol.for('edgeType') as any] === 'linkField'
          // value[Symbol.for('relation')] !== '$self'
        ) {
          if (value.$op === 'link' || value.$op === 'unlink') {
            if (value.$id || value.$filter) {
              if (value.$tempId) {
                throw new Error("can't specify a existing and a new element at once. Use an id/filter or a tempId");
              }
              nodes.push({ ...value, $op: 'match' });
            }
            // we add a "linkable" version of it so we can query it in the insertion
          }

          // this linkObj comes from nesting, which means it has no properties and no ID
          // relations explicitely created are not impacted by this, and they get the $id from it's actual current value

          const ownRelation = value[Symbol.for('relation') as any] === value.$relation;

          const linkTempId = ownRelation ? value.$bzId : uuidv4();

          const parentMeta = value[Symbol.for('parent') as any];
          const parentPath = parentMeta.path;
          const parentNode = !parentPath ? blocks : getNodeByPath(blocks, parentPath);
          const parentId = parentNode.$bzId;
          if (!parentId) throw new Error('No parent id found');

          if (value[Symbol.for('relation') as any] === '$self') return;

          const getLinkObjOp = () => {
            if (value.$op === 'delete') {
              if (ownRelation) return 'match';
              return 'delete';
            }
            if (value.$op === 'unlink') {
              if (ownRelation) return 'unlink'; // delete already present in the nodes array
              return 'delete';
            }
            if (value.$op === 'link' || value.$op === 'create') {
              if (ownRelation) return 'link'; // create already present in the nodes array
              return 'create';
            }
            // todo: probably check replaces
            if (value.$op === 'replace') {
              throw new Error('Unsupported: Replaces not implemented yet');
            }
            return 'match';
          };

          const edgeType1 = {
            $relation: value[Symbol.for('relation') as any],
            $bzId: linkTempId,
            ...(value.$tempId ? { $tempId: value.$tempId } : {}),
            $op: getLinkObjOp(),

            // roles
            ...(!ownRelation ? { [value[Symbol.for('role') as any]]: value.$bzId } : {}),
            [value[Symbol.for('oppositeRole') as any]]: parentId,

            [Symbol.for('dbId')]: schema.relations[value[Symbol.for('relation') as any]].defaultDBConnector.id,
            [Symbol.for('edgeType')]: 'linkField',
            [Symbol.for('info')]: 'normal linkField',
            [Symbol.for('path')]: value[Symbol.for('path') as any],
            [Symbol.for('parent')]: value[Symbol.for('parent') as any],
          };

          // const testVal = {};

          // todo: stuff 😂
          toEdges(edgeType1);

          /// when it has a parent through a linkfield, we need to add an additional node (its dependency), as well as a match
          /// no need for links, as links will have all the related things in the "link" object. While unlinks required dependencies as match and deletions as unlink (or dependencies would be also added)
          /// this is only for relations that are not $self, as other relations will be deleted and don't need a match
          if ((value.$op === 'unlink' || getLinkObjOp() === 'unlink') && ownRelation) {
            toEdges({
              $relation: value[Symbol.for('relation') as any],
              $bzId: linkTempId,
              $op: 'match',
              [value[Symbol.for('oppositeRole') as any]]: parentId,
              [Symbol.for('dbId')]: schema.relations[value[Symbol.for('relation') as any]].defaultDBConnector.id,
              [Symbol.for('edgeType')]: 'linkField',
              [Symbol.for('info')]: 'additional ownrelation unlink linkField',
              [Symbol.for('path')]: value[Symbol.for('path') as any],
              [Symbol.for('parent')]: value[Symbol.for('parent') as any],
            });
          }
        }

        // CASE 2: IS RELATION AND HAS THINGS IN THEIR ROLES
        if (value.$relation) {
          const rolesObjFiltered = oFilter(value, (k: string, _v) => roleFieldPaths.includes(k));

          /// we don't manage cardinality MANY for now, its managed differently if we are on a create/delete op or nested link/unlink op
          // todo: this is super weird, remove
          const rolesObjOnlyIds = mapEntries(rolesObjFiltered, (k, v) => {
            if (isArray(v)) return [k, v];
            // @ts-expect-error
            if (isObject(v)) return [k, v.$bzId];
            return [k, v];
          });

          // console.log('rolesObjOnlyIds', rolesObjOnlyIds);

          const objWithMetaDataOnly = oFilter(val, (k, _v) => {
            // @ts-expect-error
            return k.startsWith('$') || k.startsWith('Symbol');
          });

          if (Object.keys(rolesObjFiltered).filter((x) => !x.startsWith('$')).length > 0) {
            // #region 2.1) relations on creation/deletion
            if (value.$op === 'create' || value.$op === 'delete') {
              /// if the relation is being created, then all objects in the roles are actually add
              const getEdgeOp = () => {
                if (value.$op === 'create') return 'link';
                if (value.$op === 'delete') return 'match'; /// if i'm not wrong, no need to unlink becasue is the director relation and will disappear 🤔
                throw new Error('Unsupported parent of edge op');
              };

              /// group ids when cardinality MANY
              const rolesObjOnlyIdsGrouped = mapEntries(rolesObjOnlyIds, (k, v) => {
                if (Array.isArray(v)) {
                  /// Replace the array of objects with an array of ids
                  return [k, v.map((vNested: any) => vNested.$bzId || vNested)];
                }
                return [k, v.$bzId || v];
              });
              // console.log('rolesObjOnlyIdsGrouped', rolesObjOnlyIdsGrouped);

              // todo: validations
              /// 1) each ONE role has only ONE element // 2) no delete ops // 3) no arrayOps, because it's empty (or maybe yes and just consider it an add?) ...
              const edgeType2 = {
                ...objWithMetaDataOnly,
                $relation: value.$relation,
                $op: getEdgeOp(),
                ...rolesObjOnlyIdsGrouped, // override role fields by ids or tempIDs
                $bzId: value.$bzId,
                [Symbol.for('path')]: value[Symbol.for('path') as any],
                [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                [Symbol.for('info')]: 'coming from created or deleted relation',
                [Symbol.for('edgeType')]: 'roleField on C/D',
              };

              toEdges(edgeType2);
              return;
            }
            // #endregion
            // region 2.2 relations on nested stuff
            // todo: probably remove the match here
            if (value.$op === 'match' || (value.$op === 'update' && Object.keys(rolesObjFiltered).length > 0)) {
              let totalUnlinks = 0;

              Object.entries(rolesObjFiltered).forEach(([role, operations]) => {
                const operationsArray = isArray(operations) ? operations : [operations];

                operationsArray.forEach((operation) => {
                  const op = operation.$op === 'replace' ? 'link' : operation.$op;
                  /// validations
                  if (op === 'replace') throw new Error('Not supported yet: replace on roleFields');
                  if (op === 'unlink' && totalUnlinks > 0) {
                    totalUnlinks += 1; // ugly temp solution while multiple roles can't be replaced
                    throw new Error(
                      'Not supported yet: Cannot unlink more than one role at a time, please split into two mutations'
                    );
                  }

                  const edgeType3 = {
                    ...objWithMetaDataOnly,
                    $relation: value.$relation,
                    $op: op,
                    [role]: operation.$bzId,
                    $bzId: value.$bzId,
                    [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                    [Symbol.for('parent')]: value[Symbol.for('parent') as any],
                    [Symbol.for('path')]: value[Symbol.for('path') as any],
                    [Symbol.for('info')]: 'updating roleFields',
                    [Symbol.for('edgeType')]: 'roleField on L/U/R',
                  };

                  toEdges(edgeType3);
                  /// when unlinking stuff, it must be merged with other potential roles.
                  /// so we need to add it as both as match and 'unlink' so it gets merged with other unlinks
                  // todo maybe a way to transform unlinks already in its own matches later? maybe split match-unlink and match-link
                  if (op === 'unlink') {
                    toEdges({ ...edgeType3, $op: 'match' });
                  }
                });
              });
            }
            // #endregion
            // throw new Error('Unsupported direct relation operation');
          }
        }
      }
    };
    // console.log('[blocks]', JSON.stringify(blocks, null, 3));
    // console.log('[blocks]', blocks);

    traverse(blocks, listOp);

    return [nodes, edges];
  };

  if (!filledBqlRequest) throw new Error('Undefined filledBqlRequest');

  const [parsedThings, parsedEdges] = listNodes(filledBqlRequest);
  // console.log('parsedThings', parsedThings);
  // console.log('parsedEdges', parsedEdges);

  /// some cases where we extract things, they must be ignored.
  /// One of this cases is the situation where we have a thing that is linked somwhere and created, or updated.
  /// If it is only linked, we indeed need it with a "match" op, but if it is already there is no need to init it
  const mergedThings = parsedThings.reduce((acc, thing) => {
    // Skip if the current item doesn't have a $tempId
    if (!thing.$bzId) {
      return [...acc, thing];
    }

    // Check if this $tempId already exists in the accumulator
    const existingIndex = acc.findIndex((t) => t.$bzId === thing.$bzId);

    if (existingIndex === -1) {
      // If it doesn't exist, add it to the accumulator
      return [...acc, thing];
    }
    // If it exists, let's check the $op
    if (acc[existingIndex].$op === 'create' && thing.$op === 'match') {
      // If existing is 'create' and current is 'match', ignore current
      return acc;
    }
    if (acc[existingIndex].$op === 'match' && (thing.$op === 'create' || thing.$op === 'match')) {
      // If existing is 'match' and current is 'create' or 'match', replace existing with current
      return [...acc.slice(0, existingIndex), thing, ...acc.slice(existingIndex + 1)];
    }
    // For all other cases, throw an error
    throw new Error(`Unsupported operation combination for $tempId "${thing.$tempId}"`);
  }, [] as BQLMutationBlock[]);

  /// merge attributes of relations that share the same $id
  /// WHY => because sometimes we get the relation because of having a parent, and other times because it is specified in the relation's properties
  const mergedEdges = parsedEdges.reduce((acc, curr) => {
    const existingEdge = acc.find(
      (r) =>
        ((r.$id && r.$id === curr.$id) || (r.$bzId && r.$bzId === curr.$bzId)) &&
        r.$relation === curr.$relation &&
        r.$op === curr.$op
    );

    if (existingEdge) {
      const newRelation = { ...existingEdge };

      Object.keys(curr).forEach((key) => {
        if (typeof key === 'symbol' || key.startsWith('$')) {
          return;
        }

        const existingVal = existingEdge[key];
        const currVal = curr[key];

        if (Array.isArray(existingVal) && Array.isArray(currVal)) {
          newRelation[key] = Array.from(new Set([...existingVal, ...currVal]));
        } else if (!Array.isArray(existingVal) && Array.isArray(currVal)) {
          if (existingVal !== undefined) {
            // Avoid merging with undefined values.
            newRelation[key] = Array.from(new Set([existingVal, ...currVal]));
          } else {
            newRelation[key] = currVal;
          }
        } else if (Array.isArray(existingVal) && !Array.isArray(currVal)) {
          if (currVal !== undefined) {
            // Avoid merging with undefined values.
            newRelation[key] = Array.from(new Set([...existingVal, currVal]));
          }
        } else if (!existingVal) {
          newRelation[key] = currVal;
        }
      });

      const newAcc = acc.filter(
        (r) =>
          !(
            ((r.$id && r.$id === curr.$id) || (r.$bzId && r.$bzId === curr.$bzId)) &&
            r.$relation === curr.$relation &&
            r.$op === curr.$op
          )
      );

      return [...newAcc, newRelation];
    }

    return [...acc, curr];
  }, [] as BQLMutationBlock[]);

  // console.log('mergedThings', mergedThings);
  // console.log('mergedEdges', mergedEdges);

  /// VALIDATIONS
  /// in the same mutation, we can't link cardinality ONE stuff in multiple places
  /// case a: We have two different edges (from intermediary relations) doing links with the same entity

  const uniqueRelations = [...new Set(mergedEdges.map((x) => x.$relation))];
  // Let's define an object to hold the problematic edges
  // const problematicEdges = {};
  /*
    // Iterate over the unique relations
    uniqueRelations.forEach(relation => {
      // Get the schema for the current relation
      const schema = schema.relations[relation];
  
      // Define the 'dangerous' roles
      const dangerousRoles = Object.keys(schema.roles).filter(role => schema.roles[role].cardinality === 'ONE');
  
      // Now, we want to keep only the edges which include these dangerous roles
      const filteredEdges = mergedEdges.filter(edge => edge.$relation === relation && dangerousRoles.some(role => edge.hasOwnProperty(role)));
      console.log('filteredEdges', filteredEdges)
  
      // For each dangerous role, check if any violations of the cardinality rule occur
      dangerousRoles.forEach((role) => {
        let roleValues = {};
      
        // Iterate over the filtered edges
        filteredEdges.forEach(edge => {
          // Define the opposite role
          const oppositeRoles = Object.keys(edge).filter(key => key !== role && key !== '$relation' && key !== '$op' && key !== '$id');
      
          oppositeRoles.forEach(oppositeRole => {
            // Initialize the set of role values associated with the oppositeRole value, if necessary
            if (!roleValues[oppositeRole]) {
              roleValues[oppositeRole] = new Set();
            }
      
            // Add the role value to the set of role values associated with the oppositeRole value
            roleValues[oppositeRole].add(edge[role]);
      
            // If the role value set size is more than 1 and the opposite role is not a 'ONE' cardinality role, add it to problematicEdges
            
            if (roleValues[oppositeRole].size > 1 && schema.relations[relation].roles[oppositeRole].cardinality !== 'ONE') {
             
              if (!problematicEdges[relation]) {
               
                problematicEdges[relation] = {};
              }
           
              if (!problematicEdges[relation][role]) {
            
                problematicEdges[relation][role] = [];
              }
              throw new Error(`Illegal cardinality: The ${role} role in ${relation} is linked to multiple ${oppositeRole} roles.`);
            }
          });
        });
      });
    }
    ); */

  /// todo: issue 1: relations with >2 roles will not work
  /// todo: issue 2: replaces don't work as they are indeed repeated for cardinality ONE
  // eslint-disable-next-line unused-imports/no-unused-vars
  const checkCardinality = (): void => {
    // The problematic edges will be stored here
    const problematicEdges: Record<string, Set<string>> = {};

    uniqueRelations.forEach((relation) => {
      const cardinalityOneRoles = Object.keys(schema.relations[relation].roles).filter(
        (role) => schema.relations[relation].roles[role].cardinality === 'ONE'
      );

      console.log('cardinalityOneRoles', `${relation}: ${cardinalityOneRoles}`);

      // For each role with cardinality ONE
      cardinalityOneRoles.forEach((oneRole) => {
        // A map from ids of the opposite role to a set of ids of the 'oneRole'
        const idMapping: Record<string, Set<string>> = {};

        // Look through all the edges
        mergedEdges.forEach((edge) => {
          if (edge.$relation === relation && edge[oneRole]) {
            // Extract id from the 'oneRole'
            const oneId = edge[oneRole];

            // Get the ids from the other role
            const otherRole = Object.keys(edge).find(
              (role) => role !== '$relation' && role !== '$op' && role !== '$id' && role !== oneRole
            );
            // console.log('edge', edge, 'otherRole', otherRole);

            if (otherRole) {
              const otherId = edge[otherRole];

              // Map the 'otherId' to the 'oneId'
              if (!idMapping[otherId]) {
                idMapping[otherId] = new Set();
              }

              idMapping[otherId].add(oneId);
            }
          }
        });

        // Check if any 'otherId' is related to multiple 'oneIds'
        Object.entries(idMapping).forEach(([otherId, oneIds]) => {
          if (oneIds.size > 1) {
            throw new Error(
              `${relation} has illegal cardinality: The ${oneRole} role is linked to multiple ${Object.keys(
                idMapping[otherId]
              ).join(',')} roles.`
            );
          }
        });
      });
    });

    // If there are any problematic edges, throw an error
    if (Object.keys(problematicEdges).length > 0) {
      let errorMessage = '';
      Object.entries(problematicEdges).forEach(([otherId, errorSet]) => {
        errorMessage +=
          `"${otherId}" is connected to many entities. ` +
          `${Array.from(errorSet).join(' ')}` +
          `The relation's role is of cardinality ONE.\n`;
      });

      throw new Error(errorMessage);
    }
  };
  /// checkCardinality(); // todo: add mergedEdges and schema as params and import from other parseBQLMutationHelpers

  /// case b: We have repeated the same relation id in two places and we are asigning it one of the roles more than one item

  /// case c: Before merge, a role with cardinality ONE has an array => This one is already managed before, so n

  req.bqlRequest = {
    mutation: {
      things: mergedThings,
      edges: mergedEdges,
    },
  };
};
