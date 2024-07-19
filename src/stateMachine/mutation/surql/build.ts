import { prepareTableNameSurrealDB } from '../../../adapters/surrealDB/helpers';
import { getSchemaByThing, oFilter, getCurrentFields } from '../../../helpers';
import type { BormOperation, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';

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

	const buildMutations = (blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[]) => {
		if (Array.isArray(blocks)) {
			return `[${blocks.map(buildMutation)}]`;
		}
		return buildMutation(blocks);
	};
	const buildMutation = (block: EnrichedBQLMutationBlock): string => {
		console.log('CURRENT_BLOCK', block);

		if (block.$op === 'link') {
			return `${block.$id}`;
		}

		const currentSchema = getSchemaByThing(schema, block.$thing);
		const { idFields } = currentSchema;

		console.log('idfields', idFields[0]);
		const idValue = block.$id || block[idFields[0]];
		const meta = oFilter(block, (k: string) => k.startsWith('$'));
		const rest = oFilter(block, (k: string) => !k.startsWith('$'));
		const restString = Object.entries(rest)
			.map(([key, value]) => `'${key}': '${value}'`)
			.join(',');
		const metaString = Object.entries(meta)
			.map(([key, value]) => `'${key}': '${value}'`)
			.join(',');

		const tableName = prepareTableNameSurrealDB(block.$thing);
		const op = opMap[block.$op];
		const $var = `$⟨${block.$bzId}⟩`;

		if (['create', 'update'].includes(block.$op)) {
			const { usedLinkFields, usedRoleFields, usedDataFields } = getCurrentFields(currentSchema, block);

			const dataFields = usedDataFields
				.map((df) => {
					const dataFieldSchema = currentSchema.dataFields?.find((f) => f.path === df || f.dbPath === df);
					if (!dataFieldSchema) {
						throw new Error(`Data field schema not found for ${df}`);
					}
					if (idFields.includes(df)) {
						return;
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

			const linkFields = usedLinkFields.flatMap((lf) => {
				const linkFieldSchema = currentSchema.linkFields?.find((f) => f.path === lf);
				console.log('linkFieldSchema', linkFieldSchema);
				if (!linkFieldSchema) {
					throw new Error(`Link field schema not found for ${lf}`);
				}

				const { plays, relation, target, oppositeLinkFieldsPlayedBy } = linkFieldSchema;
				if (target === 'role') {
					const intermediaryBlock = {
						$bzId: `IR_${block.$bzId}`,
						$op: 'create' as BormOperation,
						$thing: relation,
						$thingType: 'relation' as const,
						[plays]: { $op: 'link', $id: '$parent.id' },
						[oppositeLinkFieldsPlayedBy[0].plays]: block[lf],
					};

					const nested = buildMutations(intermediaryBlock);
					return [`I_${lf} = ${nested}`, `I_${lf} = NONE`];
				}
				return `${lf} = ${block[lf]}`;
			});

			const roleFields =
				'roles' in currentSchema
					? usedRoleFields.map((rf) => {
							const roleFieldSchema = currentSchema.roles[rf];
							if (!roleFieldSchema) {
								throw new Error(`Role field schema not found for ${rf}`);
							}
							const nested = buildMutations(block[rf]);
							return `${rf} = ${nested}`;
						})
					: [];

			const fields = [...dataFields, ...linkFields, ...roleFields];
			const fieldsString = fields.length ? `SET ${fields.join(',\n    ')}` : '';

			return `{
				LET ${$var} = ${op} ONLY ${tableName}:⟨${idValue}⟩\n${fieldsString}\nRETURN {${restString}} as input, $before as before, $after as after, {${metaString},'$id': meta::id(id),'id': meta::id(id)} as meta, id as sid;
				CREATE ONLY Delta SET bzId = ⟨${block.$bzId}⟩, result = ${$var};
				RETURN ${$var}.sid;
				}` as string;
		}

		if (block.$op === 'delete') {
			return `{ 
				LET ${$var} = SELECT {${restString}} as input, $this as before, {${metaString},'$id': meta::id(id),'id': meta::id(id)} as meta, id as sid FROM ONLY ${tableName}:⟨${idValue}⟩;
				IF ${$var} THEN {DELETE ${$var}.sid; CREATE ONLY Delta SET bzId = ⟨${block.$bzId}⟩, result = ${$var};} END;
				RETURN ${$var}.sid;
		}` as string;
		}
	};

	const result = Array.isArray(enriched) ? enriched.map(buildMutation) : [buildMutation(enriched)];
	return result;
};
