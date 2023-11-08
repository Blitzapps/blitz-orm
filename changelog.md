# Changelog
📝 following beta format X.Y.Z where Y = breaking change and Z = feature and fix. Later => FAIL.FEATURE.FIX

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