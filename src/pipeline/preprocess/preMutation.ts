import { produce } from 'immer';
import { TraversalCallbackContext, traverse } from 'object-traversal';
import { isObject } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { BQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';

export const preMutation: PipelineOperation = async (req) => {
  const { filledBqlRequest, schema } = req;
  console.log('filledBqlRequest: ', JSON.stringify(filledBqlRequest, null, 2));

  console.log('schema: ', JSON.stringify(schema.relations.ThingRelation, null, 2));

  // @ts-expect-error
  const queryRes = await queryPipeline(filledBqlRequest, req.config, req.schema, req.dbHandles);
  // console.log('queryRes: ', JSON.stringify(queryRes, null, 2));
  // console.log('replaces: ', JSON.stringify(replaces, null, 2));
  // TODO: test for multiple entity/relation type replaces at onces
  const fillReplaces = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
    return produce(blocks, (draft) =>
      traverse(draft, ({ value: val, key, parent }: TraversalCallbackContext) => {
        if (!key?.includes('$') && (Array.isArray(val) || isObject(val))) {
          const values = Array.isArray(val) ? val : [val]; // Convert both array and single object into array for processing
          // Transform $op: "replace" to $op: "link"
          values.forEach((thing) => {
            if (thing.$op === 'replace') {
              thing.$op = 'link';
            }
          });

          // Extract IDs from queryRes
          let idsFromQueryRes: any[] = [];
          // @ts-expect-error
          const queryVal = queryRes[key];
          if (Array.isArray(queryVal)) {
            idsFromQueryRes = queryVal.map((thing) => (typeof thing === 'object' ? thing.$id : thing));
          } else if (typeof queryVal === 'string') {
            idsFromQueryRes = [queryVal];
          }
          // Get the dynamic $entity or $relation
          // // @ts-expect-error
          // const { thingType } = schema.relations.ThingRelation.roles[key].playedBy[0];
          // const thingValue = thingType === 'entity' ? 'Thing' : 'ThingRelation';
          // const thingKey = thingType === 'entity' ? '$entity' : '$relation';
          // For every ID in queryResult that's not in filledBqlRequest, add $op: "unlink"
          idsFromQueryRes.forEach((id: any) => {
            if (!values.some((thing: any) => thing.$id === id)) {
              const unlinkOp = {
                // TODO: get dynamic $entity or $relation
                // [thingKey]: thingValue,
                $entity: 'Thing',
                $op: 'unlink',
                $id: id,
                $bzId: `T_${uuidv4()}`,
              };
              if (Array.isArray(val)) {
                val.push(unlinkOp);
              } else {
                // If it's an object, replace the object with an array containing both the old and the new item
                // @ts-expect-error
                parent[key] = [val, unlinkOp];
              }
            }
          });
        }
      })
    );
  };

  // @ts-expect-error
  const filledReplaces = fillReplaces(filledBqlRequest);
  // console.log('filledReplaces: ', JSON.stringify(filledReplaces, null, 2));

  // @ts-expect-error
  req.filledBqlRequest = filledReplaces;
};
