/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type { BQLMutationBlock, EnrichedLinkField, EnrichedRoleField } from '../../../../types';
import { getOppositePlayers } from '../shared/getOppositePlayers';
import { nanoid } from 'nanoid';

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

		const base = {
			$op,
			$thing,
			$thingType,
		};

		const tempIds = subNodes.filter((child: string) => child.startsWith('_:'));
		const nonTempIds = subNodes.filter((child: string) => !child.startsWith('_:'));

		if (tempIds.length && !nonTempIds.length) {
			//only $tempIds
			node[field] = tempIds.map((tempId: string) => ({
				...base,
				$tempId: tempId,
				$bzId: tempId,
			}));
		} else if (tempIds.length && nonTempIds.length) {
			//both
			node[field] = [
				...tempIds.map((tempId: string) => ({
					...base,
					$tempId: tempId,
					$bzId: tempId,
				})),
				{
					...base,
					$id: nonTempIds,
					$bzId: `S_${nanoid()}`,
				},
			];
		} else {
			//only $ids
			node[field] = {
				...base,
				$id: node[field],
				$bzId: `S_${nanoid()}`,
			};
		}
	} else {
		throw new Error(
			`[Mutation Error] Replace can only be used with a single id or an array of ids. (Field: ${field} Nodes: ${JSON.stringify(subNodes)} Parent: ${JSON.stringify(node, null, 2)})`,
		);
	}
};
