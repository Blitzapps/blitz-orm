/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type {
	BQLMutationBlock,
	EnrichedBormSchema,
	EnrichedBQLMutationBlock,
	EnrichedLinkField,
	EnrichedRoleField,
} from '../../../../types';
import { ParentBzId, EdgeSchema } from '../../../../types/symbols';
import { getOp } from './shared/getOp';
import { v4 as uuidv4 } from 'uuid';
import { getOppositePlayers } from './shared/getOppositePlayers';

export const enrichChildren = (
	node: BQLMutationBlock,
	field: string,
	fieldSchema: EnrichedLinkField | EnrichedRoleField,
	schema: EnrichedBormSchema,
) => {
	(isArray(node[field]) ? node[field] : [node[field]]).forEach((subNode: EnrichedBQLMutationBlock) => {
		///symbols
		subNode[EdgeSchema] = fieldSchema;
		//#region nested nodes

		const oppositePlayers = getOppositePlayers(field, fieldSchema);
		const [player] = oppositePlayers;

		subNode.$thing = player.thing;
		subNode.$thingType = player.thingType;
		subNode.$op = getOp(node, subNode, schema);
		subNode.$bzId = subNode.$bzId ? subNode.$bzId : subNode.$tempId ? subNode.$tempId : `N_${uuidv4()}`;
		subNode[ParentBzId] = node.$bzId;

		//#endregion nested nodes
	});
};
