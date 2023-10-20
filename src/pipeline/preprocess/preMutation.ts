import { produce } from 'immer';
import { TraversalCallbackContext, traverse } from 'object-traversal';
import { isObject } from 'radash';
import { v4 as uuidv4 } from 'uuid';

import { BQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';

export const preMutation: PipelineOperation = async (req) => {
  const { filledBqlRequest } = req;
  // TODO: check for replaces, if there are, perform pre-query
  const checkForReplaces = (blocks: BQLMutationBlock | BQLMutationBlock[]): boolean => {
    let hasReplace = false;

    traverse(blocks, ({ value: val }) => {
      if (val.$op === 'replace') {
        hasReplace = true;
        return false; // Stops the traversal once a replace is found
      }
      return true;
    });

    return hasReplace;
  };
  // @ts-expect-error
  const hasReplace = checkForReplaces(filledBqlRequest);

  if (hasReplace) {
    console.log('HAS REPLACE');
    // console.log('filledBqlRequest: ', JSON.stringify(filledBqlRequest, null, 2));
    // TODO: get filter replaces to work
    const convertMutationToQuery = (
      blocks: BQLMutationBlock | BQLMutationBlock[]
    ): BQLMutationBlock | BQLMutationBlock[] => {
      if (Array.isArray(blocks)) {
        const ids: string[] = [];
        let relation: string | null = null;
        let entity: string | null = null;
        traverse(blocks, ({ value: val, key, meta }: TraversalCallbackContext) => {
          // Only capture root level $relation, $entity, and $id
          if (meta.depth === 2) {
            // Extracting $relation or $entity
            if (key === '$relation') {
              relation = val;
            } else if (key === '$entity') {
              entity = val;
            } else if (key === '$id' && typeof val === 'string') {
              ids.push(val);
            }
          }
        });

        if (!relation && !entity) {
          throw new Error('Neither $relation nor $entity found in the blocks');
        }

        const result: any = { $id: ids };

        if (relation) {
          result.$relation = relation;
        }

        if (entity) {
          result.$entity = entity;
        }

        return result;
      }
      return blocks;
    };
    // @ts-expect-error
    const query = convertMutationToQuery(filledBqlRequest);
    // console.log('pre-query: ', query);

    // @ts-expect-error
    const queryRes = await queryPipeline(query, req.config, req.schema, req.dbHandles);
    // console.log('pre-queryRes: ', JSON.stringify(queryRes, null, 2));
    // TODO: test for multiple entity/relation type replaces at onces
    const fillReplaces = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
      return produce(blocks, (draft) =>
        traverse(draft, ({ value: val, key, parent }: TraversalCallbackContext) => {
          if (key && !key?.includes('$') && (Array.isArray(val) || isObject(val))) {
            const values = Array.isArray(val) ? val : [val];

            const currentEntityOrRelation: { $entity?: string; $relation?: string } = {};

            values.forEach((thing) => {
              if (thing.$op === 'replace') {
                thing.$op = 'link';
              }

              // Capture the current entity or relation
              if (thing.$entity) {
                currentEntityOrRelation.$entity = thing.$entity;
              } else if (thing.$relation) {
                currentEntityOrRelation.$relation = thing.$relation;
              }
            });

            let idsFromQueryRes: any[] = [];
            const matchingQueryObj = Array.isArray(queryRes)
              ? // @ts-expect-error
                queryRes.find((item) => item.$id === parent.$id)
              : queryRes;
            // @ts-expect-error
            const queryVal = matchingQueryObj ? matchingQueryObj[key] : null;
            if (Array.isArray(queryVal)) {
              idsFromQueryRes = queryVal.map((thing) => (typeof thing === 'object' ? thing.$id : thing));
            } else if (typeof queryVal === 'string') {
              idsFromQueryRes = [queryVal];
            }

            idsFromQueryRes.forEach((id: any) => {
              if (!values.some((thing: any) => thing.$id === id)) {
                const unlinkOp = {
                  ...currentEntityOrRelation,
                  $op: 'unlink',
                  $id: id,
                  $bzId: `T_${uuidv4()}`,
                };

                if (Array.isArray(val)) {
                  val.push(unlinkOp);
                } else {
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
  }
};
