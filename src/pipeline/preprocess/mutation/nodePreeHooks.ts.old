import { current, isDraft, produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isArray, isObject } from 'radash';

import type { FilledBQLMutationBlock, TransFormAction } from '../../../types';
import type { TypeDbResponse } from '../../pipeline'
import type { PipelineOperation } from '../../../types';
import { computeNode } from '../../../engine/compute';
import { getTriggeredActions } from './hooks/utils';
import { getParentNode, isBQLBlock } from '../../../helpers';

export const nodePreHooks: PipelineOperation<TypeDbResponse> = async (req) => {
	const { filledBqlRequest, schema } = req;

	if (!filledBqlRequest) {
		throw new Error('Filled BQL request is missing');
	}

	const defaultNodeAttributes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val }: TraversalCallbackContext) => {
				if (isObject(val)) {
					//todo
					computeNode();
					// eslint-disable-next-line no-param-reassign
				}
			}),
		);
	};

	const withDefaultNodeAttributes = defaultNodeAttributes(filledBqlRequest);

	//we add a root array so we can transform the root element if it is alone
	const toGetTransformed = isArray(withDefaultNodeAttributes) ? withDefaultNodeAttributes : [withDefaultNodeAttributes];

	const transformNodes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val, parent, key, meta }: TraversalCallbackContext) => {
				if (isBQLBlock(val)) {
					if (!parent || key === undefined || key === null) {
						throw new Error(
							'[Internal] Parent is missing, should not happen as we artificially have always a root array',
						);
					}
					const triggeredActions = getTriggeredActions(val, schema).filter(
						(action) => action.type === 'transform',
					) as TransFormAction[];

					const parentNode = structuredClone(getParentNode(blocks, parent, meta));
					const currentNode = isDraft(val) ? current(val) : val;
					const sanitizedCurrentNode = structuredClone(currentNode);

					triggeredActions.forEach((action) => {
						//! Todo: Sandbox the function in computeFunction()
						const newProps = action.fn(sanitizedCurrentNode, parentNode);
						if (Object.keys(newProps).length === 0) {
							return;
						}
						// eslint-disable-next-line no-param-reassign
						parent[key] = { ...currentNode, ...newProps };
					});
				}
			}),
		);
	};

	//console.log('toGetTransformed', toGetTransformed);
	const withTransformedNodes = transformNodes(toGetTransformed);
	//console.log('withTransformedNodes', withTransformedNodes);

	if (!isArray(withTransformedNodes)) {
		throw new Error('[Internal] withTransformedNodes is not an array');
	}
	if (withTransformedNodes.length > 1) {
		req.filledBqlRequest = withTransformedNodes as FilledBQLMutationBlock[];
	} else {
		// eslint-disable-next-line no-param-reassign
		req.filledBqlRequest = withTransformedNodes[0] as FilledBQLMutationBlock;
	}
};
