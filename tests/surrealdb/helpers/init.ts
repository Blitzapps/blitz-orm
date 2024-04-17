import { schema } from '../../mocks/schema';
import { config } from '../mocks/config';
import { setup } from '../../helpers/setup';

export const init = async () => setup({
		config,
		schema,
		tqlPathMap: {
		}
	});
