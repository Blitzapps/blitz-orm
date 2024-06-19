/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type { BQLMutationBlock, EnrichedLinkField } from '../../../../types';
import { nanoid } from 'nanoid';

export const addIntermediaryRelations = (node: BQLMutationBlock, field: string, fieldSchema: EnrichedLinkField) => {
	if (fieldSchema.isVirtual) {
		throw new Error(`[Mutation Error] Virtual fields cannot be used in mutations. (Field: ${field})`);
	}
	const isArrayField = isArray(node[field]);
	const subNodes = (isArrayField ? node[field] : [node[field]]) as BQLMutationBlock[];
	//console.log('NODE:', JSON.stringify(node, null, 2), 'and', JSON.stringify(subNodes, null, 2));

	const { relation, oppositeLinkFieldsPlayedBy } = fieldSchema;

	if (oppositeLinkFieldsPlayedBy.length !== 1) {
		throw new Error(`[Mutation Error] Only one oppositeLinkFieldsPlayedBy is supported. (Field: ${field})`);
	}

	const pathToRelation = fieldSchema.throughtRelationPath; //todo in the enrich schema move this to linkField.targetRoles
	const ParentRole = fieldSchema.plays;
	const TargetRole = fieldSchema.oppositeLinkFieldsPlayedBy[0].plays;
	//case 1: parent create means is a link
	if (node.$op === 'create') {
		const intermediaryRelations = subNodes.map((subNode) => ({
			$op: 'create',
			$thing: relation,
			$thingType: 'relation',
			$bzId: `IR_${nanoid()}`,
			[TargetRole]: subNode,
			[ParentRole]: { $bzId: node.$bzId, $thing: node.$thing, $thingType: node.$thingType, $op: 'link' },
		}));

		if (isArrayField) {
			//this in the future could depend on how the intermediary relation is configured in the roleField, but by default it will create one intermediary relation per edge
			node[pathToRelation] = intermediaryRelations;
		} else {
			// eslint-disable-next-line prefer-destructuring
			node[pathToRelation] = intermediaryRelations[0];
		}
	}
	if (node.$op === 'update' || node.$op === 'match' || node.$op === 'delete') {
		const getOp = (subNode: BQLMutationBlock) => {
			if (!subNode.$op) {
				throw new Error(`[Mutation Error] Update and match operations require a $op field. (Field: ${field})`);
			}
			if (['update', 'match'].includes(subNode.$op)) {
				return 'match';
			}
			if (subNode.$op === 'link') {
				return 'create';
			}
			if (subNode.$op === 'unlink') {
				return 'delete';
			}
			if (subNode.$op === 'delete') {
				return 'delete';
			}
			throw new Error(`[Mutation Error] Invalid $op field. (Field: ${field})`);
		};
		//CASOS
		//`uodateando un children
		const intermediaryRelations: any = subNodes.map((subNode) => ({
			$op: getOp(subNode),
			$thing: relation,
			$thingType: 'relation',
			$bzId: `IR_${nanoid()}`,
			[TargetRole]: subNode,
			[ParentRole]: { $bzId: node.$bzId, $thing: node.$thing, $thingType: node.$thingType, $op: 'match' },
		}));

		if (isArrayField) {
			//this in the future could depend on how the intermediary relation is configured in the roleField, but by default it will create one intermediary relation per edge
			node[pathToRelation] = intermediaryRelations;
		} else {
			// eslint-disable-next-line prefer-destructuring
			node[pathToRelation] = intermediaryRelations[0];
		}
		//
	}
	// eslint-disable-next-line no-param-reassign

	/* /// Only objects, is fine
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
		
	} */
};
