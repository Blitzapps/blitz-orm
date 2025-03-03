import type { BQLMutationBlock, EnrichedDataField } from '../types';
import { getParamNames } from './helpers';

export const computeField = ({
  currentThing,
  fieldSchema,
  mandatoryDependencies = false,
}: {
  currentThing: BQLMutationBlock;
  fieldSchema?: EnrichedDataField;
  mandatoryDependencies?: boolean;
}) => {
  if (!fieldSchema || !fieldSchema.default || !('fn' in fieldSchema.default || 'value' in fieldSchema.default)) {
    throw new Error(
      `[Internal] Virtual field: No field schema found, or wrongly configured. Field: ${JSON.stringify(fieldSchema, null, 3)}`,
    );
  }

  //check if all the args are in the entity, if not, throw a missing error with all the not present ones

  if (fieldSchema.default.type === 'value') {
    return fieldSchema.default.value;
  }

  if (mandatoryDependencies) {
    const { fn } = fieldSchema.default;

    const args = getParamNames(fn);
    const missingArgs = args.filter((arg) => !(arg in currentThing));

    if (missingArgs.length) {
      throw new Error(`Virtual field: Missing arguments ${missingArgs.join(', ')}`);
    }
  }
  if (!fieldSchema.default.fn) {
    throw new Error('[Schema] No fn in default field schema');
  }
  if ('default' in fieldSchema) {
    //@ts-expect-error can't find the issue, all subtypes have a value type, and a fn type
    if (fieldSchema.default.type === 'value') {
      //@ts-expect-error can't find the issue, all subtypes have a value type, and a fn type
      return fieldSchema.default.value;
    }
    if (fieldSchema.default.type === 'fn') {
      return fieldSchema.default.fn(currentThing);
    }

    throw new Error('[Schema] No default field definition');
  }
};

export const computeNode = () => {};
