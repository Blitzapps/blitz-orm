/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type { BQLMutationBlock, EnrichedLinkField, EnrichedRoleField } from '../../../../types';

export const preValidate = (
  node: BQLMutationBlock,
  field: string,
  fieldSchema: EnrichedLinkField | EnrichedRoleField,
  paths: string[],
) => {
  const subNodes = isArray(node[field]) ? node[field] : [node[field]];

  const cleanPath = paths.slice(1).join('.');
  subNodes.forEach((subNode: BQLMutationBlock) => {
    if (!subNode) {
      return;
    }
    /// For cardinality ONE, we need to specify the $op of the children
    if (
      fieldSchema?.cardinality === 'ONE' &&
      !subNode.$op &&
      !subNode.$id &&
      !subNode.$filter &&
      !subNode.$tempId &&
      node.$op !== 'create'
    ) {
      throw new Error(`Please specify if it is a create or an update. Path: ${cleanPath}.${field}`);
    }
    if (subNode.$tempId) {
      if (
        !(
          subNode.$op === undefined ||
          subNode.$op === 'link' ||
          subNode.$op === 'create' ||
          subNode.$op === 'update' ||
          subNode.$op === 'replace'
        )
      ) {
        throw new Error(
          `Invalid op ${subNode.$op} for tempId. TempIds can be created, or linked when created in another part of the same mutation.`,
        );
      }
    }
  });
};
