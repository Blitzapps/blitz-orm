export const sanitizeTableNameSurrealDb = (tableName: string) => {
  return tableName.replace(/`/g, '');
};

const specialChars = [
  ' ',
  '-',
  '+',
  '*',
  '/',
  '=',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '|',
  '\\',
  ';',
  ':',
  "'",
  '"',
  ',',
  '<',
  '>',
  '.',
  '?',
  '~',
  '`',
];

export const sanitizeNameSurrealDB = (value: string) => {
  //if tableName includes any of the chars of this array, then wrap it in backticks

  if (specialChars.some((char) => value.includes(char))) {
    return `⟨${value}⟩`;
  }
  return value;
};

/**
 * Convert a field name to a safe COMPUTED field name in SurrealDB.
 * SurrealDB v3 has a bug where COMPUTED fields with escaped names (angle brackets) don't evaluate.
 * Only spaces and dashes are replaced with underscores.
 */
export const computedFieldNameSurrealDB = (value: string) => {
  if (/[\s-]/.test(value)) {
    return value.replace(/[\s-]/g, '_');
  }
  return value;
};
