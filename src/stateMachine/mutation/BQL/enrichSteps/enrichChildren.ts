/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type {
	BQLMutationBlock,
	EnrichedBormSchema,
	EnrichedBQLMutationBlock,
	EnrichedLinkField,
	EnrichedRoleField,
} from '../../../../types';
import { EdgeSchema } from '../../../../types/symbols';
import { getOp } from './shared/getOp';
import { v4 as uuidv4 } from 'uuid';
import { getOppositePlayers } from './shared/getOppositePlayers';

export const enrichChildren = (
	node: BQLMutationBlock,
	field: string,
	fieldSchema: EnrichedLinkField | EnrichedRoleField,
	schema: EnrichedBormSchema,
) => {
	const newNodes = (isArray(node[field]) ? node[field] : [node[field]]).map((subNode: EnrichedBQLMutationBlock) => {
		///symbols
		//#region nested nodes
		const oppositePlayers = getOppositePlayers(field, fieldSchema);
		const [player] = oppositePlayers;

		const $op = getOp(node, { ...subNode, $thing: player.thing, $thingType: player.thingType }, schema);
		const $bzId = subNode.$bzId ? subNode.$bzId : subNode.$tempId ? subNode.$tempId : `N_${uuidv4()}`;

		return {
			...subNode,
			[EdgeSchema]: fieldSchema,
			$thing: player.thing,
			$thingType: player.thingType,
			$op,
			$bzId,
		};

		//#endregion nested nodes
	});

	node[field] = isArray(node[field]) ? newNodes : newNodes[0];
};
