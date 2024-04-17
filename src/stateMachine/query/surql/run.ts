import type { Surreal } from 'surrealdb.node';

export const run = async (props: { client: Surreal; queries: string[] }): Promise<any[][]> => {
	const { client, queries } = props;
	return await Promise.all(queries.map((query) => client.query(query)));
};
