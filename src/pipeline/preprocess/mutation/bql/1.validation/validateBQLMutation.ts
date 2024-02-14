import type { MutationPipelineOperation } from '../../../../pipeline';
import { validateBQLMutation } from './traverses';

export const validateBQLMutationStep: MutationPipelineOperation = async (req) => {
	const { rawBqlRequest } = req;

	req.rawBqlRequest = validateBQLMutation(rawBqlRequest);
};
