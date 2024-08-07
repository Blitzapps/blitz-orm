import { isArray } from 'radash';
import { getSchemaByThing, oFilter, getCurrentFields } from '../../../helpers';
import type { BormOperation, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { sanitizeNameSurrealDB, tempSanitizeVarSurrealDB } from '../../../adapters/surrealDB/helpers';
import { buildSuqlFilter, parseFilter } from '../../../adapters/surrealDB/filters/filters';

const opMap: Record<BormOperation, string> = {
	create: 'CREATE',
	update: 'UPDATE',
	delete: 'DELETE',
	link: 'LINK',
	unlink: 'UNLINK',
	replace: 'REPLACE',
	match: 'MATCH',
};
export const buildSURQLMutation = async (
	enriched: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
) => {
	console.log('START', enriched);

	const buildMutation = (block: EnrichedBQLMutationBlock, path: string = '', isParentDeletion = false): string => {
		console.log('CURRENT_BLOCK', block);
		//const indentationLevel = path.split('.').length;
		const currentPath = sanitizeNameSurrealDB(path.split('.').at(-1) as string);
		const parentContextName = isParentDeletion ? '$before' : '$parent';

		const currentSchema = getSchemaByThing(schema, block.$thing);
		const { idFields } = currentSchema;

		const { $filter, $thing, $bzId, $op, $id } = block;

		//console.log('idfields', idFields[0]);
		const idValue = $id || block[idFields[0]];
		const meta = oFilter(block, (k: string) => k.startsWith('$'));
		const rest = oFilter(block, (k: string) => !k.startsWith('$'));
		const restString = JSON.stringify(rest);
		const metaString = Object.entries(meta)
			.map(([key, value]) => `'${key}': '${value}'`)
			.join(',');

		const tableName = sanitizeNameSurrealDB($thing);

		const op = opMap[block.$op];
		//Todo: Use the normal sanitizeName once its fixed in surrealDB and we can use ` ` again in vars
		const $var = `$${tempSanitizeVarSurrealDB($bzId)}`;

		if (['create', 'update', 'delete', 'unlink', 'link'].includes($op)) {
			const { usedLinkFields, usedRoleFields, usedDataFields } = getCurrentFields(currentSchema, block);

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
					if (['JSON', 'NUMBER', 'BOOLEAN'].includes(dataFieldSchema.contentType)) {
						return `${df} = ${block[df]}`;
					}
					if (['TEXT', 'EMAIL'].includes(dataFieldSchema.contentType)) {
						return `${df} = '${block[df]}'`;
					}
					throw new Error(`Unsupported data field type ${dataFieldSchema.contentType} for key ${df} in mutation`);
				})
				.filter(Boolean);

			const linkFields: { lf: string; nested: string; surqlOp?: string }[] = usedLinkFields
				.flatMap((lf) => {
					const linkFieldSchema = currentSchema.linkFields?.find((f) => f.path === lf);
					console.log('linkFieldSchema', linkFieldSchema);
					if (!linkFieldSchema) {
						throw new Error(`Link field schema not found for ${lf}`);
					}

					const { plays, relation, target, oppositeLinkFieldsPlayedBy } = linkFieldSchema;

					const asArrayBlocks = (isArray(block[lf]) ? block[lf] : [block[lf]]) as EnrichedBQLMutationBlock[];

					if (target === 'role') {
						const intermediaryLinkBlock = {
							$bzId: `IR_${$bzId}`,
							$op: 'create' as BormOperation,
							$thing: relation,
							$thingType: 'relation' as const,
							[plays]: { $op: 'link', $id: '$parent.id' },
							[oppositeLinkFieldsPlayedBy[0].plays]: block[lf],
						};

						const nested = buildMutation(intermediaryLinkBlock, `${path}.${lf}`, $op === 'delete');
						//! cardinality MANY and FOR LOOPS to be done
						//return [`I_${lf} = ${nested}`, `I_${lf} = NONE`];
						return [
							{ lf: `ILF_${lf}`, nested: nested },
							{ lf: `ILF_${lf}`, nested: 'NONE' },
						];
					}

					if (target === 'relation') {
						const nestedBlocks = asArrayBlocks.map((bl) => {
							const nestedStructure = [
								{
									lf: `DLF_${lf}`,
									nested: buildMutation(bl, `${path}.${lf}`, $op === 'delete'),
								},
							];

							const relationBlock = (() => {
								if (bl.$op === 'link' || bl.$op === 'unlink') {
									return bl;
								}
								if (bl.$op === 'delete') {
									return { ...bl, $op: 'unlink' as const };
								}
								if (bl.$op === 'create') {
									return { ...bl, $op: 'link' as const, $id: bl.id }; //todo: consider ids in other prop names
								}
								if (bl.$op === 'update') {
									return bl; //but in reality this is not used
								}
								throw new Error(`Unsupported operation ${bl.$op}`);
							})();

							const linked =
								bl.$op === 'create' || bl.$op === 'link'
									? [
											{
												lf: `add_${lf}`,
												surqlOp: '+=',
												//Probably this should be changed to a {$op: link} so its actually fetched with a SELECT
												nested: buildMutation(relationBlock, `${path}.${lf}`, $op === 'delete'),
											},
										]
									: [];

							const unlinked =
								bl.$op === 'unlink' || bl.$op === 'delete'
									? [
											{
												lf: `remove_${lf}`,
												surqlOp: '+=',
												nested: buildMutation(relationBlock, `${path}.${lf}`, $op === 'delete'),
											},
										]
									: [];

							//todo: removals and bl.$op link etc
							return [...nestedStructure, ...linked, ...unlinked];
						});
						return nestedBlocks;
					}

					throw new Error(`Unsupported target ${target} for link field ${lf}`);
					//return `${lf} = ${block[lf]}`;
				})
				.flat();

			const linkFieldStrings = linkFields.map(
				({ lf, surqlOp, nested }) => `${sanitizeNameSurrealDB(lf)} ${surqlOp ?? '='} ${nested}`,
			);

			console.log('LINKFIELDS', linkFields);

			const roleFields =
				'roles' in currentSchema
					? usedRoleFields.flatMap((rf) => {
							const roleFieldSchema = currentSchema.roles[rf];
							if (!roleFieldSchema) {
								throw new Error(`Role field schema not found for ${rf}`);
							}
							const { cardinality } = roleFieldSchema;
							//const nested = buildMutations(block[rf], nextLevel);
							const asArrayBlocks = (isArray(block[rf]) ? block[rf] : [block[rf]]) as EnrichedBQLMutationBlock[];

							const nestedBlocks = asArrayBlocks.map((bl) => {
								console.log('currentBlock!', bl);
								if (bl.$op === 'create') {
									return {
										rf: rf,
										surqlOp: cardinality === 'ONE' ? '=' : '+=',
										nested: buildMutation(bl, `${path}.${rf}`, $op === 'delete'),
										return: `RETURN ${$var}.sid`,
									};
								}

								if (bl.$op === 'update') {
									return {
										rf: rf,
										surqlOp: '=', // We will make it equivalent to itself, so no need to consider cardinality
										nested: buildMutation(bl, `${path}.${rf}`, $op === 'delete'),
										return: `RETURN ${rf}`,
									};
								}
								if (bl.$op === 'delete') {
									return {
										rf: rf,
										surqlOp: cardinality === 'ONE' ? '=' : '-=',
										nested: buildMutation(bl, `${path}.${rf}`, $op === 'delete'),
										return: cardinality === 'ONE' ? 'RETURN NONE' : `RETURN ${$var}.sid`, //! If there is a filter, we are unlinking byt there is no result so nothing was deleted so we should not unlink
									};
								}
								if (bl.$op === 'unlink') {
									return {
										rf: rf,
										surqlOp: cardinality === 'ONE' ? '=' : '-=',
										nested: buildMutation(bl, `${path}.${rf}`, $op === 'delete'),
										return: cardinality === 'ONE' ? 'RETURN NONE' : `RETURN ${$var}.sid`, //! If there is a filter, we are unlinking byt there is no result so nothing was deleted so we should not unlink
									};
								}
								if (bl.$op === 'link') {
									if (bl.$id === '$parent.id' || bl.$id === '$before.id') {
										return {
											rf: rf,
											surqlOp: cardinality === 'ONE' ? '=' : '+=',
											nested: bl.$id,
											return: `RETURN ${$var}.sid`,
										};
									}
									return {
										rf: rf,
										surqlOp: cardinality === 'ONE' ? '=' : '+=',
										nested: buildMutation(bl, `${path}.${rf}`, $op === 'delete'),
										return: `RETURN ${$var}.sid`,
									};
								}
								throw new Error(`Unsupported operation ${bl.$op}`);
							});
							return nestedBlocks;
						})
					: [];

			const roleFieldStrings = roleFields.map(({ rf, surqlOp, nested }) => `${rf} ${surqlOp} ${nested}`);

			const fields = [...dataFieldStrings, ...linkFieldStrings, ...roleFieldStrings];
			const fieldsString = fields.length ? `SET ${fields.join(', ')}` : '';

			const $idString = !$id
				? ''
				: isArray($id)
					? `[WHERE meta::id(id) IN ${JSON.stringify($id.map((id) => `"${id}"`))}]`
					: `[WHERE meta::id(id) == "${$id}"]`;

			const FROM = currentPath ? `${parentContextName}.${currentPath}${$idString}` : `${tableName}:⟨${idValue}⟩`; //todo: Multiple ids at the rootPath

			const WHERE = $filter ? `WHERE ${buildSuqlFilter(parseFilter($filter, $thing, schema))}` : '';

			const OUTPUT = `{${restString}} as input, $before as before, $after as after, {${metaString},'$id': meta::id(id),'id': meta::id(id)} as meta, id as sid`;
			const DELTA = `CREATE ONLY Delta SET bzId = ⟨${block.$bzId}⟩, result = ${$var}`;
			//const RETURN = `${level !== 0 ? `RETURN ${$var}.sid` : ''};`;
			const NESTED_TREE = `{${roleFields.map(({ rf, nested }) => `${rf}: ${nested}`).join(', ')}};`;

			if (block.$op === 'create') {
				return `{ LET ${$var} = (CREATE ONLY ${tableName}:⟨${idValue}⟩ ${fieldsString} RETURN ${OUTPUT}); ${DELTA}; ${currentPath ? `RETURN ${$var}.sid` : ''} }`;
			}
			if (block.$op === 'update') {
				//update don't change the parent, so the return is just currentPath to keep it equal
				return `{ LET ${$var} = (UPDATE ${FROM} ${fieldsString} RETURN ${OUTPUT}); ${DELTA}; ${currentPath ? `RETURN ${currentPath}` : ''} }`;
			}
			if (block.$op === 'delete') {
				return `{ LET ${$var} = (SELECT ${OUTPUT} FROM ${FROM} ${WHERE}); IF ${$var}.sid THEN {DELETE ${$var}.sid RETURN ${NESTED_TREE}; ${DELTA}} END; ${currentPath ? `RETURN ${$var}.sid` : ''}}`;
			}
			if (block.$op === 'unlink') {
				return `{ LET ${$var} = (SELECT ${OUTPUT} FROM ${FROM} ${WHERE}); ${NESTED_TREE}; ${DELTA}; ${currentPath ? `RETURN ${$var}.sid` : ''}}`;
			}
			if (block.$op === 'link') {
				return `{ LET ${$var} = (SELECT ${OUTPUT} FROM ${tableName}:⟨${idValue}⟩); ${NESTED_TREE}; ${DELTA};  RETURN ${$var}.sid}`; //`{ LET ${$var} = SELECT ${OUTPUT} FROM ${tableName}:⟨${idValue}⟩}; ${NESTED_TREE}; ${DELTA}; ${currentPath ? `RETURN ${$var}.sid` : ''}}` as string;
			}
			throw new Error(`Unsupported operation ${block.$op}`);
		}

		throw new Error(`Unsupported operation ${block.$op}`);
	};

	const result = Array.isArray(enriched) ? enriched.map((block) => buildMutation(block)) : [buildMutation(enriched)];
	return result;
};
