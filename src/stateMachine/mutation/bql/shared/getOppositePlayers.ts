import type { EnrichedLinkField, EnrichedRoleField } from '../../../../types';
import { SharedMetadata } from '../../../../types/symbols';

export const getOppositePlayers = (field: string, fieldSchema: EnrichedLinkField | EnrichedRoleField) => {
	if (fieldSchema[SharedMetadata].fieldType === 'linkField') {
		const linkFieldSchema = fieldSchema as EnrichedLinkField;
		const oppositePlayer = linkFieldSchema.oppositeLinkFieldsPlayedBy;
		if (oppositePlayer?.length !== 1) {
			throw new Error(`[Internal] Field ${field} should have a single player`);
		} else if (!oppositePlayer?.length) {
			throw new Error(`[Internal] Field ${field} should have a player`);
		}
		return oppositePlayer;
	} else if (fieldSchema[SharedMetadata].fieldType === 'roleField') {
		const roleFieldSchema = fieldSchema as EnrichedRoleField;
		if ([...new Set(roleFieldSchema.playedBy?.map((x) => x.thing))]?.length !== 1) {
			throw new Error(`[Internal] Field ${field} should have a single player`);
		} else if (!roleFieldSchema.playedBy?.length) {
			throw new Error(`[Internal] Field ${field} should have a player`);
		}
		return roleFieldSchema.playedBy;
	} else {
		throw new Error(`[Internal] Field ${field} is not a linkField or roleField`);
	}
};
