import { mapEntries } from 'radash';

import type { BQLMutationBlock, PipelineOperation } from '../../../types';

//import type { TypeDbResponse } from '../../pipeline.ts.old';
type TypeDbResponse = any;

//@ts-expect-error todo: fix this
export const parseTQLMutation: PipelineOperation<TypeDbResponse> = async (req, res) => {
  const { bqlRequest, config, tqlRequest } = req;
  const { rawTqlRes } = res;

  if (!bqlRequest) {
    throw new Error('BQL request not parsed');
  }
  if (!rawTqlRes) {
    throw new Error('TQL query not executed');
  }
  const { query } = bqlRequest;

  // <--------------- MUTATIONS
  if (!query) {
    if (rawTqlRes.insertions?.length === 0 && !tqlRequest?.deletions) {
      // if no insertions and no delete operations
      res.bqlRes = {}; // return an empty object to continue further steps without error
      return;
    }
    const { mutation } = bqlRequest;
    if (!mutation) {
      throw new Error('TQL mutation not executed');
    }
    // console.log('config.mutation', config.mutation);

    // todo: check if something weird happened
    const expected = [...mutation.things, ...mutation.edges];
    const result = expected
      .map((exp) => {
        //! reads all the insertions and gets the first match. This means each id must be unique
        const currentNode = rawTqlRes.insertions?.find((y: any) => y.get(`${exp.$bzId}`))?.get(`${exp.$bzId}`);

        // console.log('current:', JSON.stringify(x));

        if (exp.$op === 'create' || exp.$op === 'update' || exp.$op === 'link') {
          const dbIdd = currentNode?.asThing().iid;
          if (config.mutation?.noMetadata) {
            return mapEntries(exp, (k: string, v) => [
              k.toString().startsWith('$') ? Symbol.for(k) : k,
              v,
            ]) as BQLMutationBlock;
          }
          return { $dbId: dbIdd, ...exp, ...{ [exp.path]: exp.$id } } as BQLMutationBlock;
        }
        if (exp.$op === 'delete' || exp.$op === 'unlink') {
          // todo when typeDB confirms deletions, check them here
          return exp as BQLMutationBlock;
        }
        if (exp.$op === 'match') {
          return undefined;
        }
        throw new Error(`Unsupported op ${exp.$op}`);

        // console.log('config', config);
      })
      .filter((z) => z);

    // todo
    res.bqlRes = result;
    //console.log('ParseTQLResultOld', result);
    return;
  }
};
