import { isArray, isObject, shake } from 'radash';
import { getFieldType } from '../../../helpers';
import type { Filter, EnrichedBormSchema, EnrichedLinkField, EnrichedRoleField } from '../../../types';
import { SuqlMetadata } from '../../../types/symbols';

const surqlOperators = {
	$eq: '$=',
	$not: '$!',
	$or: '$OR',
	$and: '$AND',
	$in: '$IN',
	$id: 'record::id(id)',
	$exists: '$exists',
};

export const parseFilter = (filter: Filter, currentThing: string, schema: EnrichedBormSchema): Filter => {
	if (filter === null || filter === undefined) {
		return filter;
	}

	const wasArray = isArray(filter);

	const arrayFilter = wasArray ? filter : [filter];

	const resultArray = arrayFilter.map((f) => {
		const keys = Object.keys(f);

		const result = keys.reduce((acc, key) => {
			const value = f[key];

			if (key.startsWith('$')) {
				//LOGICAL OPERATORS
				if (['$or', '$and', '$not'].includes(key)) {
					return {
						...acc,
						[key]: undefined,
						[surqlOperators[key as keyof typeof surqlOperators]]: parseFilter(value, currentThing, schema),
					};
				}

				// FILTER OPERATORS
				if (key === '$id') {
					return { ...acc, $id: undefined, [surqlOperators[key]]: { $IN: isArray(value) ? value : [value] } };
				}
				if (key === '$thing') {
					return acc; //do nothing for now, but in the future we will need to filter by tables as well, maybe record::tb(id) ...
				}

				//AUXILIARY OPERATORS
				if (key === '$exists') {
					return { ...acc, $exists: undefined, [surqlOperators[key]]: value };
				}

				//VALUE OPERATORS
				if (key === '$eq') {
					return { ...acc, $eq: undefined, [surqlOperators[key]]: value };
				}
				if (key === '$in') {
					return { ...acc, $in: undefined, [surqlOperators[key]]: value };
				}

				throw new Error(`Unknown filter operator ${key}`);
				//return { ...acc, [key]: parseFilter(value, currentThing, schema) };
			}

			const currentSchema =
				currentThing in schema.entities ? schema.entities[currentThing] : schema.relations[currentThing];

			const [fieldType, fieldSchema] = getFieldType(currentSchema, key);

			if (fieldType === 'idField') {
				if (currentSchema.idFields.length > 1) {
					throw new Error('Multiple id fields not supported');
				} //todo: When composed id, this changes:

				return { ...acc, 'record::id(id)': { $IN: isArray(value) ? value : [value] } };
			}

			if (fieldType === 'dataField') {
				return { ...acc, [key]: parseFilter(value, currentThing, schema) }; //Probably good place to add ONLY and other stuff depending on the fieldSchema
			}

			if (fieldType === 'linkField' || fieldType === 'roleField') {
				const fieldSchemaTyped = fieldSchema as EnrichedLinkField | EnrichedRoleField;

				const surrealDBKey = fieldSchemaTyped[SuqlMetadata].queryPath;

				return { ...acc, [surrealDBKey]: parseFilter(value, currentThing, schema) };

				/*if (fieldSchemaTyped.$things.length !== 1) {
					console.warn(
						`Not supported yet: Role ${key} in ${JSON.stringify(value)} is played by multiple things: ${fieldSchemaTyped.$things.join(', ')}`,
					);

					return { ...acc, [surrealDBKey]: parseFilter(value, currentThing, schema) };
				}
				//todo: we need to be able to filter by fields that only belong to subtypes
				const [childrenThing] = fieldSchemaTyped.$things; //todo: multiple players, then it must be efined

				return { ...acc, [surrealDBKey]: parseFilter(value, childrenThing, schema) };*/
			}

			throw new Error(`Field ${key} not found in schema, Defined in $filter`);
		}, {});

		return shake(result);
	});

	return wasArray ? resultArray : resultArray[0];
};

export const buildSuqlFilter = (filter: object): string => {
	if (filter === null || filter === undefined) {
		return '';
	}

	const entries = Object.entries(filter);
	const parts: string[] = [];

	entries.forEach(([key, value]) => {
		// Handle logical operators
		if (['$OR', '$AND', '$!'].includes(key)) {
			const logicalOperator = key.replace('$', '');

			const nestedFilters = Array.isArray(value) ? value.map((v) => buildSuqlFilter(v)) : [buildSuqlFilter(value)];

			if (logicalOperator === '!') {
				// Correctly handle the negation
				parts.push(`!(${nestedFilters.join(' AND ')})`);
			} else {
				parts.push(`(${nestedFilters.join(` ${logicalOperator} `)})`);
			}
			return;
		}

		// Handle field-specific filters
		if (isObject(value)) {
			if (key.includes('<-') || key.includes('->')) {
				const nestedFilter = buildSuqlFilter(value);
				parts.push(`${key}[WHERE ${nestedFilter}]`);
			} else if (key.startsWith('$parent.[')) {
				// Handle references with cardinality MANY
				const nestedFilter = buildSuqlFilter(value);
				const keyWithoutPrefix = key.replace('$parent.', '').replace(/^\[(.*)\]$/, '$1');
				parts.push(`fn::as_array(${keyWithoutPrefix})[WHERE id && ${nestedFilter}]`);
			} else if (key.startsWith('$parent')) {
				// Handle references with cardinality ONE
				const nestedFilter = buildSuqlFilter(value);
				const keyWithoutPrefix = key.replace('$parent.', '');
				parts.push(`fn::as_array(${keyWithoutPrefix})[WHERE id && ${nestedFilter}]`);
			} else if (key.startsWith('$')) {
				throw new Error(`Invalid key ${key}`);
			} else {
				// Handle field operators
				const valueKeys = Object.keys(value);
				if (valueKeys.length === 1 && valueKeys[0].startsWith('$')) {
					const [operator] = valueKeys;
					//@ts-expect-error - Todo
					const nextValue: unknown = value[operator];

					if (operator === '$exists') {
						// Handle $exists operator
						if (nextValue === true) {
							parts.push(`${key} IS NOT NONE`);
						} else if (nextValue === false) {
							parts.push(`${key} IS NONE`);
						} else {
							throw new Error(`Invalid value for $exists: ${nextValue}`);
						}
					} else {
						// Handle other operators
						const surrealOperator = operator.replace('$', '');
						if (Array.isArray(nextValue)) {
							parts.push(
								`${key} ${surrealOperator} [${nextValue.map((v) => (v === null ? 'NONE' : `'${v}'`)).join(', ')}]`,
							);
						} else if (isObject(nextValue)) {
							const nestedFilter = buildSuqlFilter(nextValue);
							parts.push(`${key} ${surrealOperator} ${nestedFilter}`);
						} else {
							parts.push(`${key} ${surrealOperator} ${nextValue === null ? 'NONE' : `'${nextValue}'`}`);
						}
					}
				} else {
					throw new Error(`Invalid key ${key}`);
				}
			}
		} else {
			// Handle simple field equality
			if (Array.isArray(value)) {
				const operator = key.startsWith('$') ? key.replace('$', '') : 'IN'; //maybe  could do const operator = 'IN';
				parts.push(`${key} ${operator} [${value.map((v) => (v === null ? 'NONE' : `'${v}'`)).join(', ')}]`);
			} else {
				const operator = key.startsWith('$') ? key.replace('$', '') : '='; //maybe  could do const operator = '=';
				parts.push(`${key} ${operator} ${value === null ? 'NONE' : `'${value}'`}`);
			}
		}
	});

	return parts.join(' AND ');
};

export const buildSorter = (sort: ({ field: string; desc?: boolean } | string)[]) => {
	const sorters = sort.map((i) => {
		if (typeof i === 'string') {
			return i;
		}

		const { field, desc } = i;

		return `${field}${desc ? ' DESC' : ' ASC'}`;
	});

	return `ORDER BY ${sorters.join(', ')}`;
};
