/* eslint-disable no-param-reassign */
import type { BQLMutationBlock, EnrichedLinkField, EnrichedRoleField } from '../../../../types';
import { EdgeSchema } from '../../../../types/symbols';
import { v4 as uuidv4 } from 'uuid';
import { getOppositePlayers } from './shared/getOppositePlayers';

export const unlinkAll = (
	node: BQLMutationBlock,
	field: string,
	fieldSchema: EnrichedLinkField | EnrichedRoleField,
) => {
	const oppositePlayers = getOppositePlayers(field, fieldSchema);
	const [player] = oppositePlayers;

	node[field] = {
		$thing: player.thing,
		$thingType: player.thingType,
		$op: 'unlink',
		$bzId: `U_${uuidv4()}`,
		[EdgeSchema]: fieldSchema,
	};
};
