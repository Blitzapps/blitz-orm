import { isDate } from 'radash';

export const parseFlexValTypeDB = (v: unknown) => {
	if (isDate(v)) {
		return { type: 'datetime', value: v.toISOString().replace('Z', '') };
	}
	if (typeof v === 'string') {
		return { type: 'string', value: `"${v}"` };
	}
	if (typeof v === 'number') {
		if (v % 1 !== 0) {
			return { type: 'double', value: v };
		}
		return { type: 'long', value: v };
	}
	if (typeof v === 'boolean') {
		return { type: 'boolean', value: v };
	}
	throw new Error(`Unsupported type ${typeof v}`);
};
