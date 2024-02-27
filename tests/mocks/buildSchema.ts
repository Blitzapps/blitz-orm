// CommonJS require syntax

import { enrichSchema } from '../../src/helpers';
import { testSchema } from './testSchema';
import fs from 'fs';

//@ts-expect-error - Exceptionally ok, used for types only
const enrichedSchema = enrichSchema(testSchema, { typeDB: undefined, surrealDB: undefined });

const generatedCode = `//* File auto generated with buildSchema.ts
export const typesSchema = ${JSON.stringify(enrichedSchema, null, 2)} as const;
`;

// Write the generated code to a TypeScript file
fs.writeFileSync('tests/mocks/generatedSchema.ts', generatedCode);
