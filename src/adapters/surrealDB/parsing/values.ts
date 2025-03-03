import dayjs from 'dayjs';
import { isArray, isDate } from 'radash';
import { parseFlexValSurrealDB } from './parseFlexVal';

export const surrealDBtypeMap: Record<string, string> = {
  TEXT: 'string',
  RICH_TEXT: 'string',
  LANGUAGE_TEXT: 'string',
  PASSWORD: 'string',
  URL: 'string',
  PHONE: 'string',
  ID: 'string',
  EMAIL: 'string',
  NUMBER: 'number',
  NUMBER_DECIMAL: 'decimal',
  BOOLEAN: 'bool',
  DATE: 'datetime',
  JSON: 'object',
  FLEX: 'bool|bytes|datetime|duration|geometry|number|object|string',
};

export const parseValueSurrealDB = (value: unknown, ct?: string): any => {
  if (value === null) {
    return 'NONE';
  }
  if (ct) {
    switch (ct) {
      case 'TEXT':
      case 'RICH_TEXT':
      case 'LANGUAGE_TEXT':
      case 'PASSWORD':
      case 'URL':
      case 'PHONE':
      case 'ID':
      case 'EMAIL':
        if (typeof value !== 'string') {
          throw new Error(`Invalid value for TEXT type: ${value}`);
        }
        return JSON.stringify(value);
      case 'NUMBER':
      case 'NUMBER_DECIMAL':
      case 'BOOLEAN':
      case 'JSON':
        return value;
      case 'DATE':
        if (typeof value === 'string' && dayjs(value, 'YYYY-MM-DDTHH:mm:ssZ', true).isValid()) {
          return `<datetime>"${value}"`;
        }
        if (isDate(value)) {
          return `d"${value.toISOString()}"`;
        }
        return `$<datetime>"${value}"`; //let surrealDB try to do the conversion
      case 'FLEX': {
        // array elements go throw the parsing
        const parsedVal = isArray(value) ? value.map((v) => parseFlexValSurrealDB(v)) : parseFlexValSurrealDB(value);
        return `${isArray(parsedVal) ? parsedVal.map((v) => v) : parsedVal}`;
      }
      default:
        throw new Error(`Unsupported data field type ${ct}.`);
    }
  }
  throw new Error(`Failed parsing value ${value} with content type ${ct}`);
};
