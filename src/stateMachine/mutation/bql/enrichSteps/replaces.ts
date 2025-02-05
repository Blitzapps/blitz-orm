/* eslint-disable no-param-reassign */
import { isArray, isObject } from 'radash';
import type { BQLMutationBlock, EnrichedLinkField, EnrichedRefField, EnrichedRoleField } from '../../../../types';
import { getOppositePlayers } from '../shared/getOppositePlayers';
import { genId } from '../../../../helpers';

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
					$bzId: `S_${genId()}`,
				},
			];
		} else {
			//only $ids
			node[field] = {
				...base,
				$id: node[field],
				$bzId: `S_${genId()}`,
			};
		}
	} else {
		throw new Error(
			`[Mutation Error] Replace can only be used with a single id or an array of ids. (Field: ${field} Nodes: ${JSON.stringify(subNodes)} Parent: ${JSON.stringify(node, null, 2)})`,
		);
	}
};

//todo: This is not doing any replaces, just checking the format, should be cleaned to do it
export const replaceToObjRef = (node: BQLMutationBlock, field: string, fieldSchema: EnrichedRefField) => {
	const subNodes = isArray(node[field]) ? node[field] : [node[field]];
	if (fieldSchema.contentType === 'REF') {
		if (subNodes.some((sn) => !isObject(sn))) {
			throw new Error(
				"[Wrong format] Field of contentType REF can't use strings as references", //future: unless they are prefixed
			);
		}
		return;
	}

	if (fieldSchema.contentType === 'FLEX') {
		return;
	}
	throw new Error(`[Internal] Field ${field} is not a refField`);
};
