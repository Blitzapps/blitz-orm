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
DEFINE TABLE ThingRelation SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE ThingRelation_root SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ThingRelation_root TYPE record<ThingRelation>;
DEFINE FIELD out ON TABLE ThingRelation_root TYPE record<Thing>;
DEFINE TABLE ThingRelation_extra SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ThingRelation_extra TYPE record<ThingRelation>;
DEFINE FIELD out ON TABLE ThingRelation_extra TYPE record<Thing>;
DEFINE TABLE ThingRelation_things SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ThingRelation_things TYPE record<ThingRelation>;
DEFINE FIELD out ON TABLE ThingRelation_things TYPE record<Thing>;

DEFINE TABLE UserAccounts SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE UserAccounts_user SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserAccounts_user TYPE record<UserAccounts>;
DEFINE FIELD out ON TABLE UserAccounts_user TYPE record<User>;
DEFINE TABLE UserAccounts_accounts SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserAccounts_accounts TYPE record<UserAccounts>;
DEFINE FIELD out ON TABLE UserAccounts_accounts TYPE record<Account>;

DEFINE TABLE UserSessions SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE UserSessions_user SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserSessions_user TYPE record<UserSessions>;
DEFINE FIELD out ON TABLE UserSessions_user TYPE record<User>;
DEFINE TABLE UserSessions_accounts SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserSessions_accounts TYPE record<UserSessions>;
DEFINE FIELD out ON TABLE UserSessions_accounts TYPE record<Session>;

DEFINE TABLE SpaceUser SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE SpaceUser_spaces SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE SpaceUser_spaces TYPE record<SpaceUser>;
DEFINE FIELD out ON TABLE SpaceUser_spaces TYPE record<Space>;
DEFINE TABLE SpaceUser_users SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE SpaceUser_users TYPE record<SpaceUser>;
DEFINE FIELD out ON TABLE SpaceUser_users TYPE record<User>;
DEFINE TABLE SpaceUser_power SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE SpaceUser_power TYPE record<SpaceUser>;
DEFINE FIELD out ON TABLE SpaceUser_power TYPE record<Power>;

DEFINE TABLE UserTag SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
DEFINE TABLE UserTag_users SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTag_users TYPE record<UserTag>;
DEFINE FIELD out ON TABLE UserTag_users TYPE record<User>;

DEFINE TABLE UserTagGroup SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE UserTagGroup_tags SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTagGroup_tags TYPE record<UserTagGroup>;
DEFINE FIELD out ON TABLE UserTagGroup_tags TYPE record<UserTag>;
DEFINE TABLE UserTagGroup_space SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTagGroup_space TYPE record<UserTagGroup>;
DEFINE FIELD out ON TABLE UserTagGroup_space TYPE record<Space>;
DEFINE TABLE UserTagGroup_color SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTagGroup_color TYPE record<UserTagGroup>;
DEFINE FIELD out ON TABLE UserTagGroup_color TYPE record<Color>;

DEFINE TABLE HookParent SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE HookParent_mainHook SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE HookParent_mainHook TYPE record<HookParent>;
DEFINE FIELD out ON TABLE HookParent_mainHook TYPE record<Hook>;
DEFINE TABLE HookParent_hooks SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE HookParent_hooks TYPE record<HookParent>;
DEFINE FIELD out ON TABLE HookParent_hooks TYPE record<Hook>;

DEFINE TABLE HookATag SCHEMALESS PERMISSIONS FULL;
DEFINE TABLE HookATag_hookTypeA SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE HookParent_hookTypeA TYPE record<HookATag>;
DEFINE FIELD out ON TABLE HookParent_hookTypeA TYPE record<Hook>;
DEFINE TABLE HookATag_otherHooks SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE HookParent_otherHooks TYPE record<HookATag>;
DEFINE FIELD out ON TABLE HookParent_otherHooks TYPE record<Hook>;

-- DEFINE TABLE SpaceObj SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE SpaceObj TYPE record<Space>;
-- DEFINE FIELD out ON TABLE SpaceObj TYPE record<Space>;

-- DEFINE TABLE SpaceDef SCHEMALESS PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE SpaceDef TYPE record<SpaceObj>;
-- DEFINE FIELD out ON TABLE SpaceDef TYPE record<SpaceObj>;
-- DEFINE FIELD description ON SpaceDef TYPE string;

DEFINE TABLE Kind SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD name ON Table Kind TYPE string;

DEFINE TABLE Kind_space SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE Kind_space TYPE record<Kind>;
DEFINE FIELD out ON TABLE Kind_space TYPE record<Space>;

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
DEFINE TABLE Self_space SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE Self_space TYPE record<Self>;
DEFINE FIELD out ON TABLE Self_space TYPE record<Space>;
DEFINE TABLE Self_owner SCHEMALESS PERMISSIONS FULL;
DEFINE FIELD in ON TABLE Self_owner TYPE record<Self>;
DEFINE FIELD out ON TABLE Self_owner TYPE record<Self>;

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