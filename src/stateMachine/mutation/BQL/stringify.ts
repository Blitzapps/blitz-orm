import { getThing } from '../../../helpers';
import type {
	BQLMutationBlock,
	EnrichedBQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
	EnrichedBormSchema,
	EnrichedLinkField,
	LinkedFieldWithThing,
} from '../../../types';
import { produce } from 'immer';

/**
 * Convert JSON attributes into strings.
 */
export const stringify = (
	blocks: BQLMutationBlock | BQLMutationBlock[],
	schema: EnrichedBormSchema,
): EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[] => {
	const result = produce(blocks, (draft) => tObject(schema, draft));
	return result as EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[];
};

/**
 * Specify $thing if the role (target: relation) or the opposite role (target: role)
 * is played by one thing, otherwise $thing, $relation, or $entity must be defined
 * in the mutation object.
 */
const tObject = (
	schema: EnrichedBormSchema,
	tree: Record<string, any> | string | (Record<string, any> | string)[],
	$thing?: string,
) => {
	if (typeof tree === 'string') {
		// It's an id.
		return;
	}
	if (Array.isArray(tree)) {
		tree.forEach((i) => tObject(schema, i, $thing));
		return;
	}
	const thing = getThing(schema, $thing || tree.$entity || tree.$relation || tree.$thing);
	Object.entries(tree).forEach(([k]) => {
		if (k.startsWith('$')) {
			return;
		}
		tField(schema, tree, k, thing);
	});
};

const tField = (
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
		linkField.oppositeLinkFieldsPlayedBy;
		const $thing = getLinkFieldThing(linkField, schema);
		tObject(schema, value, $thing);
		return;
	}
	if (thing.thingType === 'relation') {
		const role = thing.roles[key];
		const $thing = getRoleThing(role, thing);
		tObject(schema, value, $thing);
	}
};

const getLinkFieldThing = (linkField: EnrichedLinkField, schema: EnrichedBormSchema) => {
	if (linkField.target === 'relation') {
		return linkField.relation;
	}
	const intermediaryRelation = getThing(schema, linkField.relation);
	if (intermediaryRelation.thingType !== 'relation') {
		throw new Error('An entity cannot be used as intermediary relation');
	}
	const [, oppositeRole] = Object.entries(intermediaryRelation.roles)?.find(([k]) => k !== linkField.name) || [];
	if (!oppositeRole) {
		throw new Error(`The opposite role of ${linkField.path} in ${JSON.stringify(intermediaryRelation)} does not exist`);
	}
	return getRoleThing(oppositeRole, intermediaryRelation);
};

const getRoleThing = (role: { name: string; playedBy?: LinkedFieldWithThing[] }, relation: EnrichedBormRelation) => {
	if (role.playedBy && role.playedBy.length > 1) {
		// Can't infer the $thing.
		// The mutation must include $thing, $relation, or $entity
		return;
	}
	const [oppositeThing] = role.playedBy || [];
	if (!oppositeThing) {
		throw new Error(`Role ${role.name} in ${relation} is not played by anything`);
	}
	return oppositeThing.thing;
};
