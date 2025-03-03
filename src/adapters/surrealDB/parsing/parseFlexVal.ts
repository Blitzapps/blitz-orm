import { isDate } from 'radash';

export const parseFlexValSurrealDB = (v: unknown) => {
  //dates are potentially defined as strings in flex-values
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v)) {
    return `<datetime>"${v}"`;
  }
  if (isDate(v)) {
    return `d"${v.toISOString()}"`;
  }
  if (typeof v === 'string') {
    return JSON.stringify(v);
  }
  if (['number', 'boolean'].includes(typeof v)) {
    return v;
  }
  throw new Error(`Unsupported type ${typeof v}`);
};
