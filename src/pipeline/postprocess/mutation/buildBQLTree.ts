/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';

import type { BormConfig, BQLMutationBlock, RawBQLQuery, PipelineOperation } from '../../../types';
import type { TypeDbResponse } from '../../pipeline';

const cleanOutput = (obj: RawBQLQuery | BQLMutationBlock | BQLMutationBlock[], config: BormConfig) =>
	produce(obj, (draft) =>
		traverse(draft, ({ value }: TraversalCallbackContext) => {
			// if it is an array or an object, then return as they will be managed later
			if (Array.isArray(value) || !(typeof value === 'object') || value === null) {
				return;
			}
			if (value.$tempId) {
				value.$tempId = `_:${value.$tempId}`;
			}
			if (value.$fields) {
				delete value.$fields;
			}
			if (value.$filter) {
				delete value.$filter;
			}
			if (value.$show) {
				delete value.$show;
			}
			if (value.$bzId) {
				delete value.$bzId;
			}
			if (value.$entity || value.$relation) {
				value.$thing = value.$entity || value.$relation;
			}

			if (config.query?.noMetadata && (value.$entity || value.$relation)) {
				delete value.$entity;
				delete value.$relation;
				delete value.$id;
				delete value.$thing;
			}

			const symbols = Object.getOwnPropertySymbols(value);
			symbols.forEach((symbol) => {
				delete value[symbol];
			});

			if (value.$excludedFields) {
				value.$excludedFields.forEach((field: any) => {
					delete value[field];
				});
				delete value.$excludedFields;
			}
		}),
	);

const replaceBzIds = (resItems: any[], things: any[]) => {
	const mapping = {};

	// Create a mapping from $bzId to $id
	things.forEach((thing: any) => {
		// @ts-expect-error - TODO description
		mapping[thing.$bzId] = thing.$id;
	});
	// Replace values in the first array
	resItems.forEach((item) => {
		Object.keys(item).forEach((key) => {
			// @ts-expect-error - TODO description
			if (mapping[item[key]] && key !== '$tempId') {
				// @ts-expect-error - TODO description

				item[key] = mapping[item[key]];
			}
		});
	});

	return resItems;
};

const hasMatches = (resItems: any[], things: any[]): boolean => {
	const bzIds = things.map((thing) => thing.$bzId);
	let found = false;

	resItems.forEach((item) => {
		Object.keys(item).forEach((key) => {
			if (bzIds.includes(item[key])) {
				found = true;
			}
		});
	});

	return found;
};

export const buildBQLTree: PipelineOperation<TypeDbResponse> = async (req, res) => {
	const { bqlRequest, config } = req;
	// const queryConfig = config.query;
	// console.log('cache', cache);
	if (!bqlRequest) {
		throw new Error('BQL request not parsed');
	}

	// @ts-expect-error - TODO description
	const resItems = res.bqlRes[0] ? res.bqlRes : [res.bqlRes];
	const things = req.bqlRequest?.mutation?.things;
	// @ts-expect-error - TODO description
	const matchesFound = hasMatches(resItems, things);
	if (matchesFound) {
		// @ts-expect-error - TODO description
		const replaced = replaceBzIds(resItems, things);
		res.bqlRes = replaced[1] ? replaced : replaced[0];
	}
	// @ts-expect-error - TODO description
	const output = cleanOutput(res.bqlRes, config);
	res.bqlRes = output;

	return;
};
