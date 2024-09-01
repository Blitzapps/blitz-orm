import { isArray } from 'radash';
import { sanitizeNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { getCurrentFields, getSchemaByThing, oFilter } from '../../../helpers';
import type { EnrichedBQLMutationBlock, EnrichedBormRelation, EnrichedBormSchema } from '../../../types';
import { Parent } from '../../../types/symbols';
import { buildSuqlFilter, parseFilter } from '../../../adapters/surrealDB/filters/filters';
import type { FlatBqlMutation } from '../bql/flatter';
import { parseFlexValSurrealDB } from '../../../adapters/surrealDB/parseFlexVal';

export const buildSURQLMutation = async (flat: FlatBqlMutation, schema: EnrichedBormSchema) => {
	const buildThings = (block: EnrichedBQLMutationBlock) => {
		//console.log('currentThing:', block);
		const { $filter, $thing, $bzId, $op, $id, $tempId } = block;

		const currentSchema = getSchemaByThing(schema, $thing);
		const { usedDataFields } = getCurrentFields(currentSchema, block);
		const { idFields } = currentSchema;
		const idValue = $id || block[idFields[0]];
		const tableName = sanitizeNameSurrealDB($thing);

		const meta = oFilter(block, (k: string) => k.startsWith('$'));
		const rest = oFilter(block, (k: string) => !k.startsWith('$'));
		const restString = JSON.stringify(rest);
		const metaString = Object.entries(meta)
			.map(([key, value]) => (key == '$tempId' ? `'$tempId': '_:${value}'` : `'${key}': '${value}'`)) //todo: At some point migrate tempIds so they only use _: when not explicit.
			.join(',');

		const parent = block[Parent as any]; //todo

		const dataFieldStrings = usedDataFields
			.map((df) => {
				const dataFieldSchema = currentSchema.dataFields?.find((f) => f.path === df || f.dbPath === df);
				if (!dataFieldSchema) {
					throw new Error(`Data field schema not found for ${df}`);
				}
				if (idFields.includes(df)) {
					return;
				}
				if (block[df] === null) {
					return `${df} = NONE`;
				}
				const value = block[df];
				if (['JSON', 'NUMBER', 'BOOLEAN'].includes(dataFieldSchema.contentType)) {
					return `${df} = ${value}`;
				}
				if (['TEXT', 'EMAIL'].includes(dataFieldSchema.contentType)) {
					return `${df} = '${value}'`;
				}
				if (dataFieldSchema.contentType === 'DATE') {
					return `${df} = d"${value.toISOString()}"`;
				}
				if (dataFieldSchema.contentType === 'FLEX') {
					const parsedVal = isArray(value) ? value.map((v) => parseFlexValSurrealDB(v)) : parseFlexValSurrealDB(value);
					return `${df} = ${isArray(parsedVal) ? parsedVal.map((v) => v) : parsedVal}`;
				}
				throw new Error(`Unsupported data field type ${dataFieldSchema.contentType} for key ${df} in mutation`);
			})
			.filter(Boolean);

		const VAR = `$⟨${$tempId || $bzId}⟩`;

		const COND = (() => {
			if (parent?.bzId) {
				return `$⟨${parent.bzId}⟩.⟨${parent.edgeField}⟩`;
			}
			if (idValue) {
				return `${tableName}:⟨${idValue}⟩`;
			}
			return `${tableName}`;
		})();

		const TARGET = (() => {
			//Non root
			if (parent?.bzId) {
				const parentRef = `array::flatten($⟨${parent.bzId}⟩.⟨${parent.edgeField}⟩)`;

				if (idValue) {
					if (isArray(idValue)) {
						return `${parentRef}[? $this.id() IN [${idValue.map((id) => `'${id}'`).join(', ')}] ]`;
					}
					return `${parentRef}[? $this.id() IN ['${idValue}'] ]`;
				}
				return parentRef;
			} else {
				if (idValue) {
					if (isArray(idValue)) {
						throw new Error('Multiple ids not supported');
					}
					return `${tableName}:⟨${idValue}⟩`;
				}
				return `${tableName}`;
			}
		})();
		const WHERE = $filter ? `WHERE ${buildSuqlFilter(parseFilter($filter, $thing, schema))}` : '';
		const SET = dataFieldStrings.length > 0 ? `SET ${dataFieldStrings.join(', ')}` : '';

		const OUTPUT = `VALUE (CREATE ONLY Delta SET input = ${restString}, meta = {${metaString}, "$sid": $parent.id, "$id": record::id($parent.id)}, after = $after, before = $before RETURN VALUE $parent.id )`;
		const DELETE_OUTPUT = 'BEFORE';

		if (['link', 'unlink', 'replace'].includes($op)) {
			throw new Error("Edge ops don't belong to things");
		}
		if (block.$op === 'match') {
			return `LET ${VAR} = (SELECT VALUE id FROM ${TARGET} ${WHERE});`;
		}
		if (block.$op === 'create') {
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
		const { $filter, $thing, $bzId, $op, $tempId } = block;
		const currentSchema = getSchemaByThing(schema, $thing);
		const { usedRoleFields } = getCurrentFields(currentSchema, block);

		const VAR = `$⟨${$tempId || $bzId}⟩`;
		const WHERE = $filter ? `WHERE ${buildSuqlFilter(parseFilter($filter, $thing, schema))}` : '';

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
								throw new Error(`${$op === 'link' ? 'Linking' : 'Replacing'} multiple values to a ONE field ${rf}`);
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
						} else if (cardinality === 'MANY') {
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
						} else {
							throw new Error(`Unsupported cardinality ${cardinality}`);
						}
					})
				: [];

		const roleFieldsString = roleFields.length > 0 ? `${roleFields.join(', ')}` : '';
		const SET = roleFieldsString ? `SET ${roleFieldsString}` : '';

		return `IF ${VAR} THEN (UPDATE ${VAR} ${SET} RETURN VALUE id) END; ${VAR};`; //todo: confirm if the WHERE is actually needed here?
	};

	const buildArcs = (block: EnrichedBQLMutationBlock) => {
		const { $filter, $thing, $bzId, $op, $id, $tempId } = block;
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

			const arcs = thingsA.flatMap((thingA) =>
				thingsB.flatMap(
					(thingB) =>
						`FOR $node1 IN fn::as_array($⟨${thingA}⟩) { FOR $node2 IN fn::as_array($⟨${thingB}⟩) { CREATE ONLY ${tableName} SET ${roleA} = ${isMany1 ? 'fn::as_array($node1)' : '$node1'}, ${roleB} = ${isMany2 ? 'fn::as_array($node2)' : '$node2'} RETURN ${OUTPUT}; } }`,
				),
			);
			//console.log('arcs', arcs);
			return arcs;
		}

		if ($op === 'delete') {
			return `DELETE FROM ${tableName} WHERE fn::as_array(${roleA}) CONTAINSANY $⟨${thingsA}⟩ AND fn::as_array(${roleB}) CONTAINSANY $⟨${thingsB}⟩ RETURN BEFORE`;
		}
	};

	const result = [...flat.things.map(buildThings), ...flat.edges.map(buildEdges), ...flat.arcs.flatMap(buildArcs)];
	//console.log('builtMutation', result);
	return result;
};
