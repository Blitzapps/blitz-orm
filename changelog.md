# Changelog
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