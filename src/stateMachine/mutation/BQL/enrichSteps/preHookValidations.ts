/* eslint-disable no-param-reassign */
import { isArray } from 'radash';
import type { BQLMutationBlock, EnrichedBormSchema, EnrichedBQLMutationBlock } from '../../../../types';
import { getCurrentSchema } from '../../../../helpers';

export const preHookValidations = (node: BQLMutationBlock, field: string, schema: EnrichedBormSchema) => {
	const subNodes = isArray(node[field]) ? node[field] : [node[field]];
	subNodes.forEach((subNode: EnrichedBQLMutationBlock) => {
		if ('$thing' in subNode) {
			const { requiredFields, enumFields, fnValidatedFields, dataFields } = getCurrentSchema(schema, subNode);

			/// Required fields
			if ('$op' in subNode && subNode.$op === 'create') {
				requiredFields.forEach((field) => {
					if (!(field in subNode)) {
						throw new Error(`[Validations] Required field "${field}" is missing.`);
					}
				});
			}
			/// Enums
			if (('$op' in subNode && subNode.$op === 'update') || subNode.$op === 'create') {
				enumFields.forEach((field) => {
					if (field in subNode) {
						const enumOptions = dataFields?.find((df) => df.path === field)?.validations?.enum;
						if (!enumOptions) {
							throw new Error(`[Validations] Enum field "${field}" is missing enum options.`);
						}
						if (isArray(subNode[field])) {
							subNode[field].some((val: any) => {
								// @ts-expect-error - TODO
								if (!enumOptions.includes(val)) {
									throw new Error(`[Validations] Option "${val}" is not a valid option for field "${field}".`);
								}
							});
							//@ts-expect-error - TODO
						} else if (enumOptions && !enumOptions.includes(subNode[field])) {
							throw new Error(`[Validations] Option "${subNode[field]}" is not a valid option for field "${field}".`);
						}
					}
				});
			}
			/// fn
			if (('$op' in subNode && subNode.$op === 'update') || subNode.$op === 'create') {
				fnValidatedFields.forEach((field: string) => {
					if (field in subNode) {
						try {
							const fn = dataFields?.find((df) => df.path === field)?.validations?.fn;
							if (!fn) {
								throw new Error('Missing validation function.');
							}
							// @ts-expect-error - TODO
							if (!fn(subNode[field])) {
								throw new Error('Failed validation function.');
							}
						} catch (error: any) {
							throw new Error(`[Validations:attribute:${field}] ${error.message}`);
						}
					}
				});
			}
		}
	});
};
