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
import { getOp } from '../shared/getOp';
import { getOppositePlayers } from '../shared/getOppositePlayers';
import { genId } from '../../../../helpers';

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

		const get$bzId = () => {
			if (subNode.$bzId) {
				return subNode.$bzId;
			}
			if (subNode.$tempId) {
				return subNode.$tempId;
			}
			// particular case, where we have a single $id, which is unique per $things so no need to generate multiple bzIds we can unify
			if (subNode.$id && !isArray(subNode.$id)) {
				return `SN_ONE_${player.thing}_${subNode.$id}`; //also we add prefix SN_ONE as we know is cardinality ONE
			}
			if (subNode.$id && isArray(subNode.$id)) {
				return `SN_MANY_${player.thing}_${genId()}`; //also we add prefix SN_MANY as we know is cardinality MANY
			}

			return `SM_${genId()}`;
		};
		const $bzId = get$bzId();

		if (!fieldSchema) {
			throw new Error(`[Internal] No fieldSchema found in ${JSON.stringify(fieldSchema)}`);
		}

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
