//! TO-DO Rule: Everything that can be changed or defined by the user should use $ prefix, but the rest is metadata and should be packed in symbols, depending on their origin. extension inside the schema and schema or query inside the query. Probably no more categories are necessary
export const Schema = Symbol.for('schema');

export const QueryPath = Symbol.for('queryPath');

export const StepPrint = Symbol.for('stepPrint');

export const EdgeType = Symbol.for('edgeType');
export const EdgeSchema = Symbol.for('edgeSchema');
export const Path = Symbol.for('path');

export const DBNode = Symbol.for('dbNode');
export const IsTransformed = Symbol.for('isTransformed');

//flatBQL
export const Parent = Symbol.for('parent');

/// Fields
export const FieldSchema = Symbol.for('fieldSchema');

/// Shared schema metadata
export const SharedMetadata = Symbol.for('sharedMetadata');

/// Marks plain objects stored as data values in FLEX ref fields
export const FlexDataValue = Symbol.for('flexDataValue');

/// SurrealDB schema metadata
export const SuqlMetadata = Symbol.for('suqlMetadata');

//TODO: restructure everything on top of this to be packed in the 3 symbols hereunder.
//* SCHEMA STORED
// For metadata that extends the schema
export const Extension = Symbol.for('extension');

//* QUERY STORED
//export const QueryContext = Symbol.for('queryContext'); //todo: queryContext and schemaContext  as the only two symbols with a particular structure
//export const SchemaContext = Symbol.for('schemaContext');
