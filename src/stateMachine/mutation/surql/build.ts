import { isArray } from 'radash';
import { buildSuqlFilter, parseFilter } from '../../../adapters/surrealDB/filters/filters';
import { sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { parseValueSurrealDB } from '../../../adapters/surrealDB/parsing/values';
import { getCurrentFields, getSchemaByThing, oFilter } from '../../../helpers';
import type { EnrichedBormRelation, EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../../types';
import { Parent } from '../../../types/symbols';
import type { FlatBqlMutation } from '../bql/flatter';

export const buildSURQLMutation = async (flat: FlatBqlMutation, schema: EnrichedBormSchema) => {
  const buildThings = (block: EnrichedBQLMutationBlock) => {
    //console.log('currentThing:', block);
    const { $filter, $thing, $bzId, $op, $id, $tempId } = block;

    const currentSchema = getSchemaByThing(schema, $thing);
    const { usedDataFields } = getCurrentFields(currentSchema, block);
    const { idFields } = currentSchema;
    const idValue = $id || block[idFields[0]];

    const sanitizedThings = (isArray($thing) ? $thing : [$thing]).map(sanitizeNameSurrealDB);

    const meta = oFilter(block, (k: string) => k.startsWith('$'));
    const rest = oFilter(block, (k: string) => !k.startsWith('$'));
    const restString = JSON.stringify(rest);
    const metaString = Object.entries(meta)
      .map(([key, value]) => (key === '$tempId' ? `'$tempId': '_:${value}'` : `'${key}': '${value}'`)) //todo: At some point migrate tempIds so they only use _: when not explicit.
      .join(',');

    const parent = block[Parent as any]; //todo

    const dataFieldStrings = usedDataFields
      .filter((df) => !idFields.includes(df))
      .map((df) => {
        const dataFieldSchema = currentSchema.dataFields?.find((f) => f.path === df || f.dbPath === df);
        if (!dataFieldSchema) {
          throw new Error(`Data field schema not found for ${df}`);
        }
        const value = block[df];
        if (value === null) {
          return `${df} = NONE`;
        }
        return `${df} = ${parseValueSurrealDB(value, dataFieldSchema.contentType)}`;
      })
      .filter(Boolean);

    const VAR = `$⟨${$tempId || $bzId}⟩`;

    const COND = (() => {
      if (parent?.bzId) {
        return `array::flatten($⟨${parent.bzId}⟩.⟨${parent.edgeField}⟩ || []).filter(|$v| $v != NONE).len`;
      }
      if (idValue) {
        if (isArray(idValue)) {
          return sanitizedThings.flatMap((table: string) => idValue.map((id: string) => `${table}:⟨${id}⟩`)).join(', ');
        }
        return sanitizedThings.map((table: string) => `${table}:⟨${idValue}⟩`).join(', ');
      }
      return true; // no parent, no id value, then we can run the update or deletion safely
    })();

    const TARGET = (() => {
      //Non root
      if (parent?.bzId) {
        const parentRef = `array::flatten($⟨${parent.bzId}⟩.⟨${parent.edgeField}⟩ || []).filter(|$v| $v != NONE)`; //needed to fix an issue where deletions fail when finding none. If we want to thow an error on undefined this might be a good place

        if (idValue) {
          if (isArray(idValue)) {
            return `${parentRef}[? $this.id() IN [${idValue.map((id) => `'${id}'`).join(', ')}] ]`;
          }
          return `${parentRef}[? $this.id() IN ['${idValue}'] ]`;
        }
        return parentRef;
      }
      if (idValue) {
        if (isArray(idValue)) {
          return sanitizedThings.flatMap((table: string) => idValue.map((id: string) => `${table}:⟨${id}⟩`)).join(', ');
        }
        return sanitizedThings.map((table: string) => `${table}:⟨${idValue}⟩`).join(', ');
      }
      return sanitizedThings.join(', ');
    })();
    const WHERE = $filter ? `WHERE ${buildSuqlFilter(parseFilter($filter, $thing, schema))}` : '';
    const SET = dataFieldStrings.length > 0 ? `SET ${dataFieldStrings.join(', ')}` : '';

    const OUTPUT = `VALUE (CREATE ONLY Delta SET input = ${restString}, meta = {${metaString}, "$sid": $parent.id, "$id": record::id($parent.id)}, after = $after, before = $before RETURN VALUE $parent.id )`;
    const DELETE_OUTPUT = 'BEFORE';

    if (['link', 'unlink', 'replace'].includes($op)) {
      throw new Error("Edge ops don't belong to things");
    }
    if (block.$op === 'match') {
      if ($tempId) {
        return ''; //tempIds are already stored on their creation
      }
      return `LET ${VAR} = (SELECT VALUE id FROM ${TARGET} ${WHERE});`;
    }
    if (block.$op === 'create') {
      if (isArray(idValue)) {
        throw new Error('Cannot create multiple things at once');
      }
      const tableName = sanitizeNameSurrealDB($thing);
      return `LET ${VAR} = (CREATE ONLY ${tableName}:⟨${idValue}⟩ ${SET} RETURN ${OUTPUT});`;
    }
    if (block.$op === 'update') {
      return `LET ${VAR} = IF (${COND}) THEN (UPDATE ${TARGET} ${SET} ${WHERE} RETURN ${OUTPUT}) END;`;
    }
    if (block.$op === 'delete') {
      return `LET ${VAR} = IF (${COND}) THEN (DELETE ${TARGET} ${WHERE} RETURN ${DELETE_OUTPUT}) END;`;
    }

    throw new Error(`Unsupported operation ${block.$op}`);
  };

  const buildEdges = (block: EnrichedBQLMutationBlock) => {
    //console.log('currentEdge:', block);
    const { $thing, $bzId, $op, $tempId } = block;
    const currentSchema = getSchemaByThing(schema, $thing);
    const { usedRoleFields } = getCurrentFields(currentSchema, block);

    const VAR = `$⟨${$tempId || $bzId}⟩`;

    const roleFields =
      'roles' in currentSchema
        ? usedRoleFields.flatMap((rf) => {
            const roleFieldSchema = currentSchema.roles[rf];
            if (!roleFieldSchema) {
              throw new Error(`Role field schema not found for ${rf}`);
            }
            const { cardinality } = roleFieldSchema;
            const asArrayOfVars = isArray(block[rf])
              ? block[rf].map((node: string) => `$⟨${node}⟩`)
              : [`$⟨${block[rf]}⟩`];

            if (cardinality === 'ONE') {
              if (asArrayOfVars.length > 1) {
                //This is ok as long as only one is a match, but we can link to several in card ONE. This is practical if we don't know the $thing for instance, we can try multiple ones
                const arrayString = `array::filter(array::flatten([${asArrayOfVars}]), |$v| !!$v)`;
                switch ($op) {
                  case 'link':
                  case 'replace':
                    return `${rf} = ((array::len(${arrayString})==1) && ${arrayString}[0]) || ${arrayString}`; //todo: throw a custom error instead
                  case 'unlink':
                    return `${rf} = NONE`; //todo this is not necessarily correct if $id or $filter! Should be none only if the node has been found
                  default:
                    throw new Error(`Unsupported operation ${$op} for ONE cardinality`);
                }
              }
              switch ($op) {
                case 'link':
                case 'replace':
                  return `${rf} = ((type::is::array(${asArrayOfVars[0]}) && array::len(${asArrayOfVars[0]})==1) && ${asArrayOfVars[0]}[0]) || ${asArrayOfVars[0]}`;
                case 'unlink':
                  return `${rf} = NONE`; //todo this is not necessarily correct if $id or $filter! Should be none only if the node has been found
                default:
                  throw new Error(`Unsupported operation ${$op} for ONE cardinality`);
              }
            }
            if (cardinality === 'MANY') {
              const nodesString = `array::flatten([${asArrayOfVars}])`;
              switch ($op) {
                case 'link':
                  return `${rf} += ${nodesString}`;
                case 'unlink':
                  return `${rf} -= ${nodesString}`;
                case 'replace':
                  return `${rf} = ${nodesString}`;
                default:
                  throw new Error(`Unsupported operation ${$op} for MANY cardinality`);
              }
            }
            throw new Error(`Unsupported cardinality ${cardinality}`);
          })
        : [];

    const roleFieldsString = roleFields.length > 0 ? `${roleFields.join(', ')}` : '';
    const SET = roleFieldsString ? `SET ${roleFieldsString}` : '';

    return `IF ${VAR} THEN (UPDATE ${VAR} ${SET} RETURN VALUE id) END; ${VAR};`; //todo: confirm if the WHERE is actually needed here?
  };

  const buildArcs = (block: EnrichedBQLMutationBlock) => {
    const { $thing, $op } = block;
    const currentSchema = getSchemaByThing(schema, $thing) as EnrichedBormRelation;
    const tableName = sanitizeNameSurrealDB($thing);

    const { usedRoleFields } = getCurrentFields(currentSchema, block);

    if (!['create', 'delete'].includes($op)) {
      throw new Error('Arcs can only be created or deleted');
    }

    const [roleA, roleB] = usedRoleFields;
    const thingsA = (isArray(block[roleA]) ? block[roleA] : [block[roleA]]) as string[];
    const thingsB = (isArray(block[roleB]) ? block[roleB] : [block[roleB]]) as string[];

    if ($op === 'create') {
      if (usedRoleFields.length !== 2) {
        throw new Error('Not supported: Arcs must have exactly 2 roles');
      }
      const rest = oFilter(block, (k: string) => !k.startsWith('$'));
      const restString = JSON.stringify(rest);

      const OUTPUT = `(CREATE ONLY Delta SET input = ${restString}, meta = {"$sid": $parent.id, "$id": record::id($parent.id)}, after = $after, before = $before RETURN VALUE $parent.id )`;

      const roleOneSchema = currentSchema.roles[roleA];
      const isMany1 = roleOneSchema.cardinality === 'MANY';

      const roleTwoSchema = currentSchema.roles[roleB];
      const isMany2 = roleTwoSchema.cardinality === 'MANY';

      /*const thingsAString = thingsA.map((thingA) => `$⟨${thingA}⟩`).join(', ');
			const thingsAArrayString = `array::flatten([${thingsAString}])`;
			const thingsBString = thingsB.map((thingB) => `$⟨${thingB}⟩`).join(', ');
			const thingsBArrayString = `array::flatten([${thingsBString}])`;
*/
      /*
			//this is the third version, where we only create one arc per arc defined in the flatter function. Todo: Check cardinality and throw error if it is not correct instead of the || to trigger it internally
			const arc = `CREATE ONLY ${tableName} SET
					${roleA} = ${isMany1 ? thingsAArrayString : `array::len(${thingsAArrayString}) == 1  && array::first(${thingsAArrayString}) || ${thingsAArrayString}`},
					${roleB} = ${isMany2 ? thingsBArrayString : `array::len(${thingsBArrayString}) == 1  && array::first(${thingsBArrayString}) || ${thingsBArrayString}`}
			`;

			return arc; 
			*/

      ///before it was multiple arcs, running a loop over thingsA and thingsB in addition to the surrealDB loop inside the surql
      const arcs = [
        ///This ignored cardinality and created N*M arcs. I keep it here as it could be an option in the mutation config in the future.

        //
        //
        `
				${!isMany1 ? `IF array::len(array::filter(array::flatten([$⟨${thingsA}⟩]), |$v| !!$v))>1 { THROW "[Validation] Cardinality constraint: ${roleA} is cardinality one and can link a single thing." + <string>$⟨${thingsA}⟩; };` : ''}
				${!isMany2 ? `IF array::len(array::filter(array::flatten([$⟨${thingsB}⟩]), |$v| !!$v))>1 { THROW "[Validation] Cardinality constraint: ${roleB} is cardinality one and can link a single thing." + <string>$⟨${thingsB}⟩; };` : ''}
				FOR $node1 IN array::flatten([$⟨${thingsA}⟩]) { 
							IF $node1 {
								FOR $node2 IN array::flatten([$⟨${thingsB}⟩]) { 
									IF $node2 {
										CREATE ONLY ${tableName} SET 
											${roleA} = ${isMany1 ? 'array::flatten([$node1])' : '$node1'}, 
											${roleB} = ${isMany2 ? 'array::flatten([$node2])' : '$node2'} 
										RETURN ${OUTPUT}; 
									}
								}
							}
						}`,
      ];

      ///This is the throw error version that checks the cardinality, if it is ugly but it works, it ain't ugly
      //	`CREATE ONLY ${tableName} SET ${roleA} = ${isMany1 ? `fn::as_array($⟨${thingA}⟩)` : `array::len(fn::as_array($⟨${thingA}⟩)) == 1  && array::first(fn::as_array($⟨${thingA}⟩)) || $⟨${thingA}⟩`}, ${roleB} = ${isMany2 ? `fn::as_array($⟨${thingB}⟩)` : `array::len(fn::as_array($⟨${thingB}⟩)) == 1  && array::first(fn::as_array($⟨${thingB}⟩)) || $⟨${thingB}⟩`} RETURN ${OUTPUT};`,

      //console.log('arcs', arcs);
      return arcs;
    }

    if ($op === 'delete') {
      return `DELETE FROM ${tableName} WHERE fn::as_array(${roleA}) CONTAINSANY $⟨${thingsA}⟩ AND fn::as_array(${roleB}) CONTAINSANY $⟨${thingsB}⟩ RETURN BEFORE`;
    }
  };

  const buildReferences = (block: EnrichedBQLMutationBlock) => {
    const { $thing, $bzId, $op, $tempId } = block;
    const currentSchema = getSchemaByThing(schema, $thing);
    const { usedRefFields } = getCurrentFields(currentSchema, block);

    const VAR = `$⟨${$tempId || $bzId}⟩`;

    const refFields = usedRefFields.flatMap((rf) => {
      const refFieldSchema = currentSchema.refFields[rf];
      if (!refFieldSchema) {
        throw new Error(`ReferenceField schema not found for ${rf}`);
      }
      const { cardinality, contentType } = refFieldSchema;
      if (contentType === 'REF') {
        const asArrayOfVars = isArray(block[rf]) ? block[rf] : [`${block[rf]}`];

        if (cardinality === 'ONE') {
          if (asArrayOfVars.length > 1) {
            //This is ok as long as only one is a match, but we can link to several in card ONE. This is practical if we don't know the $thing for instance, we can try multiple ones
            const arrayString = `array::filter(array::flatten([${asArrayOfVars}]), |$v| !!$v)`;
            switch ($op) {
              case 'link':
              case 'replace':
                return `${rf} = ((array::len(${arrayString})==1) && ${arrayString}[0]) || ${arrayString}`; //todo: throw a custom error instead
              case 'unlink':
                return `${rf} = NONE`; //todo this is not necessarily correct if $id or $filter! Should be none only if the node has been found
              default:
                throw new Error(`Unsupported operation ${$op} for ONE cardinality`);
            }
          }
          switch ($op) {
            case 'link':
            case 'replace':
              return `${rf} = ((type::is::array(${asArrayOfVars[0]}) && array::len(${asArrayOfVars[0]})==1) && ${asArrayOfVars[0]}[0]) || ${asArrayOfVars[0]}`;
            case 'unlink':
              return `${rf} = NONE`; //todo this is not necessarily correct if $id or $filter! Should be none only if the node has been found
            default:
              throw new Error(`Unsupported operation ${$op} for ONE cardinality`);
          }
        }
        if (cardinality === 'MANY') {
          const nodesString = `array::flatten([${asArrayOfVars}])`;
          switch ($op) {
            case 'link':
              return `${rf} += ${nodesString}`;
            case 'unlink':
              return `${rf} -= ${nodesString}`;
            case 'replace':
              return `${rf} = ${nodesString}`;
            default:
              throw new Error(`Unsupported operation ${$op} for MANY cardinality`);
          }
        }
        throw new Error(`Unsupported cardinality ${cardinality}`);
      }
      if (contentType === 'FLEX') {
        //todo: card one check len 1
        //todo: add/remove etc
        return `${rf} = ${cardinality === 'ONE' ? `array::flatten([${block[rf]}])[0]` : `array::flatten([${block[rf]}])`}`;
      }
    });
    const refFieldsString = refFields.length > 0 ? `${refFields.join(', ')}` : '';
    const SET = refFieldsString ? `SET ${refFieldsString}` : '';

    return `IF ${VAR} THEN (UPDATE ${VAR} ${SET} RETURN VALUE id) END; ${VAR};`;
  };

  const result = [
    ...flat.things.map(buildThings),
    ...flat.edges.map(buildEdges),
    ...flat.arcs.flatMap(buildArcs),
    ...flat.references.map(buildReferences),
  ];
  //console.log('builtMutation', result);
  return result;
};
