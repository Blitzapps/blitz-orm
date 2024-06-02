import type { EnrichedLinkField, EnrichedBormRelation, BormSchema } from '../../../types';

export const getSurrealLinkFieldQueryPath = ({
	linkField,
	originalRelation,
	withExtensionsSchema,
}: {
	linkField: EnrichedLinkField;
	originalRelation: string;
	withExtensionsSchema: BormSchema;
}) => {
	// For virtuals, it is managed by the database schema
	if (linkField.isVirtual) {
		return `$this.${linkField.path}.id`;
	}

	// And the subtypes of the current relation, as only the currentSubtypes are included in the path
	const targetRelationSubTypes =
		(withExtensionsSchema.relations[linkField.relation] as EnrichedBormRelation).subTypes || [];
	const targetRelationThings = [linkField.relation, ...targetRelationSubTypes];

	const pathToRelation = `<-\`${originalRelation}_${linkField.plays}\`<-(\`${targetRelationThings.join('`,`')}\`)`;

	if (linkField.target === 'relation') {
		return pathToRelation; //Not original relation in the second, but all the potential targets
	} else if (linkField.target === 'role') {
		const [targetRole] = linkField.oppositeLinkFieldsPlayedBy; //todo: This should consider more option in the future
		const targetRoleSubTypes =
			//@ts-expect-error it is not fully extended but it does have subtypes
			withExtensionsSchema.entities[targetRole.thing]?.subTypes ||
			//@ts-expect-error it is not fully extended but it does have subtypes
			withExtensionsSchema.relations[targetRole.thing]?.subTypes ||
			[];

		const oppositeRoleThings = [targetRole.thing, ...targetRoleSubTypes];

		const pathToTunneledRole = `->\`${originalRelation}_${targetRole.plays}\`->(\`${oppositeRoleThings.join('`,`')}\`)`;

		return `${pathToRelation}${pathToTunneledRole}`;
	} else {
		throw new Error('Unsupported linkField target');
	}
};
