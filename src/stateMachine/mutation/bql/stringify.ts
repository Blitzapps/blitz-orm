import { produce } from 'immer';
import { getSchemaByThing } from '../../../helpers';
import type {
  BQLMutationBlock,
  EnrichedBQLMutationBlock,
  EnrichedBormEntity,
  EnrichedBormRelation,
  EnrichedBormSchema,
} from '../../../types';

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
  const thing = getSchemaByThing(schema, $thing || tree.$entity || tree.$relation || tree.$thing);
  Object.entries(tree).forEach(([k]) => {
    if (k.startsWith('$') || k.startsWith('%')) {
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
    const $thing = linkField.oppositeLinkFieldsPlayedBy[0]?.thing;
    tObject(schema, value, $thing);
    return;
  }

  const refField = 'refFields' in thing && thing.refFields[key];
  if (refField) {
    //We can't know its thing beforehand
    return;
  }

  if (thing.thingType === 'relation') {
    const role = thing.roles[key];
    // Assume a role can be played by only one thing.
    if (!role) {
      throw new Error(`[Schema] Role ${key} in ${thing.name} is not defined`);
    }
    const [oppositeThing] = role.playedBy || [];
    if (!oppositeThing) {
      throw new Error(`Role ${role.path} in ${thing} is not played by anything`);
    }
    tObject(schema, value, oppositeThing.thing);
  }
};
