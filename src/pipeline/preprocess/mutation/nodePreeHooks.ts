import { produce } from 'immer';
import type { TraversalCallbackContext } from 'object-traversal';
import { traverse } from 'object-traversal';
import { isObject } from 'radash';

import type { FilledBQLMutationBlock } from '../../../types';
import type { PipelineOperation } from '../../pipeline';
import { computeNode } from '../../../engine/compute';

export const nodePreHooks: PipelineOperation = async (req) => {
	const { filledBqlRequest } = req;

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

	const transformNodes = (
		blocks: FilledBQLMutationBlock | FilledBQLMutationBlock[],
	): FilledBQLMutationBlock | FilledBQLMutationBlock[] => {
		return produce(blocks, (draft) =>
			traverse(draft, ({ value: val }: TraversalCallbackContext) => {
				if (isObject(val)) {
					// eslint-disable-next-line no-param-reassign
					//todo
				}
			}),
		);
	};

	const withTransformedNodes = transformNodes(withDefaultNodeAttributes);

	if (Array.isArray(withTransformedNodes)) {
		req.filledBqlRequest = withTransformedNodes as FilledBQLMutationBlock[];
	} else {
		// eslint-disable-next-line no-param-reassign
		req.filledBqlRequest = withTransformedNodes as FilledBQLMutationBlock;
	}
};
