import type { PipelineOperation } from '../pipeline';

export const processIdOperator: PipelineOperation = async (req, res) => {
	const { bqlRequest } = req;
	const { bqlRes } = res;
	if (!bqlRequest?.query) {
		return;
	}
	if (!bqlRes) {
		throw new Error('BQL response not parsed');
	}
	const { query } = bqlRequest;
	if (query.$id && Array.isArray(bqlRes)) {
		if (Array.isArray(query.$id)) {
			const filtered = bqlRes.filter(
				(row) => row !== null && query.$id?.includes(typeof row === 'string' ? row : row.$id),
			);
			res.bqlRes = filtered;
		} else {
			const found = bqlRes.find((row) => row !== null && (typeof row === 'string' ? row : row.$id) === query.$id);
			res.bqlRes = found ?? null;
		}
	}
};
