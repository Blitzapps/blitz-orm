USE NS test;
USE DB test;

DEFINE TABLE User SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE User TYPE string;
DEFINE FIELD email ON TABLE User TYPE option<string>;
DEFINE FIELD accounts ON TABLE User VALUE <future> { array::flatten(RETURN SELECT VALUE accounts FROM ⟨`User-Accounts`⟩ WHERE user ?= $parent.id);}; //LINKFIELD target:role
DEFINE FIELD spaces ON TABLE User VALUE <future> { array::flatten(RETURN SELECT VALUE spaces FROM ⟨`Space-User`⟩ WHERE users ?= $parent.id);};
DEFINE FIELD sessions ON TABLE User VALUE <future> { array::flatten(RETURN SELECT VALUE sessions FROM ⟨`User-Sessions`⟩ WHERE user ?= $parent.id);};
DEFINE FIELD `user-tags` ON TABLE User VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM UserTag WHERE users ?= $parent.id);}; //LINKFIELD target:relation

-- there is no subtyping in SurrealDB, we need to duplicate the fields
DEFINE TABLE SuperUser SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE SuperUser TYPE string;
DEFINE FIELD email ON TABLE SuperUser TYPE string;
DEFINE FIELD power ON TABLE SuperUser TYPE string;
DEFINE FIELD accounts ON TABLE SuperUser VALUE <future> { array::flatten(RETURN SELECT VALUE accounts FROM ⟨`User-Accounts`⟩ WHERE user ?= $parent.id);}; //LINKFIELD target:role
DEFINE FIELD spaces ON TABLE SuperUser VALUE <future> { array::flatten(RETURN SELECT VALUE spaces FROM ⟨`Space-User`⟩ WHERE users ?= $parent.id);};
DEFINE FIELD sessions ON TABLE SuperUser VALUE <future> { array::flatten(RETURN SELECT VALUE sessions FROM ⟨`User-Sessions`⟩ WHERE user ?= $parent.id);};
DEFINE FIELD `user-tags` ON TABLE SuperUser VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM UserTag WHERE users ?= $parent.id);}; //LINKFIELD target:relation

-- there is no subtyping in SurrealDB, we need to duplicate the fields
DEFINE TABLE God SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE God TYPE string;
DEFINE FIELD email ON TABLE God TYPE string;
DEFINE FIELD power ON TABLE God TYPE string;
DEFINE FIELD isEvil ON TABLE God TYPE bool;
DEFINE FIELD accounts ON TABLE God VALUE <future> { array::flatten(RETURN SELECT VALUE accounts FROM ⟨`User-Accounts`⟩ WHERE user ?= $parent.id);}; //LINKFIELD target:role
DEFINE FIELD spaces ON TABLE God VALUE <future> { array::flatten(RETURN SELECT VALUE spaces FROM ⟨`Space-User`⟩ WHERE users ?= $parent.id);};
DEFINE FIELD sessions ON TABLE God VALUE <future> { array::flatten(RETURN SELECT VALUE sessions FROM ⟨`User-Sessions`⟩ WHERE user ?= $parent.id);};
DEFINE FIELD `user-tags` ON TABLE God VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM UserTag WHERE users ?= $parent.id);}; //LINKFIELD target:relation

DEFINE TABLE Space SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Space TYPE string;
DEFINE FIELD users ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE users FROM ⟨`Space-User`⟩ WHERE spaces ?= $parent.id);};
DEFINE FIELD objects ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM SpaceObj, SpaceDef, Kind, Field, Self, DataField WHERE space ?= $parent.id);}; 
DEFINE FIELD definitions ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM SpaceDef, Kind, Field, DataField WHERE space ?= $parent.id);}; 
DEFINE FIELD kinds ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM Kind WHERE space ?= $parent.id);}; 
DEFINE FIELD fields ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM Field, DataField WHERE space ?= $parent.id);}; 
DEFINE FIELD dataFields ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM DataField WHERE space ?= $parent.id);}; 
DEFINE FIELD selfs ON TABLE Space VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM Self WHERE space ?= $parent.id);}; 

DEFINE TABLE Thing SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE Thing TYPE string;
-- there is no subtyping in SurrealDB
DEFINE TABLE SubthingOne SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE SubthingOne TYPE string;
DEFINE TABLE SubthingTwo SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD stuff ON TABLE SubthingTwo TYPE string;

DEFINE TABLE Account SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD provider ON TABLE Account TYPE string;
DEFINE FIELD isSecureProvider ON TABLE Account VALUE {$this.provider = "google"} TYPE option<bool>; --<future> not needed when there are parameters
DEFINE FIELD profile ON TABLE Account FLEXIBLE TYPE option<object>;
DEFINE FIELD user ON TABLE Account VALUE <future> { RETURN SELECT VALUE user FROM ⟨`User-Accounts`⟩ WHERE accounts ?= $parent.id;}; //LINKFIELD target:role


DEFINE TABLE Post SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD mentions ON TABLE Post TYPE array<string>;

DEFINE TABLE Color SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Color TYPE option<string>;
DEFINE FIELD freeForAll ON TABLE Color FLEXIBLE TYPE option<string|number|datetime|bool>;
DEFINE FIELD `user-tags` ON TABLE Color VALUE <future> { array::flatten(RETURN SELECT VALUE tags FROM UserTagGroup WHERE color ?= $parent.id);}; //LINKFIELD target:role
DEFINE FIELD group ON TABLE Color VALUE <future> { RETURN SELECT VALUE id FROM UserTagGroup WHERE color ?= $parent.id;}; //LINKFIELD target:relation

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
DEFINE FIELD root ON TABLE ThingRelation TYPE record<Thing>;
DEFINE FIELD extra ON TABLE ThingRelation TYPE record<Thing>;
DEFINE FIELD things ON TABLE ThingRelation TYPE array<record<Thing>>;


DEFINE TABLE ⟨`User-Accounts`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user ON TABLE ⟨`User-Accounts`⟩ TYPE record<User|God|SuperUser>;
DEFINE FIELD accounts ON TABLE ⟨`User-Accounts`⟩ TYPE array<record<Account>>;

DEFINE TABLE ⟨`User-Sessions`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user ON TABLE ⟨`User-Sessions`⟩ TYPE record<User|God|SuperUser>;
DEFINE FIELD sessions ON TABLE ⟨`User-Sessions`⟩ TYPE array<record<Session>>;

DEFINE TABLE ⟨`Space-User`⟩ SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD spaces ON TABLE ⟨`Space-User`⟩ TYPE array<record<Space>>;
DEFINE FIELD users ON TABLE ⟨`Space-User`⟩ TYPE array<record<User|God|SuperUser>>;
DEFINE FIELD power ON TABLE ⟨`Space-User`⟩ TYPE option<record<Power>>;

DEFINE TABLE UserTag SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
DEFINE FIELD users ON TABLE UserTag TYPE array<record<User|God|SuperUser>>;
DEFINE FIELD color ON TABLE UserTag VALUE <future> { RETURN SELECT VALUE color FROM UserTagGroup WHERE tags ?= $parent.id;}; //LINKFIELD target:role
DEFINE FIELD group ON TABLE UserTag VALUE <future> { RETURN SELECT VALUE id FROM UserTagGroup WHERE tags ?= $parent.id;}; //LINKFIELD target:relation

DEFINE TABLE UserTagGroup SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD tags ON TABLE UserTagGroup TYPE array<record<UserTag>>;
DEFINE FIELD space ON TABLE UserTagGroup TYPE option<record<Space>>;
DEFINE FIELD color ON TABLE UserTagGroup TYPE option<record<Color>>;

DEFINE TABLE HookParent SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD mainHook ON TABLE HookParent TYPE record<Hook>;
DEFINE FIELD hooks ON TABLE HookParent TYPE  array<record<Hook>>;

DEFINE TABLE HookATag SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD hookTypeA ON TABLE HookATag TYPE record<Hook>;
DEFINE FIELD otherHooks ON TABLE HookATag TYPE array<record<Hook>>;

DEFINE TABLE SpaceObj SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD space ON TABLE SpaceObj TYPE record<Space>;



DEFINE TABLE SpaceDef SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD space ON TABLE SpaceDef TYPE record<Space>;
DEFINE FIELD description ON SpaceDef TYPE string;

DEFINE TABLE Kind SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD space ON TABLE Kind TYPE record<Space>;
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
DEFINE FIELD space ON TABLE Self TYPE record<Space>;
DEFINE FIELD owner ON TABLE Self TYPE option<record<Self>>;
DEFINE FIELD owned ON TABLE Self VALUE <future> { RETURN SELECT VALUE id FROM Self WHERE owner ?= $parent.id;}; //LINKFIELD target:relation

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

DEFINE TABLE Employee SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Employee TYPE string;
DEFINE FIELD company ON TABLE Employee TYPE record<Company>;

DEFINE TABLE Company SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE Company TYPE string;
DEFINE FIELD industry ON TABLE Company TYPE string;
DEFINE FIELD employees ON TABLE Company VALUE <future> { array::flatten(RETURN SELECT VALUE id FROM Employee WHERE company ?= $parent.id);};


