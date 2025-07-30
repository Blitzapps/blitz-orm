import { getCurrentFields, getCurrentSchema } from '../../../../helpers';
import type { BormOperation, BQLMutationBlock, EnrichedBormSchema } from '../../../../types';
import { validateOp } from './validateOp';

export const getOp = (node: BQLMutationBlock): BormOperation => {
  const usedFields = Object.keys(node).filter((key) => !(key.startsWith('$') || key.startsWith('%')));

  if (node.$op) {
    return node.$op as BormOperation;
  }
  if (node.$id || node.$filter) {
    if (usedFields.length > 0) {
      return 'update';
    }
    return 'link';
  }
  if (node.$tempId) {
    if (usedFields.length > 0) {
      return 'create'; //only difference is $id + stuff means update, while $tempIds are usually for creation and recovering it later from the res
    }
    return 'link';
  }
  return 'create';
};

export const getOpAndValidate = (
  parentNode: BQLMutationBlock,
  node: BQLMutationBlock,
  schema: EnrichedBormSchema,
): BormOperation => {
  const nodeSchema = getCurrentSchema(schema, node);
  const { usedFields } = getCurrentFields(nodeSchema, node);

  if (node.$op) {
    validateOp(parentNode, node, schema);
    return node.$op as BormOperation;
  }
  if (node.$id || node.$filter) {
    if (usedFields.length > 0) {
      validateOp(parentNode, { ...node, $op: 'update' }, schema);
      return 'update';
    }
    validateOp(parentNode, { ...node, $op: 'link' }, schema);
    return 'link';
  }
  if (node.$tempId) {
    if (usedFields.length > 0) {
      validateOp(parentNode, { ...node, $op: 'create' }, schema);
      return 'create'; //only difference is $id + stuff means update, while $tempIds are usually for creation and recovering it later from the res
    }
    validateOp(parentNode, { ...node, $op: 'create' }, schema);
    return 'link';
  }
  validateOp(parentNode, { ...node, $op: 'create' }, schema);
  return 'create';
};
