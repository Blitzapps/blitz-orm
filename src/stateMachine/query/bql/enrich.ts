import { produce } from 'immer';
import type {
	BQLMutationBlock,
	EnrichedBormEntity,
	EnrichedBormRelation,
  RawBQLQuery,
  EnrichedBQLQuery,
  EnrichedBormSchema,
  EnrichedAttributeQuery,
  EnrichedLinkQuery,
  EnrichedRoleQuery,
  Filter,
  PositiveFilter,
} from '../../../types';
import { traverse } from 'object-traversal';
import { getCurrentSchema } from '../../../helpers';
import { isObject } from 'radash';
import { QueryPath } from '../../../types/symbols';

export const enrichBQLQuery = (rawBqlQuery: RawBQLQuery[], schema: EnrichedBormSchema): EnrichedBQLQuery[] => {
  for (const item of rawBqlQuery) {
    if (!('$entity' in item) && !('$relation' in item) && (!('$thing' in item) || !('$thingType' in item))) {
      throw new Error('No entity specified in query');
    }
  }

  const batches = Array.isArray(rawBqlQuery) ? rawBqlQuery : [rawBqlQuery];

  // TODO: The raw query and the enriched query have different type.
  // Instead of mutating the existing object (copy + mutate)
  // replace `produce` and `traverse` with a function that returns a new object.
  // This way we don't need to force the enriched query (RawBQLQuery that has been mutated)
  // to have type EnrichedBQLQuery, thus we get better type check.
  const enriched = produce(batches, (draft: any) =>
    traverse(draft, (context) => {
      const { value: val, meta } = context;
      const value: BQLMutationBlock = val;
      if (isObject(value)) {
        // 1. Moving $id into filter based on schema's idFields
        if (value.$id) {
          const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
          const currentSchema = getCurrentSchema(schema, node);
          if (!currentSchema?.name) {
            throw new Error(`Schema not found for ${value.$thing}`);
          }
          value.$path = currentSchema.name;
          if (!Array.isArray(value.$id)) {
            value.$filterByUnique = true;
          }
          // todo: composite ids
          if (currentSchema?.idFields?.length === 1) {
            const [idField] = currentSchema.idFields;
            value.$filter = { ...value.$filter, ...{ [idField]: value.$id } };
            delete value.$id;
          } else {
            throw new Error('Multiple ids not yet enabled / composite ids');
          }
        } else if ('$entity' in value || '$relation' in value || '$thing' in value) {
          const currentSchema = getCurrentSchema(schema, value);
          if (!currentSchema?.name) {
            throw new Error(`Schema not found for ${value.$thing}`);
          }
          value.$path = currentSchema.name;
        }
        // 2. Converting $entity or $relation into $thingType and $thing
        if (value.$entity) {
          value.$thing = value.$entity;
          value.$thingType = 'entity';
          delete value.$entity;
        } else if (value.$relation) {
          value.$thing = value.$relation;
          value.$thingType = 'relation';
          delete value.$relation;
        }

        if (isObject(value) && '$thing' in value) {
          const node = value.$entity || value.$relation ? value : { [`$${value.$thingType}`]: value.$thing };
          value[QueryPath as any] = meta.nodePath;
          const currentSchema = getCurrentSchema(schema, node);
          if (value.$filter) {
            value.$filterByUnique = checkFilterByUnique(value.$filter, currentSchema);
            if (!value.$filterProcessed) {
              value.$filter = value.$filter && mapFilterKeys(value.$filter, currentSchema);
            }
          }
          // if no fields, then it's all fields
          if (value.$fields) {
            const idFieldIncluded =
              value.$fields.filter(
                (field: any) =>
                  currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
              ).length > 0;
            if (!idFieldIncluded) {
              value.$fields = [
                ...value.$fields,
                ...(Array.isArray(currentSchema.idFields) ? currentSchema.idFields : []),
              ];
              value.$idNotIncluded = true;
            }
            const newFields = value.$fields
              ?.flatMap((field: any) => {
                const processed = processField(field, currentSchema, schema);
                if (Array.isArray(processed)) {
                  return processed;
                } else {
                  return [processed];
                }
              })
              .filter(Boolean);
            value.$fields = newFields;
          } else {
            const allFields = getAllFields(currentSchema);
            const newFields = allFields
              ?.flatMap((field: any) => {
                const processed = processField(field, currentSchema, schema);
                if (Array.isArray(processed)) {
                  return processed;
                } else {
                  return [processed];
                }
              })
              .filter(Boolean);
            value.$fields = newFields;
          }

          if (value.$excludedFields) {
            value.$fields = value.$fields.filter((f: { $path: string }) => {
              if (isId(currentSchema, f)) {
                return true;
              }
              return !value.$excludedFields.includes(f.$path);
            });
          }
        }
      }
    }),
  );

  return enriched as EnrichedBQLQuery[];
};

const getAllFields = (currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const dataFields = currentSchema.dataFields?.map((field: any) => field.path) || [];
	const linkFields = currentSchema.linkFields?.map((field: any) => field.path) || [];
	const roleFields = Object.keys((currentSchema as EnrichedBormRelation).roles || {}) || [];
	const allFields = [...dataFields, ...linkFields, ...roleFields];
	return allFields;
};

const checkFilterByUnique = ($filter: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
	const fields = Object.keys($filter || {});

	return fields.some((field) => {
		if (!Array.isArray($filter[field])) {
			const isIdField = currentSchema.idFields?.includes(field);
			const isUniqueDataField = currentSchema.dataFields?.some(
				(f) => (f.dbPath === field || f.path === field) && f?.validations?.unique,
			);

			return isIdField || isUniqueDataField;
		}
		return false;
	});
};

const mapFilterKeys = (filter: Filter, thingSchema: EnrichedBormEntity | EnrichedBormRelation) => {
  const mapper: Record<string, string> = {};

  thingSchema.dataFields?.forEach((df) => {
    if (df.path !== df.dbPath) {
      mapper[df.path] = df.dbPath;
    }
  });

  if (Object.keys(mapper).length === 0) {
    return filter;
  }

  const { $not, ...f } = filter;
  const newFilter: Filter = mapPositiveFilterKeys(f, mapper);

  if ($not) {
    newFilter.$not = mapPositiveFilterKeys($not as PositiveFilter, mapper);
  }

  return newFilter;
};

const mapPositiveFilterKeys = (filter: PositiveFilter, mapper: Record<string, string>) => {
  const newFilter: PositiveFilter = {};
  Object.entries(filter).forEach(([key, filterValue]) => {
    const newKey = mapper[key] || key;
    newFilter[newKey] = filterValue;
  });
  return newFilter;
};

const isId = (currentSchema: EnrichedBormEntity | EnrichedBormRelation, field: any) =>
  typeof field === 'string' ? currentSchema.idFields?.includes(field) : currentSchema.idFields?.includes(field.$path);

const createDataField = (props: {
  field: any,
  fieldStr: string,
  $justId: boolean,
  dbPath: string,
  isVirtual?: boolean;
}): EnrichedAttributeQuery => {
  const { field, fieldStr, $justId, dbPath, isVirtual } = props;
  // todo: get all dependencies of the virtual field in the query and then remove from the output
  return {
    $path: fieldStr,
    $dbPath: dbPath,
    $thingType: 'attribute',
    $as: field.$as || fieldStr,
    $var: fieldStr,
    $fieldType: 'data',
    $justId,
    $id: field.$id,
    $isVirtual: isVirtual,
  };
};

const createLinkField = (props: {
  field: any;
  fieldStr: string;
  linkField: any;
  $justId: boolean;
  dbPath: string;
  schema: EnrichedBormSchema;
}): EnrichedLinkQuery => {
  const { field, fieldStr, linkField, $justId, dbPath, schema } = props;
  const { target, oppositeLinkFieldsPlayedBy } = linkField;
  return oppositeLinkFieldsPlayedBy.map((playedBy: any) => {
    const $thingType = target === 'role' ? playedBy.thingType : 'relation';
    const $thing = target === 'role' ? playedBy.thing : linkField.relation;
    const node = { [`$${$thingType}`]: $thing };
    const currentSchema = getCurrentSchema(schema, node);
    const idNotIncluded = field?.$fields?.filter((f: any) => isId(currentSchema, f)).length === 0;

    let fields = [];
    if (typeof field !== 'string') {
      if (field.$fields) {
        if (idNotIncluded) {
          const idFields = currentSchema.idFields || [];
          fields = [...field.$fields, ...idFields];
        } else {
          fields = field.$fields;
        }
      } else {
        fields = getAllFields(currentSchema);
      }
    } else {
      fields = ['id'];
    }

    if (field.$excludedFields) {
      fields = fields.filter((f: { $path: string }) => {
        if (isId(currentSchema, f)) {
          return true;
        }
        return !field.$excludedFields.includes(f.$path);
      });
    }

    return {
      $thingType,
      $plays: linkField.plays,
      $playedBy: playedBy,
      $path: playedBy.path,
      $dbPath: dbPath,
      $as: field.$as || fieldStr,
      $var: fieldStr,
      $thing,
      $fields: fields,
      $excludedFields: field.$excludedFields,
      $fieldType: 'link',
      $target: target,
      $intermediary: playedBy.relation,
      $justId,
      $id: field.$id,
      $filter: field.$filter && mapFilterKeys(field.$filter, currentSchema),
      $idNotIncluded: idNotIncluded,
      $filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
      $filterProcessed: true,
      $sort: field.$sort,
      $offset: field.$offset,
      $limit: field.$limit,
    };
  });
};

const createRoleField = (props: {
  field: any;
  fieldStr: string;
  roleField: any;
  $justId: boolean;
  dbPath: string;
  schema: EnrichedBormSchema;
}): EnrichedRoleQuery => {
  const { field, fieldStr, roleField, $justId, dbPath, schema } = props;

  return roleField.playedBy.map((playedBy: any) => {
    const { thing, thingType, relation } = playedBy;
    const node = { [`$${thingType}`]: thing };
    const currentSchema = getCurrentSchema(schema, node);
    const idNotIncluded =
      field?.$fields?.filter(
        (field: any) => currentSchema?.idFields?.includes(field) || currentSchema?.idFields?.includes(field.$path),
      ).length === 0;

    let fields = [];
    if (typeof field !== 'string') {
      if (field.$fields) {
        if (idNotIncluded) {
          const idFields = currentSchema.idFields || [];
          fields = [...field.$fields, ...idFields];
        } else {
          fields = field.$fields;
        }
      } else {
        fields = getAllFields(currentSchema);
      }
    } else {
      fields = ['id'];
    }

    if (field.$excludedFields) {
      fields = fields.filter((f: { $path: string }) => {
        if (isId(currentSchema, f)) {
          return true;
        }
        return !field.$excludedFields.includes(f.$path);
      });
    }

    return {
      $thingType: thingType,
      $path: fieldStr,
      $dbPath: dbPath,
      $as: field.$as || fieldStr,
      $var: fieldStr,
      $thing: thing,
      $fields: fields,
      $excludedFields: field.$excludedFields,
      $fieldType: 'role',
      $intermediary: relation,
      $justId,
      $id: field.$id,
      $filter: field.$filter && mapFilterKeys(field.$filter, currentSchema),
      $idNotIncluded: idNotIncluded,
      $filterByUnique: checkFilterByUnique(field.$filter, currentSchema),
      $playedBy: playedBy,
      $filterProcessed: true,
      $sort: field.$sort,
      $offset: field.$offset,
      $limit: field.$limit,
    };
  });
};

const processField = (field: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation, schema: EnrichedBormSchema) => {
  const fieldStr = typeof field === 'string' ? field : field.$path;
  const $justId = typeof field === 'string';
  const dataField = currentSchema.dataFields?.find((dataField: any) => dataField.path === fieldStr);
  const linkField = currentSchema.linkFields?.find((linkField: any) => linkField.path === fieldStr);
  const roleField = (currentSchema as EnrichedBormRelation).roles?.[fieldStr];

  if (dataField) {
    const isVirtual = !!dataField.isVirtual && !!dataField.default; //if there is no default value, then is fully virtual, the computing is managed in the DB
    return createDataField({
      field,
      fieldStr,
      $justId,
      dbPath: dataField.dbPath,
      isVirtual,
    }); //ignore computed ones
  } else if (linkField) {
    return createLinkField({
      field,
      fieldStr,
      linkField,
      $justId,
      dbPath: linkField.path,
      schema,
    });
  } else if (roleField) {
    return createRoleField({
      field,
      fieldStr,
      roleField,
      $justId,
      dbPath: fieldStr,
      schema,
    });
  }
  return null;
};
