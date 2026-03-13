import { isArray } from 'radash';
import { buildSuqlFilter, parseFilter } from '../../../adapters/surrealDB/filters/filters';
import { computedFieldNameSurrealDB, sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { parseValueSurrealDB } from '../../../adapters/surrealDB/parsing/values';
import { getCurrentFields, getSchemaByThing, oFilter } from '../../../helpers';
import type { EnrichedBormRelation, EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../../types';
import { Parent } from '../../../types/symbols';
import type { FlatBqlMutation } from '../bql/flatter';

export const buildSURQLMutation = async (flat: FlatBqlMutation, schema: EnrichedBormSchema) => {
  // Sanitize parent edge field name for SurrealDB access.
  // COMPUTED fields (link fields) with special chars are renamed via computedFieldNameSurrealDB.
  // Role/ref fields keep their original name wrapped in angle brackets.
  const sanitizeEdgeField = (edgeField: string): string => {
    const computedName = computedFieldNameSurrealDB(edgeField);
    if (computedName !== edgeField) {
      return computedName;
    }
    return `⟨${edgeField}⟩`;
  };

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
        return `${df} = ${parseValueSurrealDB(value, dataFieldSchema.contentType, schema)}`;
      })
      .filter(Boolean);

    const VAR = `$⟨${$tempId || $bzId}⟩`;
    // _pre variable holds SELECT * results for child blocks to access computed fields.
    // SurrealDB v3 COMPUTED fields are NOT resolved during record-link dereference,
    // so we must SELECT * explicitly for all ops to make link fields available to child blocks.
    // For DELETE: _pre = SELECT * before deletion, VAR = record IDs from TARGET.
    // For MATCH/UPDATE: _pre = SELECT * from TARGET, VAR = IDs or UPDATE result.
    const PRE_VAR = `$⟨${$tempId || $bzId}_pre⟩`;

    const COND = (() => {
      if (parent?.bzId) {
        // Use parent's _pre variable for computed field access (needed for DELETE parents
        // where the record is deleted and fields can't be resolved dynamically).
        return `array::flatten($⟨${parent.bzId}_pre⟩.${sanitizeEdgeField(parent.edgeField)} || []).filter(|$v| $v != NONE).len`;
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
        const parentRef = `array::flatten($⟨${parent.bzId}_pre⟩.${sanitizeEdgeField(parent.edgeField)} || []).filter(|$v| $v != NONE)`; //needed to fix an issue where deletions fail when finding none. If we want to thow an error on undefined this might be a good place

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
    if (['link', 'unlink', 'replace'].includes($op)) {
      throw new Error("Edge ops don't belong to things");
    }
    if (block.$op === 'match') {
      if ($tempId) {
        return ''; //tempIds are already stored on their creation
      }
      return `LET ${VAR} = (SELECT VALUE id FROM ${TARGET} ${WHERE});\nLET ${PRE_VAR} = (SELECT * FROM ${TARGET} ${WHERE});`;
    }
    if (block.$op === 'create') {
      if (isArray(idValue)) {
        throw new Error('Cannot create multiple things at once');
      }
      const tableName = sanitizeNameSurrealDB($thing);
      return `LET ${VAR} = (CREATE ONLY ${tableName}:⟨${idValue}⟩ ${SET} RETURN ${OUTPUT});\nLET ${PRE_VAR} = ${VAR};`;
    }
    if (block.$op === 'update') {
      return `LET ${PRE_VAR} = IF (${COND}) { (SELECT * FROM ${TARGET} ${WHERE}) };\nLET ${VAR} = IF (${COND}) { (UPDATE ${TARGET} ${SET} ${WHERE} RETURN ${OUTPUT}) };`;
    }
    if (block.$op === 'delete') {
      // SurrealDB v3: RETURN BEFORE doesn't include computed (link) fields.
      // SELECT first to capture computed field values for dependent blocks, then DELETE.
      // _pre holds full records (with computed fields) for child block COND/TARGET.
      // VAR holds record IDs (from the TARGET expression) for edge UPDATE operations.
      // Note: We can't use _pre.id because SurrealDB v3 has a bug where the `id` field
      // disappears from SELECT * results after REFERENCE ON DELETE UNSET cascades in transactions.
      return [
        `LET ${PRE_VAR} = IF (${COND}) { (SELECT * FROM ${TARGET} ${WHERE}) };`,
        `LET ${VAR} = IF (${PRE_VAR}) { array::flatten([${TARGET}]) };`,
        `IF (${PRE_VAR}) { DELETE ${TARGET} ${WHERE} };`,
      ].join('\n');
    }

    throw new Error(`Unsupported operation ${block.$op}`);
  };

  const buildEdges = (block: EnrichedBQLMutationBlock) => {
    const { $thing, $bzId, $op, $tempId } = block;
    const currentSchema = getSchemaByThing(schema, $thing);
    const { usedRoleFields } = getCurrentFields(currentSchema, block);

    const VAR = `$⟨${$tempId || $bzId}⟩`;
    const tableName = sanitizeNameSurrealDB($thing);

    // Pre-UPDATE statements to enforce inverse cardinality ONE constraints.
    // When the opposite side has cardinality ONE, each target can only be referenced
    // by one record, so we must unlink from old records before linking to the new one.
    const preStatements: string[] = [];

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

            // Check if opposite link field has cardinality ONE (inverse constraint)
            const hasInverseOneConstraint = roleFieldSchema.playedBy?.some((lf) => lf.cardinality === 'ONE');

            // For link: if opposite has ONE cardinality, unlink from other records first.
            // Only for 'link' (new associations), not 'replace' (which updates in-place).
            if (hasInverseOneConstraint && $op === 'link') {
              if (cardinality === 'ONE') {
                // Wrap in parens so SurrealDB doesn't parse `WHERE rf = X || Y` as `(rf = X) || Y`
                const resolvedValue =
                  asArrayOfVars.length > 1
                    ? `(array::filter(array::flatten([${asArrayOfVars}]), |$v| !!$v)[0])`
                    : `(((type::is_array(${asArrayOfVars[0]}) && array::len(${asArrayOfVars[0]})==1) && ${asArrayOfVars[0]}[0]) || ${asArrayOfVars[0]})`;
                preStatements.push(`UPDATE ${tableName} SET ${rf} = NONE WHERE ${rf} = ${resolvedValue}`);
              } else if (cardinality === 'MANY') {
                const nodesString = `array::flatten([${asArrayOfVars}])`;
                preStatements.push(
                  `UPDATE ${tableName} SET ${rf} -= ${nodesString} WHERE ${rf} CONTAINSANY ${nodesString}`,
                );
              }
            }

            if (cardinality === 'ONE') {
              if (asArrayOfVars.length > 1) {
                //This is ok as long as only one is a match, but we can link to several in card ONE. This is practical if we don't know the $thing for instance, we can try multiple ones
                const arrayString = `array::filter(array::flatten([${asArrayOfVars}]), |$v| !!$v)`;
                switch ($op) {
                  case 'link':
                  case 'replace':
                    return `${rf} = ${arrayString}[0]`;
                  case 'unlink':
                    return `${rf} = NONE`; //todo this is not necessarily correct if $id or $filter! Should be none only if the node has been found
                  default:
                    throw new Error(`Unsupported operation ${$op} for ONE cardinality`);
                }
              }
              switch ($op) {
                case 'link':
                case 'replace':
                  return `${rf} = ((type::is_array(${asArrayOfVars[0]}) && array::len(${asArrayOfVars[0]})==1) && ${asArrayOfVars[0]}[0]) || ${asArrayOfVars[0]}`;
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

    const preStatementsStr = preStatements.length > 0 ? `${preStatements.join(';\n')};\n` : '';
    return `${preStatementsStr}IF ${VAR} { (UPDATE ${VAR} ${SET} RETURN VALUE id) }; ${VAR};`; //todo: confirm if the WHERE is actually needed here?
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

      //console.log('arcs', arcs);
      return arcs;
    }

    if ($op === 'delete') {
      return `DELETE FROM ${tableName} WHERE array::flatten([${roleA}]) CONTAINSANY $⟨${thingsA}⟩ AND array::flatten([${roleB}]) CONTAINSANY $⟨${thingsB}⟩ RETURN BEFORE`;
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
                return `${rf} = ${arrayString}[0]`;
              case 'unlink':
                return `${rf} = NONE`; //todo this is not necessarily correct if $id or $filter! Should be none only if the node has been found
              default:
                throw new Error(`Unsupported operation ${$op} for ONE cardinality`);
            }
          }
          switch ($op) {
            case 'link':
            case 'replace':
              return `${rf} = ((type::is_array(${asArrayOfVars[0]}) && array::len(${asArrayOfVars[0]})==1) && ${asArrayOfVars[0]}[0]) || ${asArrayOfVars[0]}`;
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
        if (cardinality === 'ONE') {
          return `${rf} = array::flatten([${block[rf]}])[0]`;
        }
        // For MANY: flatten only variable references (entity matches) individually,
        // keeping data values (including nested arrays/objects) as-is.
        const elements = isArray(block[rf]) ? block[rf] : [block[rf]];
        const processedElements = elements.map((el: unknown) => {
          if (typeof el === 'string' && (el as string).startsWith('$')) {
            return `array::flatten([${el}])[0]`;
          }
          return el;
        });
        return `${rf} = [${processedElements.join(', ')}]`;
      }

      throw new Error(`Unsupported contentType ${contentType}`);
    });

    const refFieldsString = refFields.length > 0 ? `${refFields.join(', ')}` : '';
    const SET = refFieldsString ? `SET ${refFieldsString}` : '';

    return `IF ${VAR} { (UPDATE ${VAR} ${SET} RETURN VALUE id) }; ${VAR};`;
  };

  // Separate root-level match nodes (no parent) from the rest of the things.
  // Root-level matches are simple `SELECT VALUE id FROM Table:⟨id⟩` lookups used
  // for edge linking. They must execute BEFORE any DELETE operations because
  // SurrealDB v3 has a bug where DELETE on records with REFERENCE ON DELETE CASCADE
  // can cause subsequent direct table lookups on the referenced records to fail
  // within the same transaction.
  const rootMatches = flat.things.filter((t) => t.$op === 'match' && !t[Parent as any]?.bzId);
  const otherThings = flat.things.filter((t) => !(t.$op === 'match' && !t[Parent as any]?.bzId));

  const result = [
    ...rootMatches.map(buildThings),
    ...otherThings.map(buildThings),
    ...flat.edges.map(buildEdges),
    ...flat.arcs.flatMap(buildArcs),
    ...flat.references.map(buildReferences),
  ];
  //console.log('builtMutation', result);
  return result;
};
