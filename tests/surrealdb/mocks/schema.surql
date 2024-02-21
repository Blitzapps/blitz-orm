USE NS test;
USE DB test;

DEFINE TABLE User SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE User TYPE string;
DEFINE FIELD email ON TABLE User TYPE option<string>;
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
DEFINE FIELD timestamp ON TABLE Hook TYPE option<datetime>;
DEFINE FIELD requiredOption ON TABLE Hook TYPE string;
DEFINE FIELD manyOptions ON TABLE Hook TYPE option<string>;
DEFINE FIELD fnValidatedField ON TABLE Hook TYPE option<string>;

-- relationship
-- TODO
-- DEFINE TABLE ThingRelation SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE ThingRelation TYPE record<Thing>;
-- DEFINE FIELD out ON TABLE ThingRelation TYPE record<Thing>;

DEFINE TABLE UserAccounts SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD user ON TABLE UserAccounts TYPE record<User>;
DEFINE FIELD account ON TABLE UserAccounts TYPE record<Account>;

-- DEFINE TABLE UserSessions SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE UserSessions TYPE record<User | Session>;
-- DEFINE FIELD out ON TABLE UserSessions TYPE record<User | Session>;

DEFINE TABLE SpaceUser SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD spaces ON TABLE SpaceUser TYPE record<Space>;
DEFINE FIELD users ON TABLE SpaceUser TYPE record<User>;
DEFINE FIELD power ON TABLE SpaceUser TYPE option<record<Power>>;

DEFINE TABLE UserTag SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
DEFINE FIELD user ON TABLE UserTag TYPE record<User>;
DEFINE FIELD tag ON TABLE UserTag TYPE option<record<Tag>>;

-- DEFINE TABLE UserTagGroup SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD tag ON Kind Type record<Tag>;
-- DEFINE FIELD space ON Kind Type option<record<Space>>;
-- DEFINE FIELD color ON TABLE UserTagGroup TYPE record<Color>;

-- DEFINE TABLE HookParent SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE HookParent TYPE record<Hook>;
-- DEFINE FIELD out ON TABLE HookParent TYPE record<Hook>;

-- DEFINE TABLE HookATag SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE HookATag TYPE record<Hook>;
-- DEFINE FIELD out ON TABLE HookATag TYPE record<Hook>;

-- DEFINE TABLE SpaceObj SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE SpaceObj TYPE record<Space>;
-- DEFINE FIELD out ON TABLE SpaceObj TYPE record<Space>;

-- DEFINE TABLE SpaceDef SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE SpaceDef TYPE record<SpaceObj>;
-- DEFINE FIELD out ON TABLE SpaceDef TYPE record<SpaceObj>;
-- DEFINE FIELD description ON SpaceDef TYPE string;

DEFINE TABLE Kind SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD space ON Table Kind Type record<Space>;
DEFINE FIELD name ON Table Kind TYPE string;

-- DEFINE TABLE Field SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE Field TYPE record<SpaceDef>;
-- DEFINE FIELD out ON TABLE Field TYPE record<SpaceDef>;
-- DEFINE FIELD name ON Field TYPE string;
-- DEFINE FIELD cardinality ON Field TYPE string;

-- DEFINE TABLE DataField SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE DataField TYPE record<Field>;
-- DEFINE FIELD out ON TABLE DataField TYPE record<Field>;
-- DEFINE FIELD type ON DataField TYPE string;
-- DEFINE FIELD computeType ON DataField TYPE string;

-- DEFINE TABLE Expression SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE Expression TYPE record<DataField>;
-- DEFINE FIELD out ON TABLE Expression TYPE record<DataField>;
-- DEFINE FIELD value ON Expression TYPE string;

-- DEFINE TABLE DataValue SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE DataValue TYPE record<DataField>;
-- DEFINE FIELD out ON TABLE DataValue TYPE record<DataField>;
-- DEFINE FIELD type ON DataValue TYPE string;

DEFINE TABLE Self SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD space ON TABLE Self TYPE record<Space>;
DEFINE FIELD owner ON Self TYPE option<record<Self>>;

-- relations END

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