import { produce } from 'immer';
import { TraversalCallbackContext, traverse } from 'object-traversal';
import { isObject } from 'radash';

import { BQLMutationBlock } from '../../types';
import { queryPipeline, type PipelineOperation } from '../pipeline';

export const preMutation: PipelineOperation = async (req) => {
  const { rawBqlRequest, schema } = req;
  // let replaces: { val: any; key: string }[] = [];
  const mutationToQuery = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
    return produce(blocks, (draft) =>
      traverse(draft, ({ value: val, key, parent }: TraversalCallbackContext) => {
        if (isObject(val)) {
          if (parent) {
            if (key !== '$filter') {
              // if (key && parent[key].$op === 'replace') {
              //   replaces = [...replaces, ...[{ val: parent[key], key }]];
              // }
              // @ts-expect-error
              parent[key] = undefined;
              parent.$fields = parent.$fields ? [...parent.$fields, ...[key]] : [key];
            }
          }
        }
      })
    );
  };
  const query = mutationToQuery(rawBqlRequest);
  console.log('bqlReq: ', JSON.stringify(query, null, 2));
  // @ts-expect-error
  const queryRes = await queryPipeline(query, req.config, req.schema, req.dbHandles);
  console.log('queryRes: ', JSON.stringify(queryRes, null, 2));
  console.log('rawBqlRequest: ', JSON.stringify(rawBqlRequest, null, 2));
  // console.log('replaces: ', JSON.stringify(replaces, null, 2));

  // queryRes:  [
  //   {
  //     "$relation": "ThingRelation",
  //     "things": [
  //       "thing5"
  //     ],
  //     "$id": "tr4"
  //   },
  //   {
  //     "$relation": "ThingRelation",
  //     "things": [
  //       "thing5"
  //     ],
  //     "$id": "tr2"
  //   },
  //   {
  //     "$relation": "ThingRelation",
  //     "things": [
  //       "thing5"
  //     ],
  //     "$id": "tr3"
  //   }
  // ]

  // rawBqlRequest:  {
  //   "$relation": "ThingRelation",
  //   "things": {
  //     "$op": "replace",
  //     "$id": "thing4"
  //   }
  // }
  // TODO: find a way to get replace keys
  const replaces = [{ entityType: 'relation', entityVal: 'ThingRelation', key: 'things', $id: 'thing4' }];
  const checkSchema = (blocks: BQLMutationBlock | BQLMutationBlock[]): BQLMutationBlock | BQLMutationBlock[] => {
    return produce(blocks, (draft) =>
      traverse(draft, ({ value: val, key, parent }: TraversalCallbackContext) => {
        if (isObject(val)) {
          if (!key?.includes('$')) {
            // @ts-expect-error
            if (parent) console.log('in things: ', JSON.stringify(parent[key], null, 2));
            const replace = replaces[0];

            if (parent && key) {
              const unlinks = Array.isArray(parent[key][replace.key])
                ? parent[key][replace.key].map((o: string) => {
                    return { $op: 'unlink', $id: o };
                  })
                : [];
              if (parent[key][replace.key]) {
                parent[key][replace.key] = [{ $op: 'link', $id: replace.$id }, ...unlinks];
              }
            }
          }
        }
      })
    );
  };
  // @ts-expect-error
  const checkedSchema = checkSchema(queryRes);
  console.log('checkedSchema: ', JSON.stringify(checkedSchema, null, 2));

  // checkedSchema:  [
  //   {
  //     "$relation": "ThingRelation",
  //     "things": [
  //       {
  //         "$op": "link",
  //         "$id": "thing4"
  //       },
  //       {
  //         "$op": "unlink",
  //         "$id": "thing5"
  //       }
  //     ],
  //     "$id": "tr4"
  //   },
  //   {
  //     "$relation": "ThingRelation",
  //     "things": [
  //       {
  //         "$op": "link",
  //         "$id": "thing4"
  //       },
  //       {
  //         "$op": "unlink",
  //         "$id": "thing5"
  //       }
  //     ],
  //     "$id": "tr2"
  //   },
  //   {
  //     "$relation": "ThingRelation",
  //     "things": [
  //       {
  //         "$op": "link",
  //         "$id": "thing4"
  //       },
  //       {
  //         "$op": "unlink",
  //         "$id": "thing5"
  //       }
  //     ],
  //     "$id": "tr3"
  //   }
  // ]
  // @ts-expect-error
  req.rawBqlRequest = checkedSchema;
};
