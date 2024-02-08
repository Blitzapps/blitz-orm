import { isObject } from 'radash';
import type { PipelineOperation } from '../../pipeline';
import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { getNodeByPath, traverse } from 'object-traversal';
import { getCurrentSchema } from '../../../helpers';
import { computeField } from '../../../engine/compute';
import { QueryPath } from '../../../types/symbols';

export const postHooks: PipelineOperation = async (req, res) => {
	const { schema, enrichedBqlQuery } = req;
	const { bqlRes } = res;

	if (!bqlRes) {
		return;
	}

	const queryPostHooks = (blocks: any) => {
		return produce(blocks, (draft: any) =>
			traverse(draft, ({ value: val }: TraversalCallbackContext) => {
				if (isObject(val)) {
					const value = val as Record<string, any>;

					if (!value.$thing) {
						throw new Error('[Internal] Thing is missing');
					}
					if (value.$thing) {
						const currentSchema = getCurrentSchema(schema, value);
						const { virtualFields } = currentSchema;

						const queryPath = value[QueryPath as any];
						if (!queryPath) {
							throw new Error('[Internal] QueryPath is missing');
						}

						const originalNode = getNodeByPath(enrichedBqlQuery, queryPath);
						const queriedFields = originalNode.$fields.map((f: any) => f.$path);
						const excludedFields = originalNode.$excludedFields;

						/// ADD VIRTUAL FIELDS
						virtualFields.forEach((virtualFieldPath) => {
							if (
								excludedFields?.includes(virtualFieldPath) ||
								(queriedFields.length > 0 && !queriedFields.includes(virtualFieldPath))
							) {
								return;
							}
							const field = currentSchema.dataFields?.find((f) => f.path === virtualFieldPath);

							//@ts-expect-error - todo: make computeField compatible with BQLQueryBlock
							const computedValue = computeField({ currentThing: value, fieldSchema: field });
							value[virtualFieldPath] = computedValue;
						});

						//EXCLUDE FIELDS
						if (excludedFields) {
							//this should only happen for id fields, as we query them always. Might remove also dependencies in the future
							excludedFields.forEach((excludedField: string) => {
								if (typeof excludedField !== 'string') {
									throw new Error('[Internal] ExcludedField is not a string');
								}
								delete value[excludedField];
							});
						}
					}
				}
			}),
		);
	};

	const postHooksBqlRes = queryPostHooks(bqlRes);
	// console.log('parsedTqlRes', JSON.stringify(parsedTqlRes, null, 2));
	res.bqlRes = postHooksBqlRes;
	// console.log('enrichedBqlQuery', JSON.stringify(enrichedBqlQuery, null, 2));
};
