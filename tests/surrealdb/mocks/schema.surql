USE NS test;
USE DB test;

DEFINE TABLE User SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE User TYPE string;
DEFINE FIELD email ON TABLE User TYPE string;
-- there is no subtyping in SurrealDB
DEFINE TABLE SuperUser SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE SuperUser TYPE string;
DEFINE FIELD email ON TABLE SuperUser TYPE string;
DEFINE FIELD power ON TABLE SuperUser TYPE string;
-- there is no subtyping in SurrealDB
DEFINE TABLE God SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE God TYPE string;
DEFINE FIELD email ON TABLE God TYPE string;
DEFINE FIELD power ON TABLE God TYPE string;
DEFINE FIELD isEvil ON TABLE God TYPE bool;

DEFINE TABLE Space SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Space TYPE string;

DEFINE TABLE Thing SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE Thing TYPE string;
-- there is no subtyping in SurrealDB
DEFINE TABLE SubthingOne SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE SubthingOne TYPE string;
DEFINE TABLE SubthingTwo SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE SubthingTwo TYPE string;

DEFINE TABLE Account SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD provider ON TABLE Account TYPE string;
DEFINE FIELD isSecureProvider ON TABLE Account TYPE option<bool>;

DEFINE TABLE Post SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD mentions ON TABLE Post TYPE array<string>;

DEFINE TABLE Color SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Color TYPE option<string>;

DEFINE TABLE Power SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD description ON TABLE Power TYPE string;

DEFINE TABLE Session SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD sessionToken ON TABLE Session TYPE string;
DEFINE FIELD expires ON TABLE Session TYPE datetime;

DEFINE TABLE Hook SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD requiredOption ON TABLE Hook TYPE string;
DEFINE FIELD manyOptions ON TABLE Hook TYPE string;
DEFINE FIELD fnValidatedField ON TABLE Hook TYPE string;

-- Not sure how to migrate this to SurrealDB
-- #1 Secure provider rule
-- rule add-secure-provider: when {
-- 	  $account isa Account, has Account·provider "google";
-- } then {
-- 	  $account has Account·isSecureProvider true;
-- };

-- rule add-non-secure-provider: when {
-- 	  $account isa Account;
-- 		not { $account has Account·isSecureProvider true; };
-- } then {
-- 	  $account has Account·isSecureProvider false;
-- };


-- #2 With parent tag rule	
-- rule add-hook-type-a-tag: when {
-- 	  $hook isa Hook, has Hook·requiredOption "a";
-- 		$otherHooks isa Hook;
-- 		not { $hook is $otherHooks; };
-- 		not { $otherHooks has Hook·requiredOption "a"; };
	
-- } then {
-- 	  (hookTypeA: $hook, otherHooks: $otherHooks) isa HookATag;
-- };