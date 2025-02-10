import { getSchemaByThing } from '../../../helpers';
import type {
	BQLMutationBlock,
	EnrichedBQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
} from '../../../types';
import { produce } from 'immer';

/**
 * Convert JSON attributes into strings.
 */
export const stringify = (
	blocks: BQLMutationBlock | BQLMutationBlock[],
	schema: EnrichedBormSchema,
): EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[] => {
	const result = produce(blocks, (draft) => stringifyObject(schema, draft));
	return result as EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
};

/**
 * Specify $thing if the role (target: relation) or the opposite role (target: role)
 * is played by one thing, otherwise $thing, $relation, or $entity must be defined
 * in the mutation object.
 */
const stringifyObject = (
	schema: EnrichedBormSchema,
	tree: Record<string, any> | string | (Record<string, any> | string)[],
	$thing?: string,
) => {
	if (typeof tree === 'string') {
		// It's an id.
		return;
	}
	if (Array.isArray(tree)) {
		tree.forEach((i) => stringifyObject(schema, i, $thing));
		return;
	}
	const thing = getSchemaByThing(schema, $thing || tree.$entity || tree.$relation || tree.$thing);
	Object.entries(tree).forEach(([k]) => {
		if (k.startsWith('$') || k.startsWith('%')) {
			return;
		}
		stringifyField(schema, tree, k, thing);
	});
};

const stringifyField = (
	schema: EnrichedBormSchema,
	tree: Record<string, any>,
	key: string,
	thing: EnrichedBormEntity | EnrichedBormRelation,
) => {
	const value = tree[key];
	if (!value) {
		// Not a JSON or a thing.
		return;
	}
	const dataField = thing.dataFields?.find((f) => f.path === key);
	if (dataField) {
		if (dataField.contentType === 'JSON') {
			if (value !== null && value !== undefined) {
				// eslint-disable-next-line no-param-reassign
				tree[key] = JSON.stringify(value);
			}
		}
		return;
	}
	const linkField = thing.linkFields?.find((f) => f.path === key);
	if (linkField) {
		const $thing = linkField.oppositeLinkFieldsPlayedBy[0]?.thing;
		stringifyObject(schema, value, $thing);
		return;
	}
	const refField = thing.refFields[key];
	if (refField) {
		if (Array.isArray(value)) {
			value.forEach((i) => {
				if (typeof i === 'object' && i !== null && '$thing' in i) {
					stringifyObject(schema, i, i.$thing);
				}
			});
		} else {
			if (typeof value === 'object' && value !== null && '$thing' in value) {
				stringifyObject(schema, value, value.$thing);
			}
		}
		return;
	}
	if (thing.thingType === 'relation') {
		const role = thing.roles[key];
		// Assume a role can be played by only one thing.
		if (!role) {
			throw new Error(`[Schema] Role/link field ${key} in ${thing.name} is not defined`);
		}
		const [oppositeThing] = role.playedBy || [];
		if (!oppositeThing) {
			throw new Error(`Role ${role.path} in ${thing} is not played by anything`);
		}
		stringifyObject(schema, value, oppositeThing.thing);
	}
};
