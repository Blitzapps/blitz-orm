import { getCurrentFields, getCurrentSchema } from '../../helpers';
import type { PipelineOperation } from '../pipeline';

// parseBQLQueryObjectives:
// 1) Validate the query (getRawBQLQuery)
// 2) Prepare it in a universally way for any DB (output an enrichedBQLQuery)

export const parseBQLQuery: PipelineOperation = async (req) => {
  const { rawBqlRequest: rawBqlQuery, schema } = req;

  if (!('$entity' in rawBqlQuery) && !('$relation' in rawBqlQuery)) {
    throw new Error('No entity specified in query');
  }

  const currentSchema = getCurrentSchema(schema, rawBqlQuery);
  if (!currentSchema) {
    throw new Error(`Thing '${rawBqlQuery}' not found in schema`);
  }

  // @ts-expect-error
  const { unidentifiedFields, localFilters, nestedFilters } = getCurrentFields(
    currentSchema,
    rawBqlQuery
  );

  if (unidentifiedFields && unidentifiedFields.length > 0) {
    throw new Error(
      `Unknown fields: [${unidentifiedFields.join(',')}] in ${JSON.stringify(
        rawBqlQuery
      )}`
    );
  }

  req.bqlRequest = {
    // todo
    // @ts-expect-error
    query: {
      ...req.rawBqlRequest,
      // $entity: { name: defaultPath, definition: bormEntity },
      ...(currentSchema.thingType === 'entity'
        ? { $entity: currentSchema }
        : {}),
      ...(currentSchema.thingType === 'relation'
        ? { $relation: currentSchema }
        : {}),
      ...(localFilters ? { $localFilters: localFilters } : {}),
      ...(nestedFilters ? { $nestedFilters: nestedFilters } : {}),
    },
  };
};
