/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type {
	BQLMutationBlock,
	EnrichedBormSchema,
	EnrichedBQLMutationBlock,
	EnrichedLinkField,
	EnrichedRoleField,
} from '../../../../types';
import { ParentFieldSchema, ParentBzId } from '../../../../types/symbols';
import { getOp } from './getOp';
import { v4 as uuidv4 } from 'uuid';

export const enrichChildren = (
	node: BQLMutationBlock,
	field: string,
	fieldSchema: EnrichedLinkField | EnrichedRoleField,
	parentBzId: string,
	schema: EnrichedBormSchema,
) => {
	(isArray(node[field]) ? node[field] : [node[field]]).forEach((subNode: EnrichedBQLMutationBlock) => {
		///symbols
		subNode[ParentFieldSchema] = fieldSchema;
		//#region nested nodes
		const getOppositePlayers = () => {
			if (fieldSchema.fieldType === 'linkField') {
				return fieldSchema.oppositeLinkFieldsPlayedBy;
			} else if (fieldSchema.fieldType === 'roleField') {
				return fieldSchema.playedBy;
			} else {
				throw new Error(`[Internal] Field ${field} is not a linkField or roleField`);
			}
		};
		const oppositePlayers = getOppositePlayers();

		if (oppositePlayers?.length != 1) {
			throw new Error(`[Internal-future] Field ${field} should have a single player`);
		} else {
			const [player] = oppositePlayers;
			subNode.$thing = player.thing;
			subNode.$thingType = player.thingType;
			subNode.$op = getOp(node, subNode, schema);
			subNode.$bzId = subNode.$bzId ? subNode.$bzId : subNode.$tempId ? subNode.$tempId : `N_${uuidv4()}`;
			subNode[ParentBzId] = parentBzId ? parentBzId : node.$bzId;
		}
		//#endregion nested nodes
	});
};
