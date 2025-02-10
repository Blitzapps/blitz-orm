/* eslint-disable no-param-reassign */
import { isArray, isObject } from 'radash';
import type { BQLMutationBlock, EnrichedRefField } from '../../../../types';

type PrefixedResult = { isPrefixed: true; obj: { $thing: string; $id: string } } | { isPrefixed: false; obj: unknown };

const prefixedToObj = (value: unknown): PrefixedResult => {
	if (typeof value !== 'string') {
		return { isPrefixed: false, obj: value };
	}

	const prefixMatch = value.match(/^(?!_:)([^:]+):([^:]+)$/);
	if (!prefixMatch) {
		return { isPrefixed: false, obj: value };
	}

	const [, $thing, $id] = prefixMatch;
	return { isPrefixed: true, obj: { $thing, $id } };
};

export const replaceToObj = (node: BQLMutationBlock, field: string) => {
	///Simplified so the only purpose of this function is to change strings to obj, but not assign BzIds or $things
	const subNodes = isArray(node[field]) ? node[field] : [node[field]];

	// If all elements are objects, return early (no transformation needed)
	if (subNodes.every((child) => typeof child === 'object')) {
		return;
	}

	// Ensure all elements are strings or objects with "$op: replace"; otherwise, throw an error
	if (
		!subNodes.every(
			(child) => typeof child === 'string' || (isObject(child) && '$op' in child && child.$op === 'replace'),
		)
	) {
		throw new Error(
			`[Mutation Error] Replace can only be used with a single id, an array of ids, or objects with $op: replace. (Field: ${field} Nodes: ${JSON.stringify(subNodes)})`,
		);
	}

	const $op = node.$op === 'create' ? 'link' : 'replace';

	node[field] = subNodes.map((child) => {
		if (typeof child === 'string') {
			if (child.startsWith('_:')) {
				return { $tempId: child, $op };
			}

			const { isPrefixed, obj } = prefixedToObj(child);
			if (isPrefixed) {
				return { ...obj, $op };
			}

			// Otherwise, it's a normal $id
			return { $id: child, $op };
		}
		// If already an object with $op: replace, keep it as is
		return child;
	});
};

//todo: This is not doing any replaces, just checking the format, should be cleaned to do it
export const replaceToObjRef = (node: BQLMutationBlock, field: string, fieldSchema: EnrichedRefField) => {
	const subNodes = isArray(node[field]) ? node[field] : [node[field]];

	const $op = node.$op === 'create' ? 'link' : 'replace';

	return (node[field] = subNodes.map((child) => {
		if (typeof child === 'string') {
			if (child.startsWith('_:')) {
				return { $tempId: child, $op };
			}

			const { isPrefixed, obj } = prefixedToObj(child);
			if (isPrefixed) {
				return { ...obj, $op };
			}

			if (fieldSchema.contentType === 'FLEX') {
				// it's ok we just keep the string
				return child;
			}

			throw new Error(
				"[Wrong format] Field of contentType REF can't use strings as references unless they follow the format `$thing:$id`", //future: unless they are prefixed
			);
		}

		if (typeof child === 'object' && '$thing' in child) {
			return child; //this is ok as well
		}

		if (fieldSchema.contentType === 'FLEX') {
			return child; //any other type is fine in FLEX too
		}

		throw new Error(
			'[Wrong format] Field of contentType REF can use prefixed id strings, tempIds or objects indicating their $thing', //future: unless they are prefixed
		);
	}));
};
