# Changelog

📝 following beta format X.Y.Z where Y = breaking change and Z = feature and fix. Later => FAIL.FEATURE.FIX


## 0.11.12-23(2024-11-11)

- Fix: Ignore % fields.

## 0.11.12-22(2024-11-07)

- Fix: Debugger includes original BQL.

## 0.11.11(2024-11-07)

- Fix: Issue with empty filters.

## 0.11.10(2024-11-06)

- Fix: Issue with surrealdb wrapper. Now catches errors too before trying to reconnect.

## 0.11.9(2024-10-28)

- Fix: Long running query blocks subsequent queries. Use Surreal DB connection pool.

## 0.11.8(2024-10-11)

- Feat: Debugger prop to print surrealdb queries and mutations

## 0.11.7(2024-10-03)

- Fix: Issue on borm adapter for deleting non existing things

## 0.11.6(2024-10-01)

- Feat: $exist to workaround surrealdb issue;
- Feat: Added comparators in tql queries;
- Bug: Fixed a bug where could not link and create to the same tempId
- Chore: Refacto tql filters
- Tests: Fixed filtered tests for surrealDB (17❌ 183✅ 29⏭️)

## 0.11.5(2024-09-20)

- Chore: Updated dependencies

## 0.11.4(2024-09-20)

- Fix: SurrealDB adapter $filter working on mutations

## 0.11.3(2024-09-13)

- Fix: SurrealDB adapter 173 pass, 20 fail

## 0.11.2(2024-09-11)

- Fix: Fixed most surrealDB issues (162 pass vs 29 failed)

## 0.11.1(2024-09-04)

- Feat: Generate surrealDB schema (client.define() works with surrealDB now)
- Fix: TypeDB schema generation has been fixed. (It still needs some enhancements tho)
- Test: Added some tests for extended classes

## 0.11.0(2024-09-01)

- Feat: Working queries and basic mutations for surrealDB

## 0.10.31(2024-07-31)

- Fix: Wrongly exported dbPaths when inheriting

## 0.10.30

- Fix: Using a non existing role name on queries throws a proper error now

## 0.10.29

- Feat: Can use tempIds directly just by prefixing them with '_:'. Ex: {$thing: User, accounts: [ "account1", "\_:justCreatedSpace"]}

## 0.10.28

- Fix: Defining multiple players for a role still does not work, but at least does not cause errors when you don't use that specific role

## 0.10.27

- Fix: Can now have coincidences on deletions (same node being deleted twice)

## 0.10.26

- Fix: Can now link and update in different branches

## 0.10.25

- Feat: SurrealDB with stored references (refs) vs edges
- Chore: Clean tests folder

## 0.10.24

- Fix: Some minor fixes
- Tests: Added failing test m3

## 0.10.18-23(2024-06-19)

- Fix: Robot3 issue

## 0.10.17(2024-06-18)

- Fix: robot3 types
- Fix: Issue that blocked entities from being updated in multiple branches of a mutation
- breaking: dropped support to cjs

## 0.10.16(2024-06-09)

- Fix: EnrichSchema issues
- Fix: Esm config issues

## 0.10.15(2024-06-09)

- Fix: Replaced surrealdb.node => surrealdb.js

## 0.10.14(2024-06-08)

- Feat:
  - TypeDB: Multi-values query and edit (not filter)
  - SurrealDB: query and filter Multi-values
- Test: ignoreTodo depending on tested DB

## 0.10.13(2024-05-27)

- Test: Added benchmark
- Fix: TypeDB errors being printed again
- Feat: SurrealDB queries
  -> Multiple refactoring to keep shared vs TQL vs SURQL
  -> Fix false values, fix workaround for reserved id field, Fix defined table names
  -> Virtual values onRead (futures) in schema, JSON values in schema
  -> Deeply nested filters, on local and remote fields
  -> NOT, OR, AND filters

## 0.10.12(2024-05-23)

- Feat(WIP): SurrealDB fix empty arrays and tableName sanitizing 37✅/25❌

## 0.10.11(2024-05-23)

- Feat(WIP): SurrealDB id filters, nested filters and cardinality check 28✅/34❌

## 0.10.10(2024-05-23)

- Feat(WIP): SurrealDB output format 13✅/49❌

## 0.10.9(2024-05-23)

- Fix: Several minor fixes
- Chore: .old files
- Chore: $id as individual filter instead of prebuilt, to be treated by each adapter
- Feat(WIP): SurrealDB subtypes query 7✅

## 0.10.8(2024-05-22)

- Feat(WIP): Basic surrealDB queries

## 0.10.7(2024-05-21)

- Update: Typedb adapter

## 0.10.6(2024-05-16)

- Fix: TypeDB cloud adapter

## 0.10.5(2024-05-14)

- Fix: Minor error silenced

## 0.10.4(2024-05-01)

- Feat: Filtered mutations

## 0.10.3(2024-04-22)

- Refacto: Pre queries dependencies refacto
- Test: Removed jest dependencies

## 0.10.2(2024-04-18)

- Test: Migrated to vitest
- Test: TypeDB url moved as env var

## 0.10.1(2024-04-17)

- Feat: Transformations for mutations with $fields included.

## 0.10.0(2024-04-17)

- Feat: Add SurrealDB query adapter
- Feat: Enable batched query that target multiple DB. Each query in the batch can only access a single DB.

## 0.9.20(2024-03-20)

- Refacto: Pre-queries refactoring

## 0.9.19(2024-03-17)

- Feat: JSON storage

## 0.9.18(2024-03-13)

- Fix: Fix false duplicate $id error

## 0.9.17(2024-03-13)

- Feat: %vars can be used to be consumed in pre-hooks

## 0.9.16(2024-03-04)

- Feat: dependency checker

## 0.9.15(2024-02-04)

- Fix: removed console.log

## 0.9.14(2024-03-03)

- Feat: triggers are optional, if none is created, then all are triggered (the $op can be used instead)
- Fix: Extended objects inherit as well the prehooks. Actions are still unsafe

## 0.9.13(2024-02-28)

- Breaking change: $tempId without attributes mean link. $tempId with attribute means create
- Fix: Fixed issue with nulls additions on hooks

## 0.9.12(2024-02-28)

- UX: Better replace issue message

## 0.9.11(2024-02-27)

- Fix: Issue that did not spread symbols on children creation

## 0.9.10(2024-02-27)

- Feat: Actions can use user provided context in the mutation config
- Feat: Actions can have name and descriptions

## 0.9.9(2024-02-27)

- Feat: Catch some extra schema errors

## 0.9.8(2024-02-26)

- Fix: Issue that was splitting things assigning them two different $vars ($tempId and $bzId generated in pre-queries)

## 0.9.1-7(2024-02-26)

- Fix: Fixing issue with module exports (robot3)

## 0.9.0(2024-02-26)

- Feat: Non linear pipeline
- Feat: Can add children nodes on transformations
- Feat: Replace is now a valid operation
- Breaking change: Should use $thing instead of $entity and $relation;
- Breaking change: Mutation result are always array (even if nothing is nested)
- Refacto: Preparing for multiple DBs
- Chore: Immer downgraded to 9.0.21 (until <https://github.com/immerjs/immer/issues/1087> is fixed)
- Fix: lot of fixes

## 0.8.11(2024-02-15)

- Tests: Added nested object validation test

## 0.8.10(2024-02-14)

- Fix: Sanitized params in fn validations and transforms

## 0.8.9(2024-02-12)

- Feat: Transform pre-hooks
- Temp breaking change: b3rn use case no longer working until it gets fixed in next version

## 0.8.8(2024-02-11)

- Feat: More $tempId working cases
- Chore: Added getSymbols helper
- Chore: Added some missing types
- Tests: New tests

## 0.8.7(2024-02-09)

- Feat: virtual fields can't be written
- Feat: virtual fields without function can be read (for DB computed stuff)
- Test: added tests for virtual dataFields
- Fix: Issue with undefined dates
- Chore: Cleaned some dead code

## 0.8.6(2024-02-08)

- Feat: Node validations can also use the parent object of the mutation

## 0.8.5(2024-02-08)

- Fix: Compatible now with typedb 2.26.6
- Fix: Fix new closed session error introduced in typedb 2.26.0

## 0.8.4(2024-02-08)

- Feat: Validations can now throw dynamic errors using (by catching errors)

## 0.8.3(2024-02-08)

- Fix: Published issue

## 0.8.2(2024-02-08)

- Feat: Queries' virtual fields are no working also with rolefields and linkfields (but not remote fields, and they require to explicitly query the dependencies)
- Feat: Attribute validation fns //will probably required a more flexible schema later tho
- Fix: Dependencies are now correctly checked when having formats like ({"my-thing": "myThing"}) => ...
- Fix: Virtual fields are not computed if dependencies are missing (they need to be queried manually meanwhile)
- Refacto: Started refacto of metadatas in fetch queries
- Tests: New test for excluded fields

## 0.8.1(2024-02-03)

- Feat: optional cardinality definition on attributes (default: ONE)
- Chore: updated dependencies

## 0.8.0(2024-02-02)

- Feat: Default values, not only for id fields
- Feat: Required values are check now on create //cardinality ONE only
- Feat: Enums are check on create and update
- Feat: Validations can be functions
- Breaking Change: Default values structure has changed (from value to fn)
- Mini breaking change: Fixed some issues with the dates with come now with the Z at the end
- Refactoring: Refactoring some code, preparing for other pre-hooks

## 0.7.4(2024-02-01)

- Feat: Added thing validations V0 (📝Only working with local and existing values in the same mutation, for instance an update can't check a new value comparing with the existing one)

## 0.7.2(2024-01-26)

- Fix: Issues with published version

## 0.7.1(2024-01-26)

- Feat: Fixed some extra tests for multi-links. Mainly by splitting $id

## 0.7.0(2024-01-26)

- Feat: pre-queries, fetch queries and lots of refactos
- Warning: BQL queries now use $thing and $thingType, but mutations not yet

## 0.6.5(2023-11-17)

- Feat: optional pre-queries
- Warning: replaces no longer working until 0.7.0

## 0.6.4(2023-11-13)

- Feat: Pre-queries are now doing pruning
- Fix: Some issues with the tests

## 0.6.3(2023-11-10)

- Fix: Sessions not being reopened when needed
- Fix: Attribute deletion with null, and enabling '' as a string value

## 0.6.2(2023-11-08)

- Typedb-driver fixed, now we can connect to any IP

## 0.6.1(2023-11-07)

- Feature: Added returnNulls to explicitly return nulls of queried fields when empty
- Types: Added query config type

## 0.6.0(2023-11-02)

- Chore: Updated to last version of typeDB, might not work with older versions

## 0.5.1-3(2023-11-01)

- Types: Mutation accepts generic
- Types: Fixes

## 0.5.0(2023-10-27)

### Breaking changes

- Mutation outputs are always arrays (even if the input is a single object, without nested things)
- Removed symbols in the output of mutations

### Features

- Types: New type gen (Ex: `type UserType = TypeGen<typeof typesSchema.entities.User>`)
- TYpes Schema builder to generate an schema with inherited fields

### Bug fixes / Chore

- Fixed module stuff
- Chore: Rearranged types
- Types: Removed signatures of borm.query and borm.mutate

## 0.4.7-8(2023-10-26)

- Chore: As module

## 0.4.6(2023-10-26)

- Types: $filter can infer the array vs object dilema (yet)

## 0.4.5(2023-10-26)

- Types: Queries might also get arrays when $id is not specified

## 0.4.4(2023-10-26)

- Types: Now single mutations and queries can accept a T type to complement the output

## 0.4.3(2023-10-26)

- Types: Mutation type now depends on the mutation input

## 0.4.2(2023-10-26)

- Types: Reversed and fixed single output

## 0.4.1(2023-10-26)

- Types: Fix mutation output

## 0.4.0(2023-10-24)

- Can now replace by id
- Can't replace if link operation is specified
- Performs pre-query in pipeline for error checks and replaces

## 0.3.3(2023-10-20)

- Virtual's depencencies are optional
- Default values with formula require always all the dependencies
- Can't send virtual fields

## 0.3.2(2023-10-20)

- Virtual fields are now supported and can use local values
- Default values can also use local values

## 0.3.1(2023-10-18)

- changed the $tempId behaviour to be 'create' by default (no need to declare explicitly)
- Clean tests added filter test
- Restructured tests

## 0.3.0(2023-10-18)

### breaking changes

- TempIds require to define operation 'create' or 'link' explicitly

### other

- Added mutation tests and started splitting them
- Added some error messages

## 0.2.7(2023-10-17)

- Clean dead code
- Removed dead dependencies
- Migrated to pnpm
- updated packages

## 0.2.6(2023-10-17)

- Fixed nested results which arrive as a single entity when the output is ensured to be a single object (or null)

## 0.2.5(2023-10-03)

- TypeDBCluster compatibility

## 0.2.4(2023-09-29)

- Fixed test EX2

## 0.2.3(2023-09-19)

- New tests
- Can create nested on existing relation

## 0.2.2(2023-09-19)

- Refacto mutation
- Working nested deletions and other cases that were not working
- Simplification of the code

## 0.2.1(2023-09-04)

- Disabled cardinality check as it has false positives

## 0.2.0(2023-08-11)

- Merged borm.define()
- No breaking changes but important feature => 0.2.0

## 0.1.13(2023-08-11)

- minor type fixes
- cleaned oFilter types
- moved the selfprelation exception in fill to parseBQLMutation (should reduce the need of the edgeeMerger)
- Stopped including temp things match in the match queries (only create are required)
- Fixed an old bug that sometimes added [Object Object] to tql queries

## 0.1.12(2023-08-03)

- Fixed another $tempId issue (test c5)
- Fixed deep nested deletions and probably other edge cases

## 0.1.11(2023-08-02)

- Updated dependencies
- linter with trailing-comma

## 0.1.10(2023-08-02)

- Fixed all $tempid known issues
- Added a new test for cascade deletion

## 0.1.9(2023-08-01)

- More $tempid fixes
- A new checker for tricky cardinality ONE issues

## 0.1.8(2023-08-01)

- Changed "noop" to "match"
- Split test C1 in two tests
- Fixed simple $tempId case (todo: c2)

## 0.1.7(2023-07-26)

- Fixed a bug with some queries
- Added some new tests and matcher helpers

## 0.1.6(2023-06-11)

- Fixed a mutation issue where nested edges where discarded

## 0.1.5(2023-07-04)

- Added excludedFields feature v0

## 0.1.4(2023-06-15)

- Added a debug option to check queries (only in queries)

## 0.1.3(2023-06-09)(unpublished)

- Added a test for an existing bug when querying parent things

## 0.0.41(2023-02-03)

- readme, changelog

## 0.0.40(2023-02-03)

### Features

- cleaned tests

### Bug fixes

- All current test working again

## 0.0.39(2023-02-03)

### Features

- Created as new repo and published
