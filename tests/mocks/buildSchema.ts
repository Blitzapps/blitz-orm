// CommonJS require syntax

import { enrichSchema } from '../../src/enrichSchemaNew';
import { schema } from './schema';
import fs from 'fs';

//@ts-expect-error - Exceptionally ok, used for types only
const enrichedSchema = enrichSchema(schema, { typeDB: undefined, surrealDB: undefined });

const generatedCode = `//* File auto generated with buildSchema.ts
export const typesSchema = ${JSON.stringify(enrichedSchema, null, '\t')} as const;
`;
// Remove quotes around keys

// Write the generated code to a TypeScript file
fs.writeFileSync('tests/mocks/generatedSchema.ts', generatedCode);
