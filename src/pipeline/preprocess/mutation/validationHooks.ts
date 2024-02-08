import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';

import type { BormTrigger, FilledBQLMutationBlock, Hooks } from '../../../types';
import type { PipelineOperation } from '../../pipeline';
import { capitalizeFirstLetter, getParentNode } from '../../../helpers';
import { Schema } from '../../../types/symbols';

export const validationHooks: PipelineOperation = async (req) => {
	const { filledBqlRequest } = req;

	if (!filledBqlRequest) {
		throw new Error('Filled BQL request is missing');
	}

	const validateAttributes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val }: TraversalCallbackContext) => {
				if (isObject(val) && ('$entity' in val || '$relation' in val)) {
					const value = val as FilledBQLMutationBlock;

					const { requiredFields, enumFields, fnValidatedFields } = value[Schema];

					/// Required fields
					if ('$op' in value && value.$op === 'create') {
						requiredFields.forEach((field) => {
							if (!(field in value)) {
								throw new Error(`[Validations] Required field "${field}" is missing.`);
							}
						});
					}
					/// Enums
					if (('$op' in value && value.$op === 'update') || value.$op === 'create') {
						enumFields.forEach((field) => {
							if (field in value) {
								const enumOptions = value[Schema]?.dataFields?.find((df) => df.path === field)?.validations?.enum;
								if (!enumOptions) {
									throw new Error(`[Validations] Enum field "${field}" is missing enum options.`);
								}
								if (isArray(value[field])) {
									value[field].some((val: any) => {
										// @ts-expect-error - TODO
										if (!enumOptions.includes(val)) {
											throw new Error(`[Validations] Option "${val}" is not a valid option for field "${field}".`);
										}
									});
									//@ts-expect-error - TODO
								} else if (enumOptions && !enumOptions.includes(value[field])) {
									throw new Error(`[Validations] Option "${value[field]}" is not a valid option for field "${field}".`);
								}
							}
						});
					}
					/// fn
					if (('$op' in value && value.$op === 'update') || value.$op === 'create') {
						fnValidatedFields.forEach((field: string) => {
							if (field in value) {
								try {
									const fn = value[Schema]?.dataFields?.find((df) => df.path === field)?.validations?.fn;
									if (!fn) {
										throw new Error('Missing validation function.');
									}
									// @ts-expect-error - TODO
									if (!fn(value[field])) {
										throw new Error('Failed validation function.');
									}
								} catch (error: any) {
									throw new Error(`[Validations:attribute:${field}] ${error.message}`);
								}
							}
						});
					}
				}
			}),
		);
	};

	const validateNodes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val, parent, meta }: TraversalCallbackContext) => {
				if (isObject(val) && ('$entity' in val || '$relation' in val)) {
					const currentThing = '$entity' in val ? val.$entity : val.$relation;
					const value = val as FilledBQLMutationBlock;

					// @ts-expect-error - TODO
					const hooks = val[Symbol.for('schema')].hooks as Hooks;
					if (hooks) {
						const { pre } = hooks;
						if (pre) {
							const currentEvent = `on${capitalizeFirstLetter(value.$op)}` as BormTrigger;

							const currentHooks = pre.filter((hook) => hook.triggers[currentEvent]);

							currentHooks.forEach((hook) => {
								/// check if triggers are ... well... triggered!
								const triggerFunction = currentEvent in hook.triggers ? hook.triggers[currentEvent] : undefined;

								if (triggerFunction === undefined) {
									return;
								}
								/// todo: we will need to safely run all these fns in a sandbox
								if (triggerFunction()) {
									/// triggered, time to check its actions (maybe also a condition before but lets skip that for now)

									/// Same parentNode for all
									const parentNode = getParentNode(blocks, parent, meta);

									hook.actions.forEach((action) => {
										if (action.type === 'validate') {
											if (action.severity !== 'error') {
												return; // in borm we only use the errors
											}

											try {
												//!todo: use computeNode() in the future instead
												const validationResult = action.fn(value, parentNode);

												if (validationResult === false) {
													throw new Error(`${action.message}.`);
												}
												if (validationResult !== true) {
													throw new Error("Validation function's output is not a boolean value.");
												}
											} catch (error: any) {
												throw new Error(`[Validations:thing:${currentThing}] ${error.message}`);
											}
										}
									});
								}
							});
						}
					}
				}
			}),
		);
	};

	validateAttributes(filledBqlRequest);
	validateNodes(filledBqlRequest);
};
