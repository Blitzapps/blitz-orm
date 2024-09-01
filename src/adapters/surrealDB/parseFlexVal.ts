import { isDate } from 'radash';

export const parseFlexValSurrealDB = (v: unknown) => {
	if (isDate(v)) {
		return `d"${v.toISOString()}"`;
	}
	if (typeof v === 'string') {
		return `'${v}'`;
	}
	if (['number', 'boolean'].includes(typeof v)) {
		return v;
	}
	throw new Error(`Unsupported type ${typeof v}`);
};
