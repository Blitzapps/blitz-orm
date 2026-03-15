OPTION IMPORT;
USE NS test;
USE DB test;

BEGIN TRANSACTION;
-- ENTITIES
  DEFINE TABLE User SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE User TYPE option<string>;
      DEFINE FIELD email ON TABLE User TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD accounts ON TABLE User COMPUTED array::distinct(array::flatten(<~(⟨User-Accounts⟩ FIELD user).accounts ?? []));
      DEFINE FIELD sessions ON TABLE User COMPUTED array::distinct(array::flatten(<~(⟨User-Sessions⟩ FIELD user).sessions ?? []));
      DEFINE FIELD spaces ON TABLE User COMPUTED array::distinct(array::flatten(<~(⟨Space-User⟩ FIELD users).spaces ?? []));
      DEFINE FIELD user_tags ON TABLE User COMPUTED <~(UserTag FIELD users);

  DEFINE TABLE SuperUser SCHEMAFULL PERMISSIONS FULL; //EXTENDS User;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE SuperUser TYPE option<string>;
      DEFINE FIELD email ON TABLE SuperUser TYPE option<string>;
      DEFINE FIELD power ON TABLE SuperUser TYPE string;
    -- LINK FIELDS
      DEFINE FIELD accounts ON TABLE SuperUser COMPUTED array::distinct(array::flatten(<~(⟨User-Accounts⟩ FIELD user).accounts ?? []));
      DEFINE FIELD sessions ON TABLE SuperUser COMPUTED array::distinct(array::flatten(<~(⟨User-Sessions⟩ FIELD user).sessions ?? []));
      DEFINE FIELD spaces ON TABLE SuperUser COMPUTED array::distinct(array::flatten(<~(⟨Space-User⟩ FIELD users).spaces ?? []));
      DEFINE FIELD user_tags ON TABLE SuperUser COMPUTED <~(UserTag FIELD users);

  DEFINE TABLE God SCHEMAFULL PERMISSIONS FULL; //EXTENDS SuperUser;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE God TYPE option<string>;
      DEFINE FIELD email ON TABLE God TYPE option<string>;
      DEFINE FIELD power ON TABLE God TYPE string;
      DEFINE FIELD isEvil ON TABLE God TYPE bool;
    -- LINK FIELDS
      DEFINE FIELD accounts ON TABLE God COMPUTED array::distinct(array::flatten(<~(⟨User-Accounts⟩ FIELD user).accounts ?? []));
      DEFINE FIELD sessions ON TABLE God COMPUTED array::distinct(array::flatten(<~(⟨User-Sessions⟩ FIELD user).sessions ?? []));
      DEFINE FIELD spaces ON TABLE God COMPUTED array::distinct(array::flatten(<~(⟨Space-User⟩ FIELD users).spaces ?? []));
      DEFINE FIELD user_tags ON TABLE God COMPUTED <~(UserTag FIELD users);

  DEFINE TABLE Space SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE Space TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD users ON TABLE Space COMPUTED array::distinct(array::flatten(<~(⟨Space-User⟩ FIELD spaces).users ?? []));
      DEFINE FIELD objects ON TABLE Space COMPUTED array::distinct(array::concat(<~(SpaceObj FIELD space) ?? [], <~(SpaceDef FIELD space) ?? [], <~(Kind FIELD space) ?? [], <~(Field FIELD space) ?? [], <~(DataField FIELD space) ?? [], <~(Self FIELD space) ?? []));
      DEFINE FIELD definitions ON TABLE Space COMPUTED array::distinct(array::concat(<~(SpaceDef FIELD space) ?? [], <~(Kind FIELD space) ?? [], <~(Field FIELD space) ?? [], <~(DataField FIELD space) ?? []));
      DEFINE FIELD kinds ON TABLE Space COMPUTED <~(Kind FIELD space);
      DEFINE FIELD fields ON TABLE Space COMPUTED array::distinct(array::concat(<~(Field FIELD space) ?? [], <~(DataField FIELD space) ?? []));
      DEFINE FIELD dataFields ON TABLE Space COMPUTED <~(DataField FIELD space);
      DEFINE FIELD selfs ON TABLE Space COMPUTED <~(Self FIELD space);
      DEFINE FIELD userTagGroups ON TABLE Space COMPUTED <~(UserTagGroup FIELD space);
      DEFINE FIELD flexRefRels ON TABLE Space COMPUTED <~(FlexRefRel FIELD space);

  DEFINE TABLE Account SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD provider ON TABLE Account TYPE option<string>;
      DEFINE FIELD isSecureProvider ON TABLE Account COMPUTED ($this.provider = "google");
      DEFINE FIELD profile ON TABLE Account TYPE any;
    -- LINK FIELDS
      DEFINE FIELD user ON TABLE Account COMPUTED array::first(<~(⟨User-Accounts⟩ FIELD accounts).user ?? []);

  DEFINE TABLE Session SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD expires ON TABLE Session TYPE option<datetime>;
      DEFINE FIELD sessionToken ON TABLE Session TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD user ON TABLE Session COMPUTED array::first(<~(⟨User-Sessions⟩ FIELD sessions).user ?? []);

  DEFINE TABLE VerificationToken SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD identifier ON TABLE VerificationToken TYPE option<string>;
      DEFINE FIELD token ON TABLE VerificationToken TYPE option<string>;
      DEFINE FIELD expires ON TABLE VerificationToken TYPE option<datetime>;
    -- LINK FIELDS

  DEFINE TABLE Thing SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD stuff ON TABLE Thing TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD things ON TABLE Thing COMPUTED <~(ThingRelation FIELD things);
      DEFINE FIELD root ON TABLE Thing COMPUTED array::first(<~(ThingRelation FIELD root) ?? []);
      DEFINE FIELD extra ON TABLE Thing COMPUTED array::first(<~(ThingRelation FIELD extra) ?? []);

  DEFINE TABLE SubthingOne SCHEMAFULL PERMISSIONS FULL; //EXTENDS Thing;
    -- DATA FIELDS
      DEFINE FIELD stuff ON TABLE SubthingOne TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD things ON TABLE SubthingOne COMPUTED <~(ThingRelation FIELD things);
      DEFINE FIELD root ON TABLE SubthingOne COMPUTED array::first(<~(ThingRelation FIELD root) ?? []);
      DEFINE FIELD extra ON TABLE SubthingOne COMPUTED array::first(<~(ThingRelation FIELD extra) ?? []);

  DEFINE TABLE SubthingTwo SCHEMAFULL PERMISSIONS FULL; //EXTENDS Thing;
    -- DATA FIELDS
      DEFINE FIELD stuff ON TABLE SubthingTwo TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD things ON TABLE SubthingTwo COMPUTED <~(ThingRelation FIELD things);
      DEFINE FIELD root ON TABLE SubthingTwo COMPUTED array::first(<~(ThingRelation FIELD root) ?? []);
      DEFINE FIELD extra ON TABLE SubthingTwo COMPUTED array::first(<~(ThingRelation FIELD extra) ?? []);

  DEFINE TABLE CascadeThing SCHEMAFULL PERMISSIONS FULL;
    -- LINK FIELDS
      DEFINE FIELD cascadeRelations ON TABLE CascadeThing COMPUTED <~(CascadeRelation FIELD things);

  DEFINE TABLE Color SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD freeForAll ON TABLE Color TYPE any;
      DEFINE FIELD value ON TABLE Color TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD user_tags ON TABLE Color COMPUTED array::distinct(array::flatten(<~(UserTagGroup FIELD color).tags ?? []));
      DEFINE FIELD group ON TABLE Color COMPUTED array::first(<~(UserTagGroup FIELD color) ?? []);

  DEFINE TABLE Power SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD description ON TABLE Power TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD space_user ON TABLE Power COMPUTED array::first(<~(⟨Space-User⟩ FIELD power) ?? []);

  DEFINE TABLE FlexRef SCHEMAFULL PERMISSIONS FULL;
    -- REF FIELDS
      DEFINE FIELD reference ON TABLE FlexRef TYPE option<record>;
      DEFINE FIELD references ON TABLE FlexRef TYPE option<array<record>>;
      DEFINE FIELD flexReference ON TABLE FlexRef TYPE any;
      DEFINE FIELD flexReferences ON TABLE FlexRef TYPE any;

  DEFINE TABLE Hook SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD requiredOption ON TABLE Hook TYPE "a"|"b"|"c";
      DEFINE FIELD manyOptions ON TABLE Hook TYPE option<array<"a"|"b"|"c">>;
      DEFINE FIELD fnValidatedField ON TABLE Hook TYPE option<string>;
      DEFINE FIELD timestamp ON TABLE Hook TYPE option<datetime>;
    -- LINK FIELDS
      DEFINE FIELD hookParent ON TABLE Hook COMPUTED array::first(<~(HookParent FIELD hooks) ?? []);
      DEFINE FIELD asMainHookOf ON TABLE Hook COMPUTED array::first(<~(HookParent FIELD mainHook) ?? []);
      DEFINE FIELD otherTags ON TABLE Hook VALUE IF (requiredOption = "a") { (SELECT VALUE id FROM Hook WHERE (requiredOption != "a")) } ELSE { [] };
      DEFINE FIELD tagA ON TABLE Hook VALUE IF (requiredOption != "a") { (SELECT VALUE id FROM Hook WHERE (requiredOption = "a")) } ELSE { [] };

  DEFINE TABLE Company SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE Company TYPE string;
      DEFINE FIELD industry ON TABLE Company TYPE option<"Tech"|"Finance"|"Healthcare"|"Retail"|"Manufacturing">;
    -- LINK FIELDS
      DEFINE FIELD employees ON TABLE Company COMPUTED <~(Employee FIELD company);

-- RELATIONS
  DEFINE TABLE ⟨User-Accounts⟩ SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD accounts ON TABLE ⟨User-Accounts⟩ TYPE option<array<record<Account>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD user ON TABLE ⟨User-Accounts⟩ TYPE option<record<User|SuperUser|God>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE ⟨User-Sessions⟩ SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD sessions ON TABLE ⟨User-Sessions⟩ TYPE option<array<record<Session>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD user ON TABLE ⟨User-Sessions⟩ TYPE option<record<User|SuperUser|God>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE ⟨Space-User⟩ SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD spaces ON TABLE ⟨Space-User⟩ TYPE option<array<record<Space>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD users ON TABLE ⟨Space-User⟩ TYPE option<array<record<User|SuperUser|God>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD power ON TABLE ⟨Space-User⟩ TYPE option<record<Power>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE UserTag SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD color ON TABLE UserTag COMPUTED array::first(<~(UserTagGroup FIELD tags).color ?? []);
      DEFINE FIELD group ON TABLE UserTag COMPUTED array::first(<~(UserTagGroup FIELD tags) ?? []);
    -- ROLES
      DEFINE FIELD users ON TABLE UserTag TYPE option<array<record<User|SuperUser|God>>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE UserTagGroup SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD tags ON TABLE UserTagGroup TYPE option<array<record<UserTag>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD color ON TABLE UserTagGroup TYPE option<record<Color>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD space ON TABLE UserTagGroup TYPE option<record<Space>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE SpaceObj SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD space ON TABLE SpaceObj TYPE option<record<Space>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE SpaceDef SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceObj;
    -- DATA FIELDS
      DEFINE FIELD description ON TABLE SpaceDef TYPE option<string>;
    -- ROLES
      DEFINE FIELD space ON TABLE SpaceDef TYPE option<record<Space>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE Kind SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceDef;
    -- DATA FIELDS
      DEFINE FIELD description ON TABLE Kind TYPE option<string>;
      DEFINE FIELD name ON TABLE Kind TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD fields ON TABLE Kind COMPUTED array::distinct(array::concat(<~(Field FIELD kinds) ?? [], <~(DataField FIELD kinds) ?? []));
      DEFINE FIELD dataFields ON TABLE Kind COMPUTED <~(DataField FIELD kinds);
    -- ROLES
      DEFINE FIELD space ON TABLE Kind TYPE option<record<Space>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE Field SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceDef;
    -- DATA FIELDS
      DEFINE FIELD description ON TABLE Field TYPE option<string>;
      DEFINE FIELD name ON TABLE Field TYPE option<string>;
      DEFINE FIELD cardinality ON TABLE Field TYPE option<string>;
    -- ROLES
      DEFINE FIELD space ON TABLE Field TYPE option<record<Space>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD kinds ON TABLE Field TYPE option<array<record<Kind>>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE DataField SCHEMAFULL PERMISSIONS FULL; //EXTENDS Field;
    -- DATA FIELDS
      DEFINE FIELD description ON TABLE DataField TYPE option<string>;
      DEFINE FIELD name ON TABLE DataField TYPE option<string>;
      DEFINE FIELD cardinality ON TABLE DataField TYPE option<string>;
      DEFINE FIELD type ON TABLE DataField TYPE option<string>;
      DEFINE FIELD computeType ON TABLE DataField TYPE option<string>;
    -- LINK FIELDS
      DEFINE FIELD values ON TABLE DataField COMPUTED <~(DataValue FIELD dataField);
      DEFINE FIELD expression ON TABLE DataField COMPUTED array::first(<~(Expression FIELD dataField) ?? []);
    -- ROLES
      DEFINE FIELD space ON TABLE DataField TYPE option<record<Space>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD kinds ON TABLE DataField TYPE option<array<record<Kind>>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE DataValue SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD type ON TABLE DataValue TYPE option<string>;
    -- ROLES
      DEFINE FIELD dataField ON TABLE DataValue TYPE option<record<DataField>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE Expression SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD value ON TABLE Expression TYPE option<string>;
      DEFINE FIELD type ON TABLE Expression TYPE option<string>;
    -- ROLES
      DEFINE FIELD dataField ON TABLE Expression TYPE option<record<DataField>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE Self SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceObj;
    -- LINK FIELDS
      DEFINE FIELD owned ON TABLE Self COMPUTED <~(Self FIELD owner);
    -- ROLES
      DEFINE FIELD space ON TABLE Self TYPE option<record<Space>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD owner ON TABLE Self TYPE option<record<Self>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE ThingRelation SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD moreStuff ON TABLE ThingRelation TYPE option<string>;
    -- ROLES
      DEFINE FIELD things ON TABLE ThingRelation TYPE option<array<record<Thing|SubthingOne|SubthingTwo>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD root ON TABLE ThingRelation TYPE option<record<Thing|SubthingOne|SubthingTwo>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD extra ON TABLE ThingRelation TYPE option<record<Thing|SubthingOne|SubthingTwo>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE CascadeRelation SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD things ON TABLE CascadeRelation TYPE option<array<record<CascadeThing>>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE HookParent SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD hooks ON TABLE HookParent TYPE option<array<record<Hook>>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD mainHook ON TABLE HookParent TYPE option<record<Hook>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE HookATag SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD hookTypeA ON TABLE HookATag TYPE option<record<Hook>> REFERENCE ON DELETE UNSET;
      DEFINE FIELD otherHooks ON TABLE HookATag TYPE option<array<record<Hook>>> REFERENCE ON DELETE UNSET;

  DEFINE TABLE FlexRefRel SCHEMAFULL PERMISSIONS FULL;
    -- ROLES
      DEFINE FIELD space ON TABLE FlexRefRel TYPE option<record<Space>> REFERENCE ON DELETE UNSET;
    -- REF FIELDS
      DEFINE FIELD reference ON TABLE FlexRefRel TYPE option<record>;
      DEFINE FIELD references ON TABLE FlexRefRel TYPE option<array<record>>;
      DEFINE FIELD flexReference ON TABLE FlexRefRel TYPE any;
      DEFINE FIELD flexReferences ON TABLE FlexRefRel TYPE any;

  DEFINE TABLE Employee SCHEMAFULL PERMISSIONS FULL;
    -- DATA FIELDS
      DEFINE FIELD name ON TABLE Employee TYPE string;
    -- ROLES
      DEFINE FIELD company ON TABLE Employee TYPE option<record<Company>> REFERENCE ON DELETE UNSET;

-- INTERNAL
  DEFINE TABLE Delta SCHEMALESS PERMISSIONS FULL;
COMMIT TRANSACTION;
