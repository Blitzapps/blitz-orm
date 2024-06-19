USE NS test;
USE DB test;

DEFINE TABLE User SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE User TYPE option<string>;
DEFINE FIELD email ON TABLE User TYPE option<string>;


-- there is no subtyping in SurrealDB, we need to duplicate the fields
DEFINE TABLE SuperUser SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE SuperUser TYPE option<string>;
DEFINE FIELD email ON TABLE SuperUser TYPE string;
DEFINE FIELD power ON TABLE SuperUser TYPE string;

-- there is no subtyping in SurrealDB, we need to duplicate the fields
DEFINE TABLE God SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE God TYPE option<string>;
DEFINE FIELD email ON TABLE God TYPE string;
DEFINE FIELD power ON TABLE God TYPE string;
DEFINE FIELD isEvil ON TABLE God TYPE bool;

DEFINE TABLE Space SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Space TYPE option<string>;

DEFINE TABLE Thing SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE Thing TYPE string;
-- there is no subtyping in SurrealDB
DEFINE TABLE SubthingOne SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE SubthingOne TYPE string;
DEFINE TABLE SubthingTwo SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE SubthingTwo TYPE string;

DEFINE TABLE Account SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD provider ON TABLE Account TYPE option<string>;
DEFINE FIELD isSecureProvider ON TABLE Account VALUE {$this.provider = "google"} TYPE option<bool>; --<future> not needed when there are parameters
DEFINE FIELD profile ON TABLE Account FLEXIBLE TYPE option<object>;


DEFINE TABLE Post SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD mentions ON TABLE Post TYPE array<string>;

DEFINE TABLE Color SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Color TYPE option<option><string>;
DEFINE FIELD freeForAll ON TABLE Color FLEXIBLE TYPE option<string|number|datetime|bool>;

DEFINE TABLE Power SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD description ON TABLE Power TYPE string;

DEFINE TABLE Session SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD sessionToken ON TABLE Session TYPE string;
DEFINE FIELD expires ON TABLE Session TYPE datetime;

DEFINE TABLE Hook SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD timestamp ON TABLE Hook TYPE option<datetime>;
DEFINE FIELD requiredOption ON TABLE Hook TYPE string;
DEFINE FIELD manyOptions ON TABLE Hook TYPE option<string>;
DEFINE FIELD fnValidatedField ON TABLE Hook TYPE option<string>;
DEFINE FIELD otherTags ON TABLE Hook VALUE <future> {
  RETURN 
  IF (requiredOption = "a") THEN ( RETURN SELECT VALUE id FROM Hook WHERE (requiredOption != "a"))
  ELSE RETURN []
  END;
};
DEFINE FIELD tagA ON TABLE Hook VALUE <future> {
  RETURN 
  IF (requiredOption != "a") THEN ( RETURN SELECT VALUE id FROM Hook WHERE (requiredOption = "a"))
  ELSE RETURN []
  END;
};


-- relationship
DEFINE TABLE ThingRelation SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE ThingRelation_root SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ThingRelation_root TYPE record<ThingRelation>;
DEFINE FIELD out ON TABLE ThingRelation_root TYPE record<Thing>;
DEFINE TABLE ThingRelation_extra SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ThingRelation_extra TYPE record<ThingRelation>;
DEFINE FIELD out ON TABLE ThingRelation_extra TYPE record<Thing>;
DEFINE TABLE ThingRelation_things SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ThingRelation_things TYPE record<ThingRelation>;
DEFINE FIELD out ON TABLE ThingRelation_things TYPE record<Thing>;

DEFINE TABLE ⟨`User-Accounts`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE ⟨`User-Accounts_user`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`User-Accounts_user`⟩ TYPE record<⟨`User-Accounts`⟩>;
DEFINE FIELD out ON TABLE ⟨`User-Accounts_user`⟩ TYPE record<User>;
DEFINE TABLE ⟨`User-Accounts_accounts`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`User-Accounts_accounts`⟩ TYPE record<⟨`User-Accounts`⟩>;
DEFINE FIELD out ON TABLE ⟨`User-Accounts_accounts`⟩ TYPE record<Account>;

DEFINE TABLE ⟨`User-Sessions`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE ⟨`User-Sessions_user`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`User-Sessions_user`⟩ TYPE record<⟨`User-Sessions`⟩>;
DEFINE FIELD out ON TABLE ⟨`User-Sessions_user`⟩ TYPE record<User>;
DEFINE TABLE ⟨`User-Sessions_accounts`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`User-Sessions_accounts`⟩ TYPE record<⟨`User-Sessions`⟩>;
DEFINE FIELD out ON TABLE ⟨`User-Sessions_accounts`⟩ TYPE record<Session>;

DEFINE TABLE ⟨`Space-User`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE ⟨`Space-User_spaces`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`Space-User_spaces`⟩ TYPE record<⟨`Space-User`⟩>;
DEFINE FIELD out ON TABLE ⟨`Space-User_spaces`⟩ TYPE record<Space>;
DEFINE TABLE ⟨`Space-User_users`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`Space-User_users`⟩ TYPE record<⟨`Space-User`⟩>;
DEFINE FIELD out ON TABLE ⟨`Space-User_users`⟩ TYPE record<User>;
DEFINE TABLE ⟨`Space-User_power`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE ⟨`Space-User_power`⟩ TYPE record<⟨`Space-User`⟩>;
DEFINE FIELD out ON TABLE ⟨`Space-User_power`⟩ TYPE record<Power>;

DEFINE TABLE UserTag SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE UserTag TYPE option<option><string>;
DEFINE TABLE UserTag_users SCHEMAFULL PERMISSIONS FULL type RELATION;
DEFINE FIELD in ON TABLE UserTag_users TYPE record<UserTag>;
DEFINE FIELD out ON TABLE UserTag_users TYPE record<User>;

DEFINE TABLE UserTagGroup SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE UserTagGroup_tags SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTagGroup_tags TYPE record<UserTagGroup>;
DEFINE FIELD out ON TABLE UserTagGroup_tags TYPE record<UserTag>;
DEFINE TABLE UserTagGroup_space SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTagGroup_space TYPE record<UserTagGroup>;
DEFINE FIELD out ON TABLE UserTagGroup_space TYPE record<Space>;
DEFINE TABLE UserTagGroup_color SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE UserTagGroup_color TYPE record<UserTagGroup>;
DEFINE FIELD out ON TABLE UserTagGroup_color TYPE record<Color>;

DEFINE TABLE HookParent SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE HookParent_mainHook SCHEMAFULL PERMISSIONS FULL TYPE RELATION in HookParent out Hook;
DEFINE TABLE HookParent_hooks SCHEMAFULL PERMISSIONS FULL TYPE RELATION in HookParent out Hook;


DEFINE TABLE HookATag SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE HookATag_hookTypeA SCHEMAFULL PERMISSIONS FULL TYPE RELATION in HookATag out Hook;
DEFINE TABLE HookATag_otherHooks SCHEMAFULL PERMISSIONS FULL TYPE RELATION in HookATag out Hook;

DEFINE TABLE SpaceObj SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE SpaceObj_space SCHEMAFULL PERMISSIONS FULL TYPE RELATION in SpaceObj|SpaceDef|Kind|Self out Space;

DEFINE TABLE SpaceDef SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD description ON SpaceDef TYPE string;

DEFINE TABLE Kind SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON Table Kind TYPE string;


-- DEFINE TABLE Field SCHEMAFULL PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE Field TYPE record<SpaceDef>;
-- DEFINE FIELD out ON TABLE Field TYPE record<SpaceDef>;
-- DEFINE FIELD name ON Field TYPE string;
-- DEFINE FIELD cardinality ON Field TYPE string;

-- DEFINE TABLE DataField SCHEMAFULL PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE DataField TYPE record<Field>;
-- DEFINE FIELD out ON TABLE DataField TYPE record<Field>;
-- DEFINE FIELD type ON DataField TYPE string;
-- DEFINE FIELD computeType ON DataField TYPE string;

-- DEFINE TABLE Expression SCHEMAFULL PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE Expression TYPE record<DataField>;
-- DEFINE FIELD out ON TABLE Expression TYPE record<DataField>;
-- DEFINE FIELD value ON Expression TYPE string;

-- DEFINE TABLE DataValue SCHEMAFULL PERMISSIONS FULL;
-- DEFINE FIELD in ON TABLE DataValue TYPE record<DataField>;
-- DEFINE FIELD out ON TABLE DataValue TYPE record<DataField>;
-- DEFINE FIELD type ON DataValue TYPE string;

DEFINE TABLE Self SCHEMAFULL PERMISSIONS FULL;
DEFINE TABLE Self_space SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE Self_space TYPE record<Self>;
DEFINE FIELD out ON TABLE Self_space TYPE record<Space>;
DEFINE TABLE Self_owner SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON TABLE Self_owner TYPE record<Self>;
DEFINE FIELD out ON TABLE Self_owner TYPE record<Self>;

-- relations END

-- #2 With parent tag rule	
-- rule add-hook-type-a-tag: when {
-- 	  $hook isa Hook, has Hook·requiredOption "a";
-- 		$otherHooks isa Hook;
-- 		not { $hook is $otherHooks; };
-- 		not { $otherHooks has Hook·requiredOption "a"; };
	
-- } then {
-- 	  (hookTypeA: $hook, otherHooks: $otherHooks) isa HookATag;
-- };