import type { PipelineOperation, PipelineRequest, PipelineResponse } from '../pipeline';
import { buildTQLQuery } from './typeDB/buildTQLQuery';
export const buildDBQuery: PipelineOperation = async (req: PipelineRequest, res: PipelineResponse) => {
	const [{ provider }] = req.config.dbConnectors;

	if (provider === 'typeDB' || provider === 'typeDBCluster') {
		return buildTQLQuery(req, res);
	}
	if (provider === 'dgraph') {
		throw new Error('Not implemented');
	}
	throw new Error('Unexpected provider');
};
