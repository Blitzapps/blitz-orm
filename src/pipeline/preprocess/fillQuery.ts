import type { PipelineOperation } from '../pipeline';

export const fillBQLQuery: PipelineOperation = async (req) => {
  // const { rawBqlRequest, schema } = req;
  // const traversalFunction = (
  //   blocks: BQLQuer | BQLMutationBlock[]
  // ): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
  //   // @ts-expect-error
  //   return produce(blocks, (draft) =>
  //     traverse(draft, ({ parent, key, value: val, meta }: TraversalCallbackContext) => {
  //       if (isObject(val)) {
  //         if (Object.keys(val).length === 0) {
  //           throw new Error('Empty object!');
  //         }
  //         if (key === '$filter' || meta.nodePath?.includes('.$filter.')) {
  //           return;
  //         }
  //         const value = val as BQLMutationBlock;
  //       }
  //     })
  //   );
  // };
};
