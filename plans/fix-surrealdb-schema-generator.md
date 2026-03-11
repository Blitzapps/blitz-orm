# Fix SurrealDB Schema Generator (`define.ts`)

**Goal:** Make the assertion at `tests/unit/schema/define.ts:30` pass — the output of `defineSURQLSchema()` must exactly match `tests/adapters/surrealDB/mocks/schema.surql`.

**File to modify:** `src/adapters/surrealDB/schema/define.ts`

---

## Summary of All Fixes

| # | What | Line(s) | Affected output |
|---|------|---------|-----------------|
| 1 | Restructure section headers in `convertSchemaItem` | 46–82 | CascadeThing, FlexRef, SpaceObj, SpaceDef, FlexRefRel, User-Accounts, User-Sessions, Space-User, UserTagGroup, CascadeRelation, HookParent, HookATag, Employee, DataValue, Expression, Field, Self, VerificationToken |
| 2 | FLEX/JSON data fields → `TYPE any` | 84–104 | Color.freeForAll, Account.profile |
| 3 | MANY cardinality data fields → `array<...>` wrapper | 84–104, 233–245 | Hook.manyOptions |
| 4 | Single-source MANY link with `targetRoleCardinality='MANY'` | 148–149 | User.accounts/sessions/spaces, SuperUser.accounts/sessions/spaces, God.accounts/sessions/spaces, Space.users, Color.\_\_user\_tags |
| 5 | Multi-source MANY link with `target='relation'` | 157–158 | Space.objects/definitions/fields, Kind.fields |
| 6 | FLEX ref fields ONE cardinality → `TYPE any` | 214–231 | FlexRef.flexReference, FlexRefRel.flexReference |
| 7 | Add trailing newline | 40 | EOF |

---

## Fix 1: Restructure section headers in `convertSchemaItem`

**Problem:** The current code always outputs `-- DATA FIELDS` and `-- LINK FIELDS` headers even when those sections are empty. It also never outputs a `-- REF FIELDS` header.

**Expected behavior (derived from `schema.surql`):**
- `-- DATA FIELDS` — only when there are non-id data fields
- `-- LINK FIELDS` — only when there are link fields, **except** also include an empty `-- LINK FIELDS` when the entity/relation has data fields but no subsequent sections (no roles, no ref fields). This acts as a visual terminator.
- `-- ROLES` — only when there are role fields (already correct)
- `-- REF FIELDS` — only when there are ref fields (currently missing)

**Replace lines 46–82** (the entire `convertSchemaItem` function) with:

```typescript
const convertSchemaItem = (
  sanitizedName: string,
  item: DraftSchemaItem,
  level: number,
  schema: DRAFT_EnrichedBormSchema,
): string => {
  const baseDefinition = `${indent(level)}DEFINE TABLE ${sanitizedName} SCHEMAFULL PERMISSIONS FULL;${item.extends ? ` //EXTENDS ${item.extends};` : ''}`;

  // Data fields
  const dataFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormDataField => f.type === 'data');
  const dataFieldsOutput = convertDataFields(dataFields, sanitizedName, level);

  // Link fields (COMPUTED)
  const linkFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormLinkField => f.type === 'link');
  const linkFieldsOutput = convertLinkFields(linkFields, sanitizedName, level, schema);

  // Roles (REFERENCE)
  let rolesOutput = '';
  if (item.type === 'relation') {
    const roleFields = Object.entries(item.fields).filter(
      (entry): entry is [string, DRAFT_EnrichedBormRoleField] => entry[1].type === 'role',
    );
    if (roleFields.length > 0) {
      rolesOutput = convertRoles(roleFields, sanitizedName, level, schema);
    }
  }

  // Ref fields
  const refFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormRefField => f.type === 'ref');
  const refFieldsOutput = refFields.length > 0 ? convertRefFields(refFields, sanitizedName, level) : '';

  // Build sections conditionally
  const sections: string[] = [];

  if (dataFieldsOutput) {
    sections.push(`-- DATA FIELDS\n${dataFieldsOutput}`);
  }

  if (linkFieldsOutput) {
    sections.push(`-- LINK FIELDS\n${linkFieldsOutput}`);
  } else if (dataFieldsOutput && !rolesOutput && !refFieldsOutput) {
    // Empty LINK FIELDS acts as visual terminator when data fields is the only other section
    sections.push('-- LINK FIELDS');
  }

  if (rolesOutput) {
    sections.push(`-- ROLES\n${rolesOutput}`);
  }

  if (refFieldsOutput) {
    sections.push(`-- REF FIELDS\n${refFieldsOutput}`);
  }

  const body = sections.map((s) => indentPar(s, level + 1)).join('\n');
  return `${baseDefinition}\n${body}`;
};
```

**Why this works:**

| Entity/Relation | Data | Link | Roles | Ref | Sections generated |
|-----------------|------|------|-------|-----|--------------------|
| User | yes | yes | no | no | DATA FIELDS, LINK FIELDS |
| VerificationToken | yes | no | no | no | DATA FIELDS, LINK FIELDS (empty terminator) |
| CascadeThing | no | yes | no | no | LINK FIELDS |
| FlexRef | no | no | no | yes | REF FIELDS |
| SpaceObj | no | no | yes | no | ROLES |
| SpaceDef | yes | no | yes | no | DATA FIELDS, ROLES |
| FlexRefRel | no | no | yes | yes | ROLES, REF FIELDS |
| Kind | yes | yes | yes | no | DATA FIELDS, LINK FIELDS, ROLES |
| DataField | yes | yes | yes | no | DATA FIELDS, LINK FIELDS, ROLES |

---

## Fix 2: FLEX/JSON data fields → `TYPE any`

**Problem:** FLEX data fields produce `TYPE option<bool|bytes|datetime|duration|geometry|number|object|string> FLEXIBLE;` and JSON data fields produce `TYPE option<object> FLEXIBLE;`. Both should produce `TYPE any;`.

**In `convertDataFields` (lines 84–104), replace lines 90–101:**

Current:
```typescript
      const fieldType = mapContentTypeToSurQL(field.contentType, field.validations);
      const baseDefinition = `${indent(level)}DEFINE FIELD ${field.name} ON TABLE ${parentName}`;
      const flexible = ['FLEX', 'JSON'].includes(field.contentType) ? ' FLEXIBLE' : '';

      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }
      return `${baseDefinition} TYPE ${fieldType}${flexible};`;
```

New:
```typescript
      const baseDefinition = `${indent(level)}DEFINE FIELD ${field.name} ON TABLE ${parentName}`;

      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }
      if (['FLEX', 'JSON'].includes(field.contentType)) {
        return `${baseDefinition} TYPE any;`;
      }
      const fieldType = mapContentTypeToSurQL(field.contentType, field.validations, field.cardinality);
      return `${baseDefinition} TYPE ${fieldType};`;
```

**Verification:**
- `Color.freeForAll` (FLEX, ONE): `TYPE any;` → matches line 105
- `Account.profile` (JSON, ONE): `TYPE any;` → matches line 57

---

## Fix 3: MANY cardinality data fields → `array<...>` wrapper

**Problem:** `Hook.manyOptions` (TEXT, MANY, enum) produces `TYPE option<"a"|"b"|"c">` instead of `TYPE option<array<"a"|"b"|"c">>`. The `mapContentTypeToSurQL` function ignores cardinality.

**Replace `mapContentTypeToSurQL` (lines 233–245):**

Current:
```typescript
const mapContentTypeToSurQL = (contentType: string, validations?: Validations): string => {
  const type = validations?.enum
    ? `${validations.enum.map((value: unknown) => parseValueSurrealDB(value, contentType)).join('|')}`
    : surrealDBtypeMap[contentType];
  if (!type) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  if (validations?.required) {
    return `${type}`;
  }
  return `option<${type}>`;
};
```

New:
```typescript
const mapContentTypeToSurQL = (contentType: string, validations?: Validations, cardinality?: 'ONE' | 'MANY'): string => {
  const baseType = validations?.enum
    ? `${validations.enum.map((value: unknown) => parseValueSurrealDB(value, contentType)).join('|')}`
    : surrealDBtypeMap[contentType];
  if (!baseType) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  const type = cardinality === 'MANY' ? `array<${baseType}>` : baseType;

  if (validations?.required) {
    return type;
  }
  return `option<${type}>`;
};
```

**Verification:**
- `Hook.requiredOption` (TEXT, ONE, required, enum `['a','b','c']`): baseType=`"a"|"b"|"c"`, ONE → type=`"a"|"b"|"c"`, required → `"a"|"b"|"c"` → matches line 126
- `Hook.manyOptions` (TEXT, MANY, not required, enum `['a','b','c']`): baseType=`"a"|"b"|"c"`, MANY → type=`array<"a"|"b"|"c">`, not required → `option<array<"a"|"b"|"c">>` → matches line 127
- `User.name` (TEXT, ONE, not required): baseType=`string`, ONE → type=`string`, not required → `option<string>` → matches line 8
- `God.isEvil` (BOOLEAN, ONE, required): baseType=`bool`, ONE → type=`bool`, required → `bool` → matches line 32
- `Company.name` (TEXT, ONE, required): baseType=`string`, ONE → type=`string`, required → `string` → matches line 138
- `Company.industry` (TEXT, ONE, not required, enum): baseType=`"Tech"|"Finance"|"Healthcare"|"Retail"|"Manufacturing"`, ONE → same, not required → `option<"Tech"|"Finance"|"Healthcare"|"Retail"|"Manufacturing">` → matches line 139

**Note:** The call site in `convertDataFields` must pass `field.cardinality` as the third argument (already done in Fix 2 above).

---

## Fix 4: Single-source MANY link with `targetRoleCardinality='MANY'`

**Problem (line 149):** Produces `array::distinct(array::flatten(array::flatten([<~(...).role])))`. Expected: `array::distinct(array::flatten(<~(...).role ?? []))`.

**Replace line 149:**

Current:
```typescript
            computedExpr = `array::distinct(array::flatten(array::flatten([${rawExpr}])))`;
```

New:
```typescript
            computedExpr = `array::distinct(array::flatten(${rawExpr} ?? []))`;
```

**Why:** When `targetRoleCardinality` is `MANY`, `<~(...)` returns an array of arrays (each related record's role field is itself an array). `array::flatten` unnests one level. The `?? []` guards against `NONE` when no back-references exist. The previous double-flatten-with-wrapping was incorrect.

**Verification (User.accounts example):**
- rawExpr = `<~(⟨User-Accounts⟩ FIELD user).accounts`
- Output: `array::distinct(array::flatten(<~(⟨User-Accounts⟩ FIELD user).accounts ?? []))` → matches line 11

**All 11 affected fields:** User.accounts, User.sessions, User.spaces, SuperUser.accounts, SuperUser.sessions, SuperUser.spaces, God.accounts, God.sessions, God.spaces, Space.users, Color.\_\_user\_tags

---

## Fix 5: Multi-source MANY link with `target='relation'`

**Problem (line 158):** Produces `array::flatten([<~(T1 FIELD r) ?? [], <~(T2 FIELD r) ?? [], ...])`. Expected: `array::concat(<~(T1 FIELD r) ?? [], <~(T2 FIELD r) ?? [], ...)`.

**Replace line 158:**

Current:
```typescript
          const combined = `array::flatten([${exprs.join(', ')}])`;
```

New:
```typescript
          const combined = `array::concat(${exprs.join(', ')})`;
```

**Why:** When combining multiple sources for a relation target, each `<~(...)` returns a flat array of record IDs. `array::concat(a, b, c)` is the correct way to concatenate flat arrays. `array::flatten([a, b, c])` also works semantically but `array::concat` matches the expected output.

**Verification (Space.objects example):**
- sources: `['SpaceObj FIELD space', 'SpaceDef FIELD space', 'Kind FIELD space', 'Field FIELD space', 'DataField FIELD space', 'Self FIELD space']`
- Output: `array::distinct(array::concat(<~(SpaceObj FIELD space) ?? [], <~(SpaceDef FIELD space) ?? [], <~(Kind FIELD space) ?? [], <~(Field FIELD space) ?? [], <~(DataField FIELD space) ?? [], <~(Self FIELD space) ?? []))` → matches line 44

**All 4 affected fields:** Space.objects, Space.definitions, Space.fields, Kind.fields

---

## Fix 6: FLEX ref fields ONE cardinality → `TYPE any`

**Problem (lines 214–231):** ONE-cardinality FLEX ref fields produce `TYPE option<record|array|bool|bytes|datetime|duration|geometry|number|object|string> FLEXIBLE;`. Expected: `TYPE any;`.

**Replace `convertRefFields` (lines 214–231):**

Current:
```typescript
const convertRefFields = (refFields: DRAFT_EnrichedBormRefField[], parentName: string, level: number): string =>
  refFields
    .map((field) => {
      const sanitizedPath = sanitizeNameSurrealDB(field.name);
      let fieldType: string;
      if (field.contentType === 'REF') {
        fieldType = field.cardinality === 'MANY' ? 'option<array<record>>' : 'option<record>';
      } else {
        // FLEX: use TYPE any for MANY cardinality to allow arbitrary nested structures
        // (arrays of arrays, objects with any keys, etc.) on SCHEMAFULL tables.
        const flexTypes = 'record|array|bool|bytes|datetime|duration|geometry|number|object|string';
        fieldType = field.cardinality === 'MANY' ? 'any' : `option<${flexTypes}>`;
      }
      const flexible = field.contentType === 'FLEX' && field.cardinality !== 'MANY' ? ' FLEXIBLE' : '';
      const baseDef = `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE ${fieldType}${flexible};`;
      return baseDef;
    })
    .join('\n');
```

New:
```typescript
const convertRefFields = (refFields: DRAFT_EnrichedBormRefField[], parentName: string, level: number): string =>
  refFields
    .map((field) => {
      const sanitizedPath = sanitizeNameSurrealDB(field.name);
      let fieldType: string;
      if (field.contentType === 'REF') {
        fieldType = field.cardinality === 'MANY' ? 'option<array<record>>' : 'option<record>';
      } else {
        // FLEX: TYPE any covers all possible types for any cardinality
        fieldType = 'any';
      }
      return `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE ${fieldType};`;
    })
    .join('\n');
```

**Verification (FlexRef entity):**
- `reference` (REF, ONE): `option<record>` → matches line 119
- `references` (REF, MANY): `option<array<record>>` → matches line 120
- `flexReference` (FLEX, ONE): `any` → matches line 121
- `flexReferences` (FLEX, MANY): `any` → matches line 122

**Verification (FlexRefRel relation):**
- Same field types → matches lines 264–267

---

## Fix 7: Add trailing newline

**Problem:** The expected file `schema.surql` ends with `COMMIT TRANSACTION;\n` (hex `0a` after `;`). The generator returns `...COMMIT TRANSACTION;` without trailing newline.

**Replace line 40:**

Current:
```typescript
  return `${header}${entitiesStr}${relationsStr}${internalStr}COMMIT TRANSACTION;`;
```

New:
```typescript
  return `${header}${entitiesStr}${relationsStr}${internalStr}COMMIT TRANSACTION;\n`;
```

---

## Complete replacement of `define.ts`

For clarity, here is the full updated file after applying all 7 fixes:

```typescript
import type {
  DRAFT_EnrichedBormDataField,
  DRAFT_EnrichedBormEntity,
  DRAFT_EnrichedBormLinkField,
  DRAFT_EnrichedBormRefField,
  DRAFT_EnrichedBormRelation,
  DRAFT_EnrichedBormRoleField,
  DRAFT_EnrichedBormSchema,
} from '../../../types/schema/enriched.draft';
import type { Validations } from '../../../types/schema/fields';
import { computedFieldNameSurrealDB, sanitizeNameSurrealDB } from '../helpers';
import { parseValueSurrealDB, surrealDBtypeMap } from '../parsing/values';

const INDENTATION = '\t' as const;
const indent = (n: number): string => INDENTATION.repeat(n);

const indentPar = (str: string, level: number): string =>
  str
    .split('\n')
    .map((line) => (line.trim() ? `${indent(level)}${line}` : line))
    .join('\n');

type DraftSchemaItem = DRAFT_EnrichedBormEntity | DRAFT_EnrichedBormRelation;

const convertBQLToSurQL = (schema: DRAFT_EnrichedBormSchema): string => {
  const header = `USE NS test;
USE DB test;

BEGIN TRANSACTION;
`;

  const entities = Object.entries(schema).filter(([, item]) => item.type === 'entity');
  const relations = Object.entries(schema).filter(([, item]) => item.type === 'relation');

  const entitiesStr = `-- ENTITIES\n${convertSchemaItems(entities, schema)}`;
  const relationsStr = `\n-- RELATIONS\n${convertSchemaItems(relations, schema)}`;

  const internalStr = `\n-- INTERNAL\n\tDEFINE TABLE Delta SCHEMALESS PERMISSIONS FULL;\n`;

  return `${header}${entitiesStr}${relationsStr}${internalStr}COMMIT TRANSACTION;\n`;
};

const convertSchemaItems = (items: [string, DraftSchemaItem][], schema: DRAFT_EnrichedBormSchema): string =>
  items.map(([name, item]) => convertSchemaItem(sanitizeNameSurrealDB(name), item, 1, schema)).join('\n\n');

const convertSchemaItem = (
  sanitizedName: string,
  item: DraftSchemaItem,
  level: number,
  schema: DRAFT_EnrichedBormSchema,
): string => {
  const baseDefinition = `${indent(level)}DEFINE TABLE ${sanitizedName} SCHEMAFULL PERMISSIONS FULL;${item.extends ? ` //EXTENDS ${item.extends};` : ''}`;

  // Data fields
  const dataFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormDataField => f.type === 'data');
  const dataFieldsOutput = convertDataFields(dataFields, sanitizedName, level);

  // Link fields (COMPUTED)
  const linkFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormLinkField => f.type === 'link');
  const linkFieldsOutput = convertLinkFields(linkFields, sanitizedName, level, schema);

  // Roles (REFERENCE)
  let rolesOutput = '';
  if (item.type === 'relation') {
    const roleFields = Object.entries(item.fields).filter(
      (entry): entry is [string, DRAFT_EnrichedBormRoleField] => entry[1].type === 'role',
    );
    if (roleFields.length > 0) {
      rolesOutput = convertRoles(roleFields, sanitizedName, level, schema);
    }
  }

  // Ref fields
  const refFields = Object.values(item.fields).filter((f): f is DRAFT_EnrichedBormRefField => f.type === 'ref');
  const refFieldsOutput = refFields.length > 0 ? convertRefFields(refFields, sanitizedName, level) : '';

  // Build sections conditionally
  const sections: string[] = [];

  if (dataFieldsOutput) {
    sections.push(`-- DATA FIELDS\n${dataFieldsOutput}`);
  }

  if (linkFieldsOutput) {
    sections.push(`-- LINK FIELDS\n${linkFieldsOutput}`);
  } else if (dataFieldsOutput && !rolesOutput && !refFieldsOutput) {
    // Empty LINK FIELDS acts as visual terminator when data fields is the only other section
    sections.push('-- LINK FIELDS');
  }

  if (rolesOutput) {
    sections.push(`-- ROLES\n${rolesOutput}`);
  }

  if (refFieldsOutput) {
    sections.push(`-- REF FIELDS\n${refFieldsOutput}`);
  }

  const body = sections.map((s) => indentPar(s, level + 1)).join('\n');
  return `${baseDefinition}\n${body}`;
};

const convertDataFields = (dataFields: DRAFT_EnrichedBormDataField[], parentName: string, level: number): string =>
  dataFields
    .map((field) => {
      if (field.name === 'id') {
        return ''; //skip id fields for now, we will migrate it to a different name later like _id
      }
      const baseDefinition = `${indent(level)}DEFINE FIELD ${field.name} ON TABLE ${parentName}`;

      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; //it means is computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }
      if (['FLEX', 'JSON'].includes(field.contentType)) {
        return `${baseDefinition} TYPE any;`;
      }
      const fieldType = mapContentTypeToSurQL(field.contentType, field.validations, field.cardinality);
      return `${baseDefinition} TYPE ${fieldType};`;
    })
    .filter(Boolean)
    .join('\n');

const convertLinkFields = (
  linkFields: DRAFT_EnrichedBormLinkField[],
  parentName: string,
  level: number,
  draftSchema: DRAFT_EnrichedBormSchema,
): string =>
  linkFields
    .map((field) => {
      // Use safe internal name for COMPUTED fields (SurrealDB v3 bug with escaped names)
      const computedPath = computedFieldNameSurrealDB(field.name);
      const baseDefinition = `${indent(level)}DEFINE FIELD ${computedPath} ON TABLE ${parentName}`;

      // Virtual link fields use custom dbValue expressions, not standard COMPUTED fields
      if (field.isVirtual) {
        const dbValue = field.dbValue?.surrealDB;
        if (!dbValue) {
          return ''; // computed in BORM instead
        }
        return `${baseDefinition} ${dbValue};`;
      }

      // Build the <~(...) reverse lookup expression
      const selfRole = field.plays;
      const relationName = field.target === 'relation' ? field.opposite.thing : field.relation;
      const sources = collectPolymorphicSources(relationName, selfRole, draftSchema);

      const targetSuffix = field.target === 'role' ? `.${sanitizeNameSurrealDB(field.targetRole)}` : '';

      // Wrap with appropriate array function based on cardinality.
      // Guard against NONE from <~(...) when no back-references exist:
      // - array::first needs `?? []` to avoid "Expected array but found NONE"
      // - array::flatten needs `?? []` to ensure it receives an array
      // Note: Multi-table <~(T1 FIELD f, T2 FIELD f) is broken in SurrealDB v3,
      // so we split into individual <~(...) expressions and combine with array::concat.
      let computedExpr: string;
      if (sources.length === 1) {
        const rawExpr = `<~(${sources[0]})${targetSuffix}`;
        if (field.target === 'relation') {
          computedExpr = field.cardinality === 'ONE' ? `array::first(${rawExpr} ?? [])` : rawExpr;
        } else {
          if (field.cardinality === 'ONE') {
            computedExpr = `array::first(${rawExpr} ?? [])`;
          } else if (field.targetRoleCardinality === 'MANY') {
            computedExpr = `array::distinct(array::flatten(${rawExpr} ?? []))`;
          } else {
            computedExpr = `array::distinct(${rawExpr})`;
          }
        }
      } else {
        // Multiple sources: split to work around SurrealDB v3 multi-table <~() bug
        if (field.target === 'relation') {
          const exprs = sources.map((s) => `<~(${s}) ?? []`);
          const combined = `array::concat(${exprs.join(', ')})`;
          computedExpr =
            field.cardinality === 'ONE' ? `array::first(${combined} ?? [])` : `array::distinct(${combined})`;
        } else {
          const exprs = sources.map((s) => `(<~(${s}) ?? [])${targetSuffix}`);
          const combined = `array::flatten([${exprs.join(', ')}])`;
          if (field.cardinality === 'ONE') {
            computedExpr = `array::first(${combined} ?? [])`;
          } else if (field.targetRoleCardinality === 'MANY') {
            computedExpr = `array::distinct(array::flatten(${combined}))`;
          } else {
            computedExpr = `array::distinct(${combined})`;
          }
        }
      }

      return `${baseDefinition} COMPUTED ${computedExpr};`;
    })
    .join('\n');

/**
 * Collect all tables in the inheritance chain for a polymorphic COMPUTED field.
 * Returns entries like `["Table FIELD role", "SubType1 FIELD role", ...]`.
 */
const collectPolymorphicSources = (
  thingName: string,
  roleName: string,
  draftSchema: DRAFT_EnrichedBormSchema,
): string[] => {
  const thing = draftSchema[thingName];
  if (!thing) {
    return [`${sanitizeNameSurrealDB(thingName)} FIELD ${sanitizeNameSurrealDB(roleName)}`];
  }
  const allThings = [thingName, ...thing.subTypes];
  return allThings.map((t) => `${sanitizeNameSurrealDB(t)} FIELD ${sanitizeNameSurrealDB(roleName)}`);
};

const convertRoles = (
  roleFields: [string, DRAFT_EnrichedBormRoleField][],
  parentName: string,
  level: number,
  draftSchema: DRAFT_EnrichedBormSchema,
): string =>
  roleFields
    .map(([, role]) => {
      const sanitizedPath = sanitizeNameSurrealDB(role.name);
      const baseThing = role.opposite.thing;
      const draftThing = draftSchema[baseThing];
      const allThings = draftThing ? [baseThing, ...draftThing.subTypes] : [baseThing];
      const thingNames = allThings.map(sanitizeNameSurrealDB).join('|');
      const fieldType = role.cardinality === 'MANY' ? `array<record<${thingNames}>>` : `record<${thingNames}>`;
      const onDelete = role.onDelete ?? 'UNSET';
      return `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE option<${fieldType}> REFERENCE ON DELETE ${onDelete};`;
    })
    .join('\n');

const convertRefFields = (refFields: DRAFT_EnrichedBormRefField[], parentName: string, level: number): string =>
  refFields
    .map((field) => {
      const sanitizedPath = sanitizeNameSurrealDB(field.name);
      let fieldType: string;
      if (field.contentType === 'REF') {
        fieldType = field.cardinality === 'MANY' ? 'option<array<record>>' : 'option<record>';
      } else {
        // FLEX: TYPE any covers all possible types for any cardinality
        fieldType = 'any';
      }
      return `${indent(level)}DEFINE FIELD ${sanitizedPath} ON TABLE ${parentName} TYPE ${fieldType};`;
    })
    .join('\n');

const mapContentTypeToSurQL = (contentType: string, validations?: Validations, cardinality?: 'ONE' | 'MANY'): string => {
  const baseType = validations?.enum
    ? `${validations.enum.map((value: unknown) => parseValueSurrealDB(value, contentType)).join('|')}`
    : surrealDBtypeMap[contentType];
  if (!baseType) {
    throw new Error(`Unknown content type: ${contentType}`);
  }

  const type = cardinality === 'MANY' ? `array<${baseType}>` : baseType;

  if (validations?.required) {
    return type;
  }
  return `option<${type}>`;
};

export const defineSURQLSchema = (schema: DRAFT_EnrichedBormSchema): string => convertBQLToSurQL(schema);
```

---

## Verification

Run the test:

```bash
BORM_TEST_ADAPTER=surrealDB npx vitest run tests/unit/schema/define.test.ts
```

If the test still fails, dump the generated output and diff:

```bash
# Temporarily add in the test (line 29):
# fs.writeFileSync('tests/adapters/surrealDB/mocks/schema_generated.surql', schema);
# Then:
diff tests/adapters/surrealDB/mocks/schema.surql tests/adapters/surrealDB/mocks/schema_generated.surql
```
