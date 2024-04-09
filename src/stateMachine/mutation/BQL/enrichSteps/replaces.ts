import { isArray } from 'radash';
import type { BQLMutationBlock, EnrichedLinkField, EnrichedRoleField } from '../../../../types';
import { getOppositePlayers } from '../shared/getOppositePlayers';
import { v4 as uuidv4 } from 'uuid';

export const replaceToObj = (
	node: BQLMutationBlock,
	field: string,
	fieldSchema: EnrichedLinkField | EnrichedRoleField,
) => {
	const subNodes = isArray(node[field]) ? node[field] : [node[field]];

	/// Only objects, is fine
	if (subNodes.every((child: unknown) => typeof child === 'object')) {
		return;
		///all strings, then we proceed to replace
	} else if (subNodes.every((child: unknown) => typeof child === 'string')) {
		const oppositePlayers = getOppositePlayers(field, fieldSchema);
		const [player] = oppositePlayers;

		//if parent === create, then is a link
		const $op = node.$op === 'create' ? 'link' : 'replace';
		const $thing = player.thing;
		const $thingType = player.thingType;

		//todo _: tempId included in the array, or as a single one of them
		if (subNodes.some((child: unknown) => (child as string).startsWith('_:'))) {
			throw new Error('[Not supported] At least one child of a replace is a tempId');
		}

		// eslint-disable-next-line no-param-reassign
		node[field] = {
			$id: node[field],
			$op,
			$thing,
			$thingType,
			$bzId: `S_${uuidv4()}`,
		};
	} else {
		throw new Error(
			`[Mutation Error] Replace can only be used with a single id or an array of ids. (Field: ${field} Nodes: ${JSON.stringify(subNodes)} Parent: ${JSON.stringify(node, null, 2)})`,
		);
	}
};
