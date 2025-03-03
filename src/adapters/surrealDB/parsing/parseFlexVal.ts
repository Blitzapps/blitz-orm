import dayjs from 'dayjs';
import { isDate } from 'radash';

export const parseFlexValSurrealDB = (v: unknown) => {
  //dates are potentially defined as strings in flex-values
  if (typeof v === 'string' && dayjs(v, 'YYYY-MM-DDTHH:mm:ssZ', true).isValid()) {
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
