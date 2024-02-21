import type {Pipeline} from '../../types/pipeline/base'
import type { BaseResponse } from '../../types'

type SurrealDbResponse = {

} & BaseResponse;

export const SurrealDbPipelines: Record<string, Pipeline<SurrealDbResponse>> = {
	query: [],
	mutation: [

	],
};