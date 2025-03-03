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
