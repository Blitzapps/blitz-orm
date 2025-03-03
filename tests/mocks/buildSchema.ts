// CommonJS require syntax

import fs from 'fs';
import { enrichSchema } from '../../src/enrichSchema';
import { schema } from './schema';

//@ts-expect-error - Exceptionally ok, used for types only
const enrichedSchema = enrichSchema(schema, { typeDB: undefined, surrealDB: undefined });

const generatedCode = `//* File auto generated with buildSchema.ts
export const typesSchema = ${JSON.stringify(enrichedSchema, null, '\t')} as const;
`;
// Remove quotes around keys

// Write the generated code to a TypeScript file
fs.writeFileSync('tests/mocks/generatedSchema.ts', generatedCode);
