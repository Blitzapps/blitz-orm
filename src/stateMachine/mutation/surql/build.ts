import { listify } from 'radash';
import type { ContentType, EnrichedBQLMutationBlock, EnrichedBormSchema } from '../../../types';
import { Schema } from '../../../types/symbols';
import { buildSuqlFilter, parseFilter } from '../../query/surql/build';

const prepareValue = (value: unknown, contentType: ContentType) => {
	if (['ID', 'TEXT'].includes(contentType)) {
		return `"${value}"`;
	}
	if (['NUMBER', 'BOOLEAN'].includes(contentType)) {
		return value;
	}
};

export const buildSurqlMutation = async (
	things: EnrichedBQLMutationBlock[],
	//edges: EnrichedBQLMutationBlock,
	schema: EnrichedBormSchema,
) => {
	const $things = [...new Set(things.map((thing) => thing.$thing))] as string[];
	const $thingsDataFields = Object.fromEntries(
		$things.map(($thing) => [
			$thing,
			Object.fromEntries(
				things.find((thing) => thing.$thing === $thing)?.[Schema].dataFields?.map((df) => [df.path, df.contentType]) ||
					[],
			),
		]),
	);

	const thingCreations = things
		.filter((t) => t.$op === 'create')
		.map((thing) => {
			const dataValues = listify(thing, (df: string, val) => {
				if (df.startsWith('$')) {
					return undefined;
				}
				const thingDataFields = $thingsDataFields[thing.$thing];
				if (!thingDataFields) {
					throw new Error(`No data fields found for ${thing.$thing}`);
				}
				return thingDataFields[df] ? `${df}= ${prepareValue(val, thingDataFields[df])}` : undefined;
			}).filter(Boolean);
			const metadata = listify(thing, (key: string, val) => {
				if (key.startsWith('$')) {
					return `"${key}": "${val}"`;
				}
			}).filter(Boolean);

			if (dataValues.length === 0) {
				throw new Error('No data values found');
			}
			return `{RETURN (CREATE ONLY ${thing.$thing} SET ${dataValues.join(',')} RETURN IF $before {THROW "Error: existing id"} ELSE {RETURN {record:$this, metadata: {${metadata.join(',')}}}} as t).t};`;
		});

	const thingDeletions = things
		.filter((t) => t.$op === 'delete' && t.$id)
		.map((thing) => {
			const parsed = parseFilter({ ...thing.$filter, $id: thing.$id }, thing.$thing, schema);
			const built = buildSuqlFilter(parsed);
			const metadata = listify(thing, (key: string, val) => {
				if (key.startsWith('$')) {
					return `"${key}": "${val}"`;
				}
			}).filter(Boolean);
			return `{RETURN (DELETE ${thing.$thing} WHERE ${built} RETURN {record: $this, metadata: {${metadata.join(',')}}} as t).t};`;
		});

	return {
		creations: thingCreations,
		deletions: thingDeletions,
	};
};
