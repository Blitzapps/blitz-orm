/* eslint-disable no-param-reassign */
import { produce } from 'immer';
import { TraversalCallbackContext, traverse } from 'object-traversal';

function getCommonKey(obj1: Record<string, any>, obj2: Record<string, any>): string | undefined {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  const commonKeys = keys1.filter((key) => keys2.includes(key));

  const commonKeysWithStringOrNumber = commonKeys
    .find((key) => typeof obj1[key] === 'string' || typeof obj1[key] === 'number')
    ?.toString();
  if (commonKeysWithStringOrNumber) {
    return commonKeysWithStringOrNumber;
  }
  // todo: skip and filter by children keys?
  if (commonKeys) {
    throw new Error('Todo. Meanwhile get id of everything so you can sort by id(or other prop)');
  }
  return undefined;
}

const sortArrByIdOrString = (arr: any[], key?: string) =>
  arr.sort((a, b) => {
    if (key && a[key] && b[key]) return a[key].localeCompare(b[key]);
    if (a.$id && b.$id) return a.$id.localeCompare(b.$id);
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const cKey = getCommonKey(a, b);
      if (cKey) {
        return a[cKey].localeCompare(b[cKey]);
      }
      throw new Error(`Sorting objects that don't have a common key ${JSON.stringify(a)} ${JSON.stringify(b)}`);
    }
    throw new Error(`in sortArrByIdOrString a:${a} b:${b}`);
  });

// todo: once there are vectors, they will be indexed, which means we will need to treat those in an special way
export const deepSort = (obj: Record<string, any>, key?: string) => {
  const sort = ({ value }: TraversalCallbackContext) => {
    if (Array.isArray(value) && typeof value !== 'string') {
      value = sortArrByIdOrString(value, key);
      return value;
    }
    return value;
  };

  return produce(obj, (draft) => traverse(draft, sort));
};

export const deepRemoveMetaData = (obj: object) => {
  const removeMeta = ({ value }: TraversalCallbackContext) => {
    if (value && typeof value === 'object' && '$id' in value) {
      const metas = Object.keys(value).filter((k) => k.startsWith('$'));
      metas.forEach((k) => delete value[k]);
      const symbols = Object.keys(value).filter((s) => typeof s === 'symbol');
      symbols.forEach((s) => delete value[s]);
    }
    return value;
  };
  return produce(obj, (draft) => traverse(draft, removeMeta));
};
