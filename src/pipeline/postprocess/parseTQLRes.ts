import { isArray, isString, listify, mapEntries, unique, flat } from 'radash';
import { Concept, ConceptMapGroup } from 'typedb-client';

import { extractChildEntities, getPath } from '../../helpers';
import { BQLMutationBlock, EnrichedBormSchema, EnrichedBormRelation, BQLResponse } from '../../types';
import type { Entity, EntityName, ID, PipelineOperation, RelationName } from '../pipeline';

const extractEntities = (conceptMapGroups: ConceptMapGroup[], schema: EnrichedBormSchema): Entity[] => {
  // * Construct entities from the concept map group array. Each concept map group refers to a single BORM entity
  const bormEntities = conceptMapGroups.map((conceptMapGroup) => {
    // * Match the group as the main entity
    const conceptMaps = [...conceptMapGroup.conceptMaps];
    const typeDBEntity = conceptMapGroup.owner.asThing();
    const thingName = typeDBEntity.type.label.name;
    const currentSchema = schema.entities[thingName] ? schema.entities[thingName] : schema.relations[thingName];

    if (!currentSchema.idFields) {
      throw new Error(`No idFields defined for ${thingName}`);
    }
    const thingType = schema.entities[thingName] ? 'entity' : 'relation';
    // * Extract the attribute list from the concept map group
    const entityAttributes = conceptMaps.map((conceptMap) => {
      const attribute = conceptMap.get('attribute')?.asAttribute();
      if (!attribute) {
        return [];
      }
      return [getPath(attribute.type.label.name), attribute.value];
    });
    const entity = Object.fromEntries(entityAttributes);
    return {
      ...entity,
      [`$${thingType}`]: thingName,
      $id: entity[currentSchema.idFields[0]], // TODO : Handle composite keys
    };
  });
  return bormEntities;
};

const extractRelations = (
  conceptMapGroups: ConceptMapGroup[],
  relationNames: string[],
  schema: EnrichedBormSchema
  // Extract to type
): Map<RelationName, { id: ID; entityName: EntityName }>[] => {
  const relations = conceptMapGroups.flatMap((conceptMapGroup) => {
    const relationsInGroup = conceptMapGroup.conceptMaps.map((conceptMap) => {
      const link = new Map();
      relationNames.forEach((relationName) => {
        const id = conceptMap.get(`${relationName}_id`)?.asAttribute().value.toString();
        const concept = conceptMap.get(relationName) as Concept | undefined;
        // Because we changed the key to be the path, we need the entityName in the value

        const entityName = concept?.isEntity()
          ? concept.asEntity().type.label.name
          : concept?.asRelation().type.label.name;

        const getEntityName = () => {
          /// this function is an ugly workaround to get the entity name when the thing is playing a role by extending other thingType
          /// the query has a different format where the $var is not the role, but the entityName, but then the entityName of the object recovered does not match
          /// we will clean this once optionals are done, as we will be able to do queries in one single query
          /// meanwhile, we will have this weird workaround
          /// if the entityName has is extending any thing that matches the name of the relation name, then we need to return the relation name instead
          /// current errors : RelationName actually gets the name of the role sometimes (example: space-users, will have relationName: 'spaces' which is the path...)

          if (entityName) {
            const currentSchema = schema.entities[entityName] ?? schema.relations[entityName];

            /// this is the ugly workaround
            if (currentSchema.allExtends?.includes(relationName)) {
              return relationName;
            }

            return entityName;
          }
          return relationName;
        };
        const val = {
          id,
          entityName: getEntityName(),
        };
        if (id) link.set(relationName, val);
      });
      return link;
    });
    return relationsInGroup;
  });
  return relations;
};

const extractRoles = (
  conceptMapGroups: ConceptMapGroup[],
  ownerPath: string,
  rolePath: string
): { ownerId: string; path: string; roleId: string }[] => {
  const roles = conceptMapGroups.flatMap((conceptMapGroup) => {
    const rolesInGroup = conceptMapGroup.conceptMaps.map((conceptMap) => {
      const ownerId = conceptMap.get(`${ownerPath}_id`)?.asAttribute().value.toString();
      const roleId = conceptMap.get(`${rolePath}_id`)?.asAttribute().value.toString();
      return {
        ownerId,
        path: rolePath,
        roleId,
      };
    });
    return rolesInGroup;
  });
  return roles;
};

const extractRelRoles = (currentRelSchema: EnrichedBormRelation, schema: EnrichedBormSchema) => {
  const currentRelroles = listify(
    currentRelSchema.roles,
    // TODO: Multiple inverse roles
    (_k, v) => {
      if ([...new Set(v.playedBy?.map((x) => x.thing))].length !== 1) {
        throw new Error('a role can be played by two entities throws the same relation');
      }
      if (!v.playedBy) throw new Error('Role not being played by nobody');
      // We extract the role that it plays

      const playedBy = v.playedBy[0].plays;
      // TODO: should recursively get child of childs

      const childEntities = extractChildEntities(schema.entities, playedBy);

      return [playedBy, ...childEntities];
    }
  );

  return unique(flat(currentRelroles));
};

export const parseTQLRes: PipelineOperation = async (req, res) => {
  const { schema, bqlRequest, config, tqlRequest } = req;
  const { rawTqlRes } = res;
  if (!bqlRequest) {
    throw new Error('BQL request not parsed');
  } else if (!rawTqlRes) {
    throw new Error('TQL query not executed');
  }
  const { query } = bqlRequest;

  // <--------------- MUTATIONS
  if (!query) {
    if (rawTqlRes.insertions?.length === 0 && !tqlRequest?.deletions) {
      // if no insertions and no delete operations
      res.bqlRes = {} as BQLResponse; // return an empty object to continue further steps without error
      return;
    }
    const { mutation } = bqlRequest;
    if (!mutation) {
      throw new Error('TQL mutation not executed');
    }
    // console.log('config.mutation', config.mutation);

    // todo: check if something weird happened
    const expected = [...mutation.things, ...mutation.edges];
    // console.log('expected', expected);
    const result = expected
      .map((exp) => {
        //! reads all the insertions and gets the first match. This means each id must be unique
        const currentNode = rawTqlRes.insertions?.find((y) => y.get(`${exp.$bzId}`))?.get(`${exp.$bzId}`);
        // console.log('rawTqlRes.insertions', rawTqlRes.insertions);
        // console.log('currentNode', currentNode);

        // console.log('current:', JSON.stringify(x));
        if (exp.$op === 'create' || exp.$op === 'update' || exp.$op === 'link') {
          if (
            !currentNode?.asThing().iid
            // deletions are not confirmed in typeDB
          ) {
            throw new Error(`Thing not received on mutation: ${JSON.stringify(exp)}`);
          }

          const dbIdd = currentNode?.asThing().iid;
          if (config.mutation?.noMetadata) {
            return mapEntries(exp, (k: string, v) => [
              k.toString().startsWith('$') ? Symbol.for(k) : k,
              v,
            ]) as BQLMutationBlock;
          }
          return { $dbId: dbIdd, ...exp } as BQLMutationBlock;
        }
        if (exp.$op === 'delete' || exp.$op === 'unlink') {
          // todo when typeDB confirms deletions, check them here
          return exp as BQLMutationBlock;
        }
        if (exp.$op === 'match') {
          return undefined;
        }
        throw new Error(`Unsupported op ${exp.$op}`);

        // console.log('config', config);
      })
      .filter((z) => z);

    // todo
    // @ts-expect-error
    res.bqlRes = result.length > 1 ? result : result[0];
    return;
  }

  // <--------------- QUERIES
  if (!rawTqlRes.entity) {
    throw new Error('TQL query not executed');
  }
  // console.log('rawTqlRes', rawTqlRes);
  // entities and relations queried directly
  const entities = extractEntities(rawTqlRes.entity, schema);

  /// these are mid-relations, every Thing can have relations, even relations.
  const relations = rawTqlRes.relations?.map((relation) => {
    const currentRelSchema = schema.relations[relation.relation];

    const currentRelroles = extractRelRoles(currentRelSchema, schema);
    // for every currentRelSchema property, we get the paths that play that relation

    /* workaround that might be needed later 
    const currentRelPlayers = listify(currentRelSchema.roles, (_k, v) => {
      if (!v.playedBy) throw new Error('Role not being played by anybody');
      const paths = v.playedBy.flatMap((x) => x.path);
      return paths;
    }).flat(1);

    // remove duplicates between roles and players
    const allPlayers = new Set([...currentRelroles, ...currentRelPlayers]);
    */
    const links = extractRelations(
      relation.conceptMapGroups,
      [
        ...currentRelroles,
        currentRelSchema.name, // for cases where the relation is the actual thing fetched
      ],
      schema
    );

    return {
      name: relation.relation,
      links,
    };
  });

  // console.log('relations', relations);

  /// these are the roles that belong to a relation that has been queried directly
  const roles = rawTqlRes.roles?.map((role) => {
    return {
      name: role.ownerPath,
      links: extractRoles(role.conceptMapGroups, role.ownerPath, role.path),
    };
  });

  // console.log(roles);

  // cache.relations.get('relationName')

  const cache = res.cache || {
    entities: new Map(),
    relations: new Map(),
    roleLinks: new Map(),
  };
  entities.forEach((entity) => {
    const entityName = entity.$entity || entity.$relation;
    const entityId = entity.$id;
    const entityCache = cache.entities.get(entityName) || new Map();
    // todo: instead of show, an array of parent ids, that gets ids added when needed and only those ids show this entity as children
    entityCache.set(entityId, { ...entity, $show: true });
    cache.entities.set(entityName, entityCache);
  });

  /// RELATIONS: extract from relations
  relations?.forEach((relation) => {
    // console.log('relation', relation);

    const relationName = relation.name;
    const relationCache = cache.relations.get(relationName) || [];
    relationCache.push(...relation.links);
    cache.relations.set(relationName, relationCache);

    relation.links.forEach((link) => {
      [...link.entries()].forEach(([_, { entityName, id }]) => {
        const entityCache = cache.entities.get(entityName) || new Map();

        // todo: This means entities and relations must not share names!
        const entityThingType = schema.entities[entityName]?.thingType || schema.relations[entityName].thingType;

        const entity = {
          [entityThingType]: entityName,
          $id: id,
          ...entityCache.get(id),
        };
        entityCache.set(id, entity);
        cache.entities.set(entityName, entityCache);
      });
    });
  });

  /// ROLES: extract from roles
  roles?.forEach((role) => {
    const ownerSchema = schema.relations[role.name] || schema.entities[role.name];
    role.links.forEach((link) => {
      // Role caching - role step
      const cachedLinks = cache.roleLinks.get(link.ownerId) || {};
      let cachedLinkID = cachedLinks[link.path];
      if (cachedLinkID) {
        if (isArray(cachedLinkID)) {
          cachedLinkID.push(link.roleId);
        } else if (isString(cachedLinkID) && cachedLinkID !== link.roleId) {
          cachedLinkID = [cachedLinkID, link.roleId];
        }
      } else {
        cachedLinkID = link.roleId;
      }
      cachedLinks[link.path] = cachedLinkID;
      cache.roleLinks.set(link.ownerId, cachedLinks);
      ownerSchema.roles[link.path].playedBy?.forEach((roleSchema) => {
        // Role caching - entity step
        const entityCache = cache.entities.get(roleSchema.thing) || new Map();
        const entity = {
          $entity: roleSchema.thing,
          $id: link.roleId,
          ...entityCache.get(link.roleId),
        };
        entityCache.set(link.roleId, entity);
        cache.entities.set(roleSchema.thing, entityCache);
      });
    });
  });

  // console.log(cache.roleLinks);

  res.cache = cache;
  // console.log('entities', cache.entities);
  // console.log('rels', cache.relations);
};
