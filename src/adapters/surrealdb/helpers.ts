export const sanitizeTableNameSurrealDb = (tableName: string) => {
  return tableName.replace(/`/g, '');
};

export const sanitizeNameSurrealDB = (value: string) => {
  if (/[^a-zA-Z0-9_]/.test(value) || /^[^a-zA-Z_]/.test(value)) {
    return `⟨${value.replace(/⟩/g, '\\⟩')}⟩`;
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
