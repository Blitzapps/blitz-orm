import { isArray, isObject, shake } from 'radash';
import { getFieldType } from '../../../helpers';
import type { Filter, EnrichedBormSchema, EnrichedLinkField, EnrichedRoleField } from '../../../types';
import { SuqlMetadata } from '../../../types/symbols';

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
				if (key === '$not') {
					return { ...acc, $not: undefined, ['$!']: parseFilter(value, currentThing, schema) };
				}

				if (key === '$or') {
					return { ...acc, $or: undefined, $OR: parseFilter(value, currentThing, schema) };
				}

				if (key === '$and') {
					return { ...acc, $and: undefined, $AND: parseFilter(value, currentThing, schema) };
				}

				if (key === '$eq') {
					return { ...acc, '$nor': undefined, '$=': parseFilter(value, currentThing, schema) };
				}

				if (key === '$id') {
					return { ...acc, '$id': undefined, 'record::id(id)': { $IN: isArray(value) ? value : [value] } };
				}

				if (key === '$thing') {
					return acc; //do nothing for now, but in the future we will need to filter by tables as well, maybe record::tb(id) ...
				}

				return { ...acc, [key]: parseFilter(value, currentThing, schema) };
			}

			const currentSchema =
				currentThing in schema.entities ? schema.entities[currentThing] : schema.relations[currentThing];

			const [fieldType, fieldSchema] = getFieldType(currentSchema, key);

			if (fieldType === 'dataField') {
				if (currentSchema.idFields.length > 1) {
					throw new Error('Multiple id fields not supported');
				} //todo: When composed id, this changes:

				if (key === currentSchema.idFields[0]) {
					return { ...acc, 'record::id(id)': { $IN: isArray(value) ? value : [value] } };
				}

				return { ...acc, [key]: value }; //Probably good place to add ONLY and other stuff depending on the fieldSchema
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

export const buildSuqlFilter = (filter: object) => {
	if (filter === null || filter === undefined) {
		return '';
	}

	const entries = Object.entries(filter);

	const parts: string[] = [];

	entries.forEach(([key, value]) => {
		//TODO: probably better to do it by key first, instead of filtering by the type of value, but it works so to refacto once needed.

		if (['$OR', '$AND', '$!'].includes(key)) {
			const logicalOperator = key.replace('$', '');

			const nestedFilters = Array.isArray(value) ? value.map((v) => buildSuqlFilter(v)) : [buildSuqlFilter(value)];

			if (logicalOperator === '!') {
				parts.push(`!(${nestedFilters.join(` ${logicalOperator} `)})`);
			} else {
				parts.push(`(${nestedFilters.join(` ${logicalOperator} `)})`);
			}

			return;
		}

		if (isObject(value)) {
			if (key.includes('<-') || key.includes('->')) {
				const nestedFilter = buildSuqlFilter(value);

				parts.push(`${key}[WHERE ${nestedFilter}]`);
			} else if (key.startsWith('$parent')) {
				//mode: computed refs

				const nestedFilter = buildSuqlFilter(value);

				const keyWithoutPrefix = key.replace('$parent.', '');

				parts.push(`${keyWithoutPrefix}[WHERE ${nestedFilter}]`);
			} else if (key.startsWith('$')) {
				throw new Error(`Invalid key ${key}`);
			} else {
				if (Object.keys.length === 1 && Object.keys(value)[0].startsWith('$')) {
					// This is the case where the filter has an operator manually defined

					const [operator] = Object.keys(value);

					//@ts-expect-error its ok, single key

					const nextValue = value[operator];

					if (isArray(nextValue)) {
						parts.push(
							`${key} ${operator.replace('$', '')} [${nextValue.map((v) => (v === null ? 'NONE' : `'${v}'`)).join(', ')}]`,
						);
					} else if (isObject(nextValue)) {
						const nestedFilter = buildSuqlFilter(nextValue);

						parts.push(`${key} ${operator.replace('$', '')} ${nestedFilter}`);
					} else {
						parts.push(`${key} ${operator.replace('$', '')} ${nextValue === null ? 'NONE' : `'${nextValue}'`}`);
					}
				} else {
					throw new Error(`Invalid key ${key}`);
				}
			}
		} else {
			if (Array.isArray(value)) {
				const operator = key.startsWith('$') ? key.replace('$', '') : 'IN';

				parts.push(`${key} ${operator} [${value.map((v) => (v === null ? 'NONE' : `'${v}'`)).join(', ')}]`);
			} else {
				const operator = key.startsWith('$') ? key.replace('$', '') : '=';

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
