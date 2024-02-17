/* eslint-disable no-param-reassign */
// eslint-disable-next-line import/no-extraneous-dependencies
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';

const getCommonKey = (obj1: Record<string, any>, obj2: Record<string, any>): string | undefined => {
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
};

const sortArrByIdOrString = (arr: any[], key?: string) =>
	arr.sort((a, b) => {
		if (key && a[key] && b[key]) {
			return a[key].localeCompare(b[key]);
		}
		if (a.$id && b.$id) {
			return a.$id.localeCompare(b.$id);
		}
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

const checkRecursive = <T>(obj: T): T => {
	if (Array.isArray(obj)) {
		return expect.arrayContaining(obj.map(checkRecursive)) as unknown as T;
	}
	if (typeof obj === 'object' && obj !== null) {
		const newObj: { [key: string]: any } = {};
		Object.entries(obj).forEach(([key, value]) => {
			newObj[key] = checkRecursive(value);
		});
		return newObj as T;
	}
	return obj;
};

export const expectArraysInObjectToContainSameElements = <T extends any[]>(received: T, expected: T): void => {
	if (Array.isArray(received)) {
		expect(received.length).toEqual(expected.length);
		expect(received).toEqual(expect.arrayContaining(expected.map(checkRecursive)));
	} else if (typeof received === 'object' && received !== null) {
		Object.entries(received).forEach(([key, value]) => {
			// @ts-expect-error - TODO description
			expectArraysInObjectToContainSameElements(value, expected[key as keyof typeof expected]);
		});
	} else {
		if (typeof expected === 'string' && (expected as string).startsWith('$')) {
			return;
		}
		expect(received).toEqual(expected);
	}
};

export const expectResLikeTemplate = () => {};

/* //TODO probably using permutations
export const expectResLikeTemplate = (
  res: Record<string, any>,
  template: Record<string, any>,
  tempIds: Record<string, any> = {}
): Record<string, any> => {
  const findMatchesForTemplatesWithVars = (
    resItems: any[],
    currentTemplatesWithVars: any[],
    currentTempIds: Record<string, any>
  ): boolean => {
    if (currentTemplatesWithVars.length === 0) {
      return true;
    }

    const template = currentTemplatesWithVars[0];

    for (let i = 0; i < resItems.length; i += 1) {
      const resItem = resItems[i];
      const originalTempIds = { ...currentTempIds };
      if (typeof template === 'string' && !(template in currentTempIds)) {
        currentTempIds[template] = resItem;
      }
      if (expectResLikeTemplate(resItem, template, currentTempIds)) {
        const remainingResItems = [...resItems];
        remainingResItems.splice(i, 1);
        const remainingTemplatesWithVars = [...currentTemplatesWithVars];
        remainingTemplatesWithVars.shift();
        if (findMatchesForTemplatesWithVars(remainingResItems, remainingTemplatesWithVars, currentTempIds)) {
          return true;
        }
      }
      currentTempIds = originalTempIds;
    }
    return false;
  };

  const isMatch = Object.keys(template).every((key) => {
    if (Array.isArray(template[key])) {
      const templatesWithVars: any[] = [];
      const templatesWithoutVars: any[] = [];
      template[key].forEach((item: any) => {
        if (
          (typeof item === 'string' && item.startsWith('$')) ||
          (typeof item === 'object' &&
            Object.values(item).some((val: any) => typeof val === 'string' && val.startsWith('$')))
        ) {
          templatesWithVars.push(item);
        } else {
          templatesWithoutVars.push(item);
        }
      });

      templatesWithoutVars.every((item: any) => {
        const matchIndex = res[key].findIndex((resItem: any) => {
          return expectResLikeTemplate(resItem, item, { ...tempIds });
        });
        if (matchIndex !== -1) {
          res[key].splice(matchIndex, 1);
          return true;
        }
        return false;
      });

      return findMatchesForTemplatesWithVars(res[key], templatesWithVars, tempIds);
    }
    if (typeof template[key] === 'object' && template[key] !== null && !(template[key] instanceof Date)) {
      return expectResLikeTemplate(res[key], template[key], tempIds);
    }
    if (typeof template[key] === 'string' && template[key].startsWith('$')) {
      if (!(template[key] in tempIds)) {
        tempIds[template[key]] = res[key];
      }
      return res[key] === tempIds[template[key]];
    }
    return res[key] === template[key];
  });

  if (!isMatch) {
    throw new Error('No matching item found for template');
  }

  return tempIds;
};
*/
