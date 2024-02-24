import type { EnrichedLinkField, EnrichedRoleField } from '../../../../../types';

export const getOppositePlayers = (field: string, fieldSchema: EnrichedLinkField | EnrichedRoleField) => {
	if (fieldSchema.fieldType === 'linkField') {
		const oppositePlayer = fieldSchema.oppositeLinkFieldsPlayedBy;
		if (oppositePlayer?.length !== 1) {
			throw new Error(`[Internal] Field ${field} should have a single player`);
		} else if (!oppositePlayer?.length) {
			throw new Error(`[Internal] Field ${field} should have a player`);
		}
		return oppositePlayer;
	} else if (fieldSchema.fieldType === 'roleField') {
		if ([...new Set(fieldSchema.playedBy?.map((x) => x.thing))]?.length !== 1) {
			throw new Error(`[Internal] Field ${field} should have a single player`);
		} else if (!fieldSchema.playedBy?.length) {
			throw new Error(`[Internal] Field ${field} should have a player`);
		}
		return fieldSchema.playedBy;
	} else {
		throw new Error(`[Internal] Field ${field} is not a linkField or roleField`);
	}
};
