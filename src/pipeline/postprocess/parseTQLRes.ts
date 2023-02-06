import { isArray, isString, listify, mapEntries } from 'radash';
import { ConceptMapGroup } from 'typedb-client';

import { BQLMutationBlock, EnrichedBormSchema } from '../../types';
import type { Entity, EntityName, ID, PipelineOperation } from '../pipeline';

const extractEntities = (
  conceptMapGroups: ConceptMapGroup[],
  schema: EnrichedBormSchema
): Entity[] => {
  // * Construct entities from the concept map group array. Each concept map group refers to a single BORM entity
  const bormEntities = conceptMapGroups.map((conceptMapGroup) => {
    // * Match the group as the main entity
    const conceptMaps = [...conceptMapGroup.conceptMaps];
    const typeDBEntity = conceptMapGroup.owner.asThing();
    const thingName = typeDBEntity.type.label.name;
    const currentSchema = schema.entities[thingName]
      ? schema.entities[thingName]
      : schema.relations[thingName];

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
      const nameParts = attribute.type.label.name.split('·');
      const attributeName = nameParts[nameParts.length - 1];
      return [attributeName, attribute.value];
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
  entityNames: string[]
): Map<EntityName, ID>[] => {
  const relations = conceptMapGroups.flatMap((conceptMapGroup) => {
    const relationsInGroup = conceptMapGroup.conceptMaps.map((conceptMap) => {
      const link = new Map();
      entityNames.forEach((entityName) => {
        const id = conceptMap
          .get(`${entityName}_id`)
          ?.asAttribute()
          .value.toString();

        if (id) link.set(entityName, id);
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
      const ownerId = conceptMap
        .get(`${ownerPath}_id`)
        ?.asAttribute()
        .value.toString();
      const roleId = conceptMap
        .get(`${rolePath}_id`)
        ?.asAttribute()
        .value.toString();
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
      throw new Error(
        'Nothing has changed in DB, probably one of the ids specified in the mutation does not exist'
      );
    }
    const { mutation } = bqlRequest;
    if (!mutation) {
      throw new Error('TQL mutation not executed');
    }
    // console.log('config.mutation', config.mutation);

    // todo: check if something weird happened
    const expected = [...mutation.things, ...mutation.edges];
    const result = expected
      .map((x) => {
        const currentNode = rawTqlRes.insertions?.[0].get(
          `${x.$tempId || x.$id}`
        );
        // console.log('current:', JSON.stringify(x));
        if (x.$op === 'create' || x.$op === 'update' || x.$op === 'link') {
          if (
            !currentNode?.asThing().iid
            // deletions are not confirmed in typeDB
          ) {
            throw new Error(
              `Thing not received on mutation: ${JSON.stringify(x)}`
            );
          }

          const dbIdd = currentNode?.asThing().iid;
          if (config.mutation?.noMetadata) {
            return mapEntries(x, (k: string, v) => [
              k.toString().startsWith('$') ? Symbol.for(k) : k,
              v,
            ]) as BQLMutationBlock;
          }
          return { $dbId: dbIdd, ...x } as BQLMutationBlock;
        }
        if (x.$op === 'delete' || x.$op === 'unlink') {
          // todo when typeDB confirms deletions, check them here
          return x as BQLMutationBlock;
        }
        if (x.$op === 'noop') {
          return undefined;
        }
        throw new Error(`Unsupported op ${x.$op}`);

        // console.log('config', config);
      })
      .filter((x) => x);

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

  // this are mid-relations, every Thing can have relations, even relations.
  const relations = rawTqlRes.relations?.map((relation) => {
    const currentRelSchema = schema.relations[relation.relation];

    const currentRelroles = listify(
      currentRelSchema.roles,
      // TODO: Multiple inverse roles
      (_k, v) => {
        if ([...new Set(v.playedBy?.map((x) => x.thing))].length !== 1) {
          throw new Error(
            'a role can be played by two entities throws the same relation'
          );
        }
        if (!v.playedBy) throw new Error('Role not being played by nobody');
        return v.playedBy[0].thing;
      }
    );
    const links = extractRelations(relation.conceptMapGroups, [
      ...currentRelroles,
      currentRelSchema.name, // for cases where the relation is the actual thing fetched
    ]);

    return {
      name: relation.relation,
      links,
    };
  });

  // console.log('relations', relations);

  // these are the roles that belong to a relation that has been queried directly
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

  relations?.forEach((relation) => {
    // console.log('relation', relation);

    const relationName = relation.name;
    const relationCache = cache.relations.get(relationName) || [];
    relationCache.push(...relation.links);
    cache.relations.set(relationName, relationCache);

    relation.links.forEach((link) => {
      [...link.entries()].forEach(([entityName, entityId]) => {
        const entityCache = cache.entities.get(entityName) || new Map();

        const getEntityThingType = () => {
          if (schema.entities[entityName]) return 'entity';
          if (schema.relations[entityName]) return 'relation';
          throw new Error('Entity or relation not found');
        };
        const entityThingType = getEntityThingType();

        const entity = {
          [entityThingType]: entityName,
          $id: entityId,
          ...entityCache.get(entityId),
        };
        entityCache.set(entityId, entity);
        cache.entities.set(entityName, entityCache);
      });
    });
  });

  roles?.forEach((role) => {
    const ownerSchema =
      schema.relations[role.name] || schema.entities[role.name];
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
