import { schema } from '../../mocks/schema';
import { config } from '../mocks/config';
import { setup } from '../../helpers/setup';

export const init = async () => setup({
		config,
		schema,
		tqlPathMap: {
			default: {
				schema: './tests/typedb/mocks/schema.tql',
				data: './tests/typedb/mocks/data.tql',
			},
		}
	});
