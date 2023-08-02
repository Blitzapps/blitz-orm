import { getNodeByPath, TraversalCallbackContext, traverse } from 'object-traversal';
import { mapEntries, pick, shake } from 'radash';
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

    const toNodes = (node: BQLMutationBlock) => {
      if (node.$op === 'create' && nodes.find((x) => x.$id === node.$id)) throw new Error(`Duplicate id ${node.$id}`);
      nodes.push(node);
    };

    const toEdges = (edge: BQLMutationBlock) => {
      if (edge.$op === 'create' && edges.find((x) => x.$id === edge.$id)) throw new Error(`Duplicate id ${edge.$id}`);
      edges.push(edge);
    };

    const listOp = ({ value }: TraversalCallbackContext) => {
      if (value.$entity || value.$relation) {
        if (!value.$id && !value.$tempId && !['link', 'unlink'].includes(value.$op)) {
          throw new Error(
            'An id must be specified either in the mutation or has tu have a default value in the schema'
          );
        }
        /// this is used to group the right delete/unlink operations with the involved things

        const currentThingSchema = getCurrentSchema(schema, value);
        const {
          dataFields: dataFieldPaths,
          roleFields: roleFieldPaths,
          linkFields: linkFieldPaths,
          // @ts-expect-error
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
          [Symbol.for('bzId')]: value[Symbol.for('bzId')],
          [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
          // [Symbol.for('dependencies')]: value[Symbol.for('dependencies')],
          [Symbol.for('path')]: value[Symbol.for('path')],
          [Symbol.for('parent')]: value[Symbol.for('parent')],
          [Symbol.for('isRoot')]: value[Symbol.for('isRoot')],
        };

        /// split nodes with multiple ids
        // ? maybe as todo, to enhance the reasoner parsedBQL to consider multiple ids there, and use "like a|b|c" instead of repeating a lot of ids
        if (Array.isArray(dataObj.$id)) {
          dataObj.$id.forEach((id: string) => {
            toNodes({ ...dataObj, $id: id });
          });
        } else {
          toNodes(dataObj);
        }

        // console.log('value', isDraft(value) ? current(value) : value);

        // CASE 1: HAVE A PARENT THROUGH LINKFIELDS
        if (
          value[Symbol.for('relation')] &&
          value[Symbol.for('edgeType')] === 'linkField'
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

          const ownRelation = value[Symbol.for('relation')] === value.$relation;

          if (ownRelation && !(value.$id || value.$tempId)) {
            throw new Error('No id or tempId found for complex link');
          }

          const linkTempId = ownRelation ? value.$id || value.$tempId : uuidv4();

          const parentMeta = value[Symbol.for('parent')];
          const parentPath = parentMeta.path;
          const parentNode = !parentPath ? blocks : getNodeByPath(blocks, parentPath);
          const parentId = parentNode.$tempId || parentNode.$id; /// tempId first
          if (!parentId) throw new Error('No parent id found');
          if (value[Symbol.for('relation')] === '$self') return;

          const getLinkObjOp = () => {
            if (value.$op === 'unlink' || value.$op === 'delete') {
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
            $relation: value[Symbol.for('relation')],
            $op: getLinkObjOp(),
            ...(value.$op === 'unlink' ? { $tempId: linkTempId } : { $id: linkTempId }), // assigning in the parse a temp Id for every linkObj
            ...(ownRelation && value.$op === 'link' && value.$tempId ? { $tempId: value.$tempId } : {}),
            // ...(value.$op === 'create' && value.$tempId ? { $tempId: value.$tempId } : {}), /// maybe direct Relation things it makes sense, but for intermediary nope because they get the tempId from one of the entities related
            ...(ownRelation ? {} : { [value[Symbol.for('role')]]: value.$tempId || value.$id }),
            [value[Symbol.for('oppositeRole')]]: parentId,
            [Symbol.for('bzId')]: uuidv4(),
            // [Symbol.for('dependencies')]: [parentNode[Symbol.for('path')], ...parentNode[Symbol.for('dependencies')]],
            // [Symbol.for('isRoot')]: false,
            [Symbol.for('dbId')]: schema.relations[value[Symbol.for('relation')]].defaultDBConnector.id,
            [Symbol.for('edgeType')]: 'linkField',
            [Symbol.for('path')]: value[Symbol.for('path')],
            [Symbol.for('parent')]: value[Symbol.for('parent')],
          };
          // todo: stuff 😂
          toEdges(edgeType1);

          /// when it has a parent through a linkfield, we need to add an additional node (its dependency), as well as a match
          /// no need for links, as links will have all the related things in the "link" object. While unlinks required dependencies as match and deletions as unlink (or dependencies would be also added)
          /// this is only for relations that are not $self, as other relations will be deleted and don't need a match
          if ((value.$op === 'unlink' || getLinkObjOp() === 'unlink') && ownRelation) {
            toEdges({
              $relation: value[Symbol.for('relation')],
              $op: 'match',
              ...(value.$op === 'unlink' ? { $tempId: linkTempId } : { $id: linkTempId }), // assigning in the parse a temp Id for every linkObj
              [value[Symbol.for('oppositeRole')]]: parentId,
              [Symbol.for('bzId')]: uuidv4(),
              [Symbol.for('dbId')]: schema.relations[value[Symbol.for('relation')]].defaultDBConnector.id,
              [Symbol.for('edgeType')]: 'linkField',
              [Symbol.for('path')]: value[Symbol.for('path')],
              [Symbol.for('parent')]: value[Symbol.for('parent')],
            });
          }
        }

        // CASE 2: IS RELATION AND HAS THINGS IN THEIR ROLES
        if (value.$relation) {
          const val = value as BQLMutationBlock;

          // @ts-expect-error
          const rolesObjFiltered = oFilter(val, (k, _v) => roleFieldPaths.includes(k)) as BQLMutationBlock;

          // console.log('rolesObjFiltered', rolesObjFiltered);

          /// we don't manage cardinality MANY for now, its managed differently if we are on a create/delete op or nested link/unlink op
          const rolesObjOnlyIds = mapEntries(rolesObjFiltered, (k, v) => {
            return [k, v];
          });

          // console.log('rolesObjOnlyIds', rolesObjOnlyIds);
          const objWithMetaDataOnly = oFilter(val, (k, _v) => {
            // @ts-expect-error
            return k.startsWith('$') || k.startsWith('Symbol');
          });

          if (Object.keys(rolesObjFiltered).filter((x) => !x.startsWith('$')).length > 0) {
            // #region 2.1) relations on creation/deletion
            if (val.$op === 'create' || val.$op === 'delete') {
              /// if the relation is being created, then all objects in the roles are actually add
              const getEdgeOp = () => {
                if (val.$op === 'create') return 'link';
                if (val.$op === 'delete') return 'unlink';
                throw new Error('Unsupported parent of edge op');
              };

              /// group ids when cardinality MANY
              const rolesObjOnlyIdsGrouped = mapEntries(rolesObjOnlyIds, (k, v) => {
                if (Array.isArray(v)) {
                  /// Replace the array of objects with an array of ids
                  return [k, v.map((vNested: any) => vNested.$tempId || vNested.$id || vNested)];
                }
                return [k, v.$id || v];
              });

              // todo: validations
              /// 1) each ONE role has only ONE element // 2) no delete ops // 3) no arrayOps, because it's empty (or maybe yes and just consider it an add?) ...
              const edgeType2 = {
                ...objWithMetaDataOnly,
                $relation: val.$relation,
                $op: getEdgeOp(),
                ...rolesObjOnlyIdsGrouped, // override role fields by ids or tempIDs
                [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                [Symbol.for('path')]: value[Symbol.for('path')],
                [Symbol.for('info')]: 'coming from created or deleted relation',
                [Symbol.for('edgeType')]: 'roleField on C/D',
              };
              toEdges(edgeType2);
              return;
            }
            // #endregion
            // region 2.2 relations on nested stuff
            // todo: probably remove the match here
            if (val.$op === 'match' || (val.$op === 'update' && Object.keys(rolesObjFiltered).length > 0)) {
              const rolesWithLinks = oFilter(rolesObjOnlyIds, (_k, v) => {
                const currentRoleObj = Array.isArray(v) ? v : [v];
                return currentRoleObj.some(
                  (
                    x: BQLMutationBlock // string arrays are always replaces
                  ) => x.$op === 'link' || x.$op === 'create'
                );
              });
              const rolesWithLinksIds = mapEntries(rolesWithLinks, (k, v: BQLMutationBlock[]) => {
                const currentRoleObj = Array.isArray(v) ? v : [v];
                return [
                  k,
                  currentRoleObj
                    .filter((x) => x.$op === 'link' || x.$op === 'create')
                    .flatMap((y) => y.$id || y.$tempId),
                ];
              });
              const rolesWithUnlinks = oFilter(rolesObjOnlyIds, (_k, v) => {
                const currentRoleObj = Array.isArray(v) ? v : [v]; /// cardinality is tested in previous steps
                return currentRoleObj.some((x: BQLMutationBlock) => x.$op === 'unlink' || x.$op === 'delete');
              });
              // filters the array of objects, taking only those where x.$op === 'unlink'
              const rolesWithUnlinksIds = mapEntries(rolesWithUnlinks, (k, v: BQLMutationBlock[]) => {
                const currentRoleObj = Array.isArray(v) ? v : [v];
                return [
                  k,
                  currentRoleObj
                    .filter((x) => x.$op === 'unlink' || x.$op === 'delete')
                    .flatMap((y) => y.$id || y.$tempId),
                ];
              });
              const rolesWithReplaces = {};
              [
                { op: 'link', obj: rolesWithLinksIds },
                { op: 'unlink', obj: rolesWithUnlinksIds },
                { op: 'replace', obj: rolesWithReplaces }, // todo
              ].forEach((x) => {
                if (Object.keys(x.obj).length) {
                  if (x.op === 'unlink' && Object.keys(x.obj).length > 1)
                    throw new Error(
                      'Not supported yet: Cannot unlink more than one role at a time, please split into two mutations'
                    );

                  const edgeType3 = {
                    ...objWithMetaDataOnly,
                    $relation: val.$relation,
                    $op: x.op,
                    ...x.obj, // override role fields by ids or tempIDs
                    // [Symbol.for('context')]: context,
                    [Symbol.for('dbId')]: currentThingSchema.defaultDBConnector.id,
                    [Symbol.for('parent')]: value[Symbol.for('parent')],
                    [Symbol.for('path')]: value[Symbol.for('path')],
                    [Symbol.for('info')]: 'updating roleFields',
                    [Symbol.for('edgeType')]: 'roleField on L/U/R',
                  };
                  toEdges(edgeType3);

                  /// when unlinking stuff, it must be merged with other potential roles.
                  /// we need to add it as 'unlink' instead of match so it gets merged with other unlinks
                  if (edgeType3.$op === 'unlink') {
                    toEdges({ ...edgeType3, $op: 'match' });
                  }
                }
              });
              // return;
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
    if (!thing.$tempId) {
      return [...acc, thing];
    }

    // Check if this $tempId already exists in the accumulator
    const existingIndex = acc.findIndex((t) => t.$tempId === thing.$tempId);

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
        ((r.$id && r.$id === curr.$id) || (r.$tempId && r.$tempId === curr.$tempId)) &&
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
            ((r.$id && r.$id === curr.$id) || (r.$tempId && r.$tempId === curr.$tempId)) &&
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

  const checkCardinality = (): void => {
    // The problematic edges will be stored here
    const problematicEdges: Record<string, Set<string>> = {};

    uniqueRelations.forEach((relation) => {
      const cardinalityOneRoles = Object.keys(schema.relations[relation].roles).filter(
        (role) => schema.relations[relation].roles[role].cardinality === 'ONE'
      );

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
            problematicEdges[otherId] = problematicEdges[otherId] || new Set();

            problematicEdges[otherId].add(
              `Entity with ID: ${otherId} in relation "${relation}" linked to multiple ${oneIds.size} entities in role "${oneRole}".`
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
          `Account "${otherId}" is connected to many entities. ` +
          `${Array.from(errorSet).join(' ')}` +
          `The relation's role is of cardinality ONE.\n`;
      });

      throw new Error(errorMessage);
    }
  };

  checkCardinality(); // todo: add mergedEdges and schema as params and import from other parseBQLMutationHelpers

  /// case b: We have repeated the same relation id in two places and we are asigning it one of the roles more than one item

  /// case c: Before merge, a role with cardinality ONE has an array => This one is already managed before, so n

  req.bqlRequest = {
    mutation: {
      things: mergedThings,
      edges: mergedEdges,
    },
  };
};
