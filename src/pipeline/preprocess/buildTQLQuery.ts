import { listify } from 'radash';

import { getLocalFilters } from '../../helpers';
import type { PipelineOperation } from '../pipeline';

export const buildTQLQuery: PipelineOperation = async (req) => {
  const { schema, bqlRequest } = req;
  if (!bqlRequest?.query) {
    throw new Error('BQL query not parsed');
  }
  const { query } = bqlRequest;
  const currentThingSchema = '$entity' in query ? query.$entity : query.$relation;

  const thingPath = currentThingSchema.defaultDBConnector.path || currentThingSchema.name;

  // todo: composite Ids
  if (!currentThingSchema.idFields) {
    throw new Error('No id fields');
  }
  const [idField] = currentThingSchema.idFields;
  const idParam = `$${thingPath}_id`;
  let idFilter = `, has ${idField} ${idParam};`;
  if (query.$id) {
    if (Array.isArray(query.$id)) {
      idFilter += ` ${idParam} like "${query.$id.join('|')}";`;
    } else {
      idFilter += ` ${idParam} "${query.$id}";`;
    }
  }

  const localFiltersTql = getLocalFilters(currentThingSchema, query);

  const allRoles =
    'roles' in currentThingSchema
      ? listify(currentThingSchema.roles, (k: string, v) => ({
          path: k,
          var: `$${k}`,
          schema: v,
        }))
      : [];

  // when typeQL stops combination: const queryStr = `match $${thingPath} ${rolesQuery} isa ${thingPath}, has attribute $attribute ${localFiltersTql} ${idFilter} group $${thingPath};`;
  const queryStr = `match $${thingPath}  isa ${thingPath}, has attribute $attribute ${localFiltersTql} ${idFilter} group $${thingPath};`;

  const rolesObj = allRoles.map((role) => {
    // todo role played by multiple linkfields
    // if all roles are played by the same thing, thats fine
    if (!role.schema.playedBy || [...new Set(role.schema.playedBy?.map((x) => x.thing))].length !== 1) {
      throw new Error('Unsupported: Role played by multiple linkfields or none');
    }
    const roleThingName = role.schema.playedBy[0].thing;
    return {
      path: role.path,
      owner: thingPath,
      request: `match $${thingPath} (${role.path}: ${role.var} ) isa ${thingPath} ${idFilter} ${role.var} isa ${roleThingName}, has id ${role.var}_id; group $${thingPath};`,
    };
  });
  const relations = currentThingSchema.linkFields?.flatMap((linkField) => {
    const relationIdParam = `$${linkField.plays}_id`;
    let relationIdFilter = `, has ${idField} ${relationIdParam};`;
    if (query.$id) {
      if (Array.isArray(query.$id)) {
        relationIdFilter += ` ${relationIdParam} like "${query.$id.join('|')}";`;
      } else {
        relationIdFilter += ` ${relationIdParam} "${query.$id}";`;
      }
    }
    const entityMatch = `match $${linkField.plays} isa ${thingPath}${localFiltersTql} ${relationIdFilter}`;
    // if the target is the relation
    const dirRel = linkField.target === 'relation'; // direct relation
    const tarRel = linkField.relation;
    const relVar = `$${tarRel}`;

    const relationMatchStart = `${dirRel ? relVar : ''} (${linkField.plays}: $${linkField.plays}`;
    const relationMatchOpposite = linkField.oppositeLinkFieldsPlayedBy.map((link) =>
      !dirRel ? `${link.plays}: $${link.plays}` : null
    );

    const roles = [relationMatchStart, ...relationMatchOpposite].filter((x) => x).join(',');

    const relationPath = schema.relations[linkField.relation].defaultDBConnector.path || linkField.relation;

    const relationMatchEnd = `) isa ${relationPath};`;

    const relationIdFilters = linkField.oppositeLinkFieldsPlayedBy
      .map(
        // TODO: composite ids.
        // TODO: Also id is not always called id
        (link) =>
          `$${dirRel ? link.thing : link.plays} isa ${link.thing}, has id $${dirRel ? link.thing : link.plays}_id;`
      )
      .join(', ');

    const group = `group $${linkField.plays};`;
    const request = `${entityMatch} ${roles} ${relationMatchEnd} ${relationIdFilters} ${group}`;
    return { relation: relationPath, entity: thingPath, request };
  });

  req.tqlRequest = {
    entity: queryStr,
    ...(rolesObj?.length ? { roles: rolesObj } : {}),
    ...(relations?.length ? { relations } : {}),
  };
  // console.log(' req.tqlRequest', req.tqlRequest);
};
