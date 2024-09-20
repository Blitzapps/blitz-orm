import type { EnrichedLinkField, EnrichedBormRelation, BormSchema } from '../../../types';

export const getSurrealLinkFieldQueryPath = ({
	linkField,
	originalRelation,
	withExtensionsSchema,
	linkMode,
}: {
	linkField: EnrichedLinkField;
	originalRelation: string;
	withExtensionsSchema: BormSchema;
	linkMode: 'refs' | 'edges';
}) => {
	// For virtuals, it is managed by the database schema
	if (linkField.isVirtual) {
		return `$this.${linkField.path}.id`;
	}

	// And the subtypes of the current relation, as only the currentSubtypes are included in the path
	const targetRelationSubTypes =
		(withExtensionsSchema.relations[linkField.relation] as EnrichedBormRelation).subTypes || [];
	const targetRelationThings = [linkField.relation, ...targetRelationSubTypes];

	const pathToRelation = `<-⟨${originalRelation}_${linkField.plays}⟩<-(⟨${targetRelationThings.join('⟩,⟨')}⟩)`;

	if (linkField.target === 'relation') {
		if (linkMode === 'edges') {
			return pathToRelation; //Not original relation in the second, but all the potential targets
		}
		if (linkMode === 'refs') {
			if (linkField.cardinality === 'MANY') {
				return `$parent.[\`${linkField.path}\`]`;
			}
			return `$parent.\`${linkField.path}\``;
		}
		throw new Error('Unsupported linkMode');
	} else if (linkField.target === 'role') {
		const [targetRole] = linkField.oppositeLinkFieldsPlayedBy; //todo: This should consider more option in the future
		const targetRoleSubTypes =
			//@ts-expect-error it is not fully extended but it does have subtypes
			withExtensionsSchema.entities[targetRole.thing]?.subTypes ||
			//@ts-expect-error it is not fully extended but it does have subtypes
			withExtensionsSchema.relations[targetRole.thing]?.subTypes ||
			[];

		const oppositeRoleThings = [targetRole.thing, ...targetRoleSubTypes];

		const pathToTunneledRole = `->⟨${originalRelation}_${targetRole.plays}⟩->(⟨${oppositeRoleThings.join('⟩,⟨')}⟩)`;

		if (linkMode === 'edges') {
			return `${pathToRelation}${pathToTunneledRole}`;
		}
		if (linkMode === 'refs') {
			if (linkField.cardinality === 'MANY') {
				return `$parent.[\`${targetRole.plays}\`]`;
			}
			return `$parent.\`${targetRole.plays}\``;
		}

		return `${pathToRelation}${pathToTunneledRole}`;
	} else {
		throw new Error('Unsupported linkField target');
	}
};
