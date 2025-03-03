/* eslint-disable no-param-reassign */
import { isArray, isObject } from 'radash';
import type {
  BQLMutationBlock,
  EnrichedBQLMutationBlock,
  EnrichedBormSchema,
  EnrichedLinkField,
  EnrichedRefField,
  EnrichedRoleField,
} from '../../../../types';
import { EdgeSchema, SharedMetadata } from '../../../../types/symbols';
import { get$bzId } from '../shared/get$bzId';
import { getOp } from '../shared/getOp';
import { getOppositePlayers } from '../shared/getOppositePlayers';

export const enrichChildren = (
  node: BQLMutationBlock,
  field: string,
  fieldSchema: EnrichedLinkField | EnrichedRoleField | EnrichedRefField,
  schema: EnrichedBormSchema,
) => {
  const newNodes = (isArray(node[field]) ? node[field] : [node[field]]).flatMap((subNode: EnrichedBQLMutationBlock) => {
    if (!fieldSchema) {
      throw new Error(`[Internal] No fieldSchema found in ${JSON.stringify(fieldSchema)}`);
    }

    const $op = getOp(subNode);
    const $bzId = get$bzId(subNode);

    if (fieldSchema[SharedMetadata].fieldType === 'refField') {
      const refSchema = fieldSchema as EnrichedRefField;

      if (!isObject(subNode)) {
        if (refSchema.contentType === 'FLEX') {
          return subNode;
        }
        throw new Error(`[Wrong format] The refField ${field} must receive an object`);
      }

      if (!subNode.$thing) {
        throw new Error('[Wrong format] The field $thing is required in refFields');
      }
      return { ...subNode, $op, $bzId };
    }

    const relationSchema = fieldSchema as EnrichedRoleField | EnrichedLinkField;

    if (relationSchema.$things.length === 0) {
      //todo: maybe add all the potential $things to a ref field?
      throw new Error(`[Internal error] The field ${field} can't be played by any thing.`);
    }

    const relFieldSchema = fieldSchema as EnrichedRoleField | EnrichedLinkField;

    if (relFieldSchema.$things.length === 1) {
      const oppositePlayers = getOppositePlayers(field, relationSchema);
      const [player] = oppositePlayers;

      if (subNode.$thing && subNode.$thing !== player.thing) {
        throw new Error(`[Wrong format] The field ${field} can only be played by ${player.thing}.`);
      }
      return {
        ...subNode,
        [EdgeSchema]: relFieldSchema,
        $thing: player.thing,
        $thingType: player.thing in schema.entities ? 'entity' : 'relation',
        $op,
        $bzId,
      };
    }
    if (relFieldSchema.$things.length > 1) {
      if (subNode.$thing) {
        return [
          {
            ...subNode,
            [EdgeSchema]: relFieldSchema,
            $thing: subNode.$thing,
            $thingType: subNode.$thing in schema.entities ? 'entity' : 'relation',
            $op,
            $bzId,
          },
        ];
      }
      if (!subNode.$thing) {
        if (subNode.$tempId) {
          throw new Error(
            '[Unsupported] Objects with $tempId and multiple potential players require to explicitly indicate the $thing type.',
          );
        }
        if ($op === 'create') {
          throw new Error(
            `[Wrong format] The field ${field} can be played by multiple things, please specify one on creation.`,
          );
        }

        return relFieldSchema.$things.map((thing) => {
          return {
            ...subNode,
            [EdgeSchema]: relFieldSchema,
            $thing: thing,
            $thingType: thing in schema.entities ? 'entity' : 'relation',
            $op,
            $bzId: get$bzId(subNode, thing),
            //[QueryContext]: { ...subNode[QueryContext], $multiThing: true }, //multiThing is used so the arcs of this manual split are merged in a single arc
          };
        });
      }
    }
    //#endregion nested nodes
  });

  if (isArray(node[field])) {
    node[field] = newNodes;
  } else {
    if (newNodes.length > 1) {
      //we might have added deduplicated things
      node[field] = newNodes;
    } else {
      // eslint-disable-next-line prefer-destructuring
      node[field] = newNodes[0];
    }
  }

  node[field] = isArray(node[field]) ? newNodes : newNodes[0];
};
