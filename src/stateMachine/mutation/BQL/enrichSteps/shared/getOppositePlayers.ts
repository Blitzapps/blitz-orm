import type { EnrichedLinkField, EnrichedRoleField } from '../../../../../types';

export const getOppositePlayers = (field: string, fieldSchema: EnrichedLinkField | EnrichedRoleField) => {
	if (fieldSchema.fieldType === 'linkField') {
		const oppositePlayer = fieldSchema.oppositeLinkFieldsPlayedBy;
		if (oppositePlayer?.length !== 1) {
			throw new Error(`[Internal] Field ${field} should have a single player`);
		}
		return oppositePlayer;
	} else if (fieldSchema.fieldType === 'roleField') {
		const oppositePlayer = fieldSchema.playedBy;
		if (oppositePlayer?.length !== 1) {
			throw new Error(`[Internal] Field ${field} should have a single player`);
		}
		return oppositePlayer;
	} else {
		throw new Error(`[Internal] Field ${field} is not a linkField or roleField`);
	}
};
