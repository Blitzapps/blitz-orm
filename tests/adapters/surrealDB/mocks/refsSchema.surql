USE NS test;
USE DB test;

BEGIN TRANSACTION;
-- ENTITIES
	DEFINE TABLE User SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE User TYPE option<string>;
			DEFINE FIELD email ON TABLE User TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD accounts ON TABLE User VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.accounts || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE User TYPE references<⟨User-Accounts⟩, user>;
			DEFINE FIELD sessions ON TABLE User VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.sessions || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE User TYPE references<⟨User-Sessions⟩, user>;
			DEFINE FIELD spaces ON TABLE User VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.spaces || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE User TYPE references<⟨Space-User⟩, users>;
			DEFINE FIELD ⟨user-tags⟩ ON TABLE User TYPE option<array<record<UserTag>>>;

	DEFINE TABLE SuperUser SCHEMAFULL PERMISSIONS FULL; //EXTENDS User;
		-- DATA FIELDS
			DEFINE FIELD power ON TABLE SuperUser TYPE string;
			DEFINE FIELD name ON TABLE SuperUser TYPE option<string>;
			DEFINE FIELD email ON TABLE SuperUser TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD accounts ON TABLE SuperUser VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.accounts || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE SuperUser TYPE references<⟨User-Accounts⟩, user>;
			DEFINE FIELD sessions ON TABLE SuperUser VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.sessions || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE SuperUser TYPE references<⟨User-Sessions⟩, user>;
			DEFINE FIELD spaces ON TABLE SuperUser VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.spaces || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE SuperUser TYPE references<⟨Space-User⟩, users>;
			DEFINE FIELD ⟨user-tags⟩ ON TABLE SuperUser TYPE option<array<record<UserTag>>>;

	DEFINE TABLE God SCHEMAFULL PERMISSIONS FULL; //EXTENDS SuperUser;
		-- DATA FIELDS
			DEFINE FIELD isEvil ON TABLE God TYPE bool;
			DEFINE FIELD power ON TABLE God TYPE string;
			DEFINE FIELD name ON TABLE God TYPE option<string>;
			DEFINE FIELD email ON TABLE God TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD accounts ON TABLE God VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.accounts || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE God TYPE references<⟨User-Accounts⟩, user>;
			DEFINE FIELD sessions ON TABLE God VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.sessions || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE God TYPE references<⟨User-Sessions⟩, user>;
			DEFINE FIELD spaces ON TABLE God VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.spaces || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE God TYPE references<⟨Space-User⟩, users>;
			DEFINE FIELD ⟨user-tags⟩ ON TABLE God TYPE option<array<record<UserTag>>>;

	DEFINE TABLE Space SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Space TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD users ON TABLE Space VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.users || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE Space TYPE references<⟨Space-User⟩, spaces>;
			DEFINE FIELD objects ON TABLE Space TYPE option<array<record<SpaceObj|Self|DataField|Field|Kind|SpaceDef>>>;
			DEFINE FIELD definitions ON TABLE Space TYPE option<array<record<SpaceDef|DataField|Field|Kind>>>;
			DEFINE FIELD kinds ON TABLE Space TYPE option<array<record<Kind>>>;
			DEFINE FIELD fields ON TABLE Space TYPE option<array<record<Field|DataField>>>;
			DEFINE FIELD dataFields ON TABLE Space TYPE option<array<record<DataField>>>;
			DEFINE FIELD selfs ON TABLE Space TYPE option<array<record<Self>>>;
			DEFINE FIELD userTagGroups ON TABLE Space TYPE option<array<record<UserTagGroup>>>;

	DEFINE TABLE Account SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD provider ON TABLE Account TYPE option<string>;
			DEFINE FIELD isSecureProvider ON TABLE Account VALUE {$this.provider = "google"} TYPE option<bool>;
			DEFINE FIELD profile ON TABLE Account FLEXIBLE TYPE option<object>;
		-- LINK FIELDS
			DEFINE FIELD user ON TABLE Account VALUE <future> {RETURN SELECT VALUE ⟨user-accounts⟩.user FROM ONLY $this};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE Account TYPE option<record<⟨User-Accounts⟩>>;

	DEFINE TABLE Session SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD expires ON TABLE Session TYPE option<datetime>;
			DEFINE FIELD sessionToken ON TABLE Session TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD user ON TABLE Session VALUE <future> {RETURN SELECT VALUE ⟨user-sessions⟩.user FROM ONLY $this};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE Session TYPE option<record<⟨User-Sessions⟩>>;

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
			DEFINE FIELD things ON TABLE Thing TYPE option<array<record<ThingRelation>>>;
			DEFINE FIELD root ON TABLE Thing TYPE option<record<ThingRelation>>;
			DEFINE FIELD extra ON TABLE Thing TYPE option<record<ThingRelation>>;

	DEFINE TABLE SubthingOne SCHEMAFULL PERMISSIONS FULL; //EXTENDS Thing;
		-- DATA FIELDS
			DEFINE FIELD stuff ON TABLE SubthingOne TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD things ON TABLE SubthingOne TYPE option<array<record<ThingRelation>>>;
			DEFINE FIELD root ON TABLE SubthingOne TYPE option<record<ThingRelation>>;
			DEFINE FIELD extra ON TABLE SubthingOne TYPE option<record<ThingRelation>>;

	DEFINE TABLE SubthingTwo SCHEMAFULL PERMISSIONS FULL; //EXTENDS Thing;
		-- DATA FIELDS
			DEFINE FIELD stuff ON TABLE SubthingTwo TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD things ON TABLE SubthingTwo TYPE option<array<record<ThingRelation>>>;
			DEFINE FIELD root ON TABLE SubthingTwo TYPE option<record<ThingRelation>>;
			DEFINE FIELD extra ON TABLE SubthingTwo TYPE option<record<ThingRelation>>;

	DEFINE TABLE CascadeThing SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS
			DEFINE FIELD cascadeRelations ON TABLE CascadeThing TYPE option<array<record<CascadeRelation>>>;

	DEFINE TABLE Color SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD freeForAll ON TABLE Color FLEXIBLE TYPE option<bool|bytes|datetime|duration|geometry|number|object|string>;
			DEFINE FIELD value ON TABLE Color TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD ⟨user-tags⟩ ON TABLE Color VALUE <future> {array::distinct(SELECT VALUE array::flatten(group.tags || []) FROM ONLY $this)};

			DEFINE FIELD group ON TABLE Color TYPE option<record<UserTagGroup>>;

	DEFINE TABLE Power SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD description ON TABLE Power TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD ⟨space-user⟩ ON TABLE Power TYPE references<⟨Space-User⟩, power>;

	DEFINE TABLE Hook SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD requiredOption ON TABLE Hook TYPE "a"|"b"|"c";
			DEFINE FIELD manyOptions ON TABLE Hook TYPE option<"a"|"b"|"c">;
			DEFINE FIELD fnValidatedField ON TABLE Hook TYPE option<string>;
			DEFINE FIELD timestamp ON TABLE Hook TYPE option<datetime>;
		-- LINK FIELDS
			DEFINE FIELD hookParent ON TABLE Hook TYPE option<record<HookParent>>;
			DEFINE FIELD asMainHookOf ON TABLE Hook TYPE option<record<HookParent>>;
			DEFINE FIELD otherTags ON TABLE Hook VALUE <future> {RETURN IF (requiredOption = "a") THEN ( RETURN SELECT VALUE id FROM Hook WHERE (requiredOption != "a")) ELSE RETURN [] END;};
			DEFINE FIELD tagA ON TABLE Hook VALUE <future> {RETURN IF (requiredOption != "a") THEN ( RETURN SELECT VALUE id FROM Hook WHERE (requiredOption = "a")) ELSE RETURN [] END;};

	DEFINE TABLE Company SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Company TYPE string;
			DEFINE FIELD industry ON TABLE Company TYPE option<"Tech"|"Finance"|"Healthcare"|"Retail"|"Manufacturing">;
		-- LINK FIELDS
			DEFINE FIELD employees ON TABLE Company TYPE option<array<record<Employee>>>;
-- RELATIONS
	DEFINE TABLE ⟨User-Accounts⟩ SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD accounts ON TABLE ⟨User-Accounts⟩ TYPE option<array<record<Account>>> REFERENCE;
			DEFINE FIELD user ON TABLE ⟨User-Accounts⟩ TYPE option<record<God|SuperUser|User>> REFERENCE;

	DEFINE TABLE ⟨User-Sessions⟩ SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD sessions ON TABLE ⟨User-Sessions⟩ TYPE option<array<record<Session>>> REFERENCE;
			DEFINE FIELD user ON TABLE ⟨User-Sessions⟩ TYPE option<record<God|SuperUser|User>> REFERENCE;

	DEFINE TABLE ⟨Space-User⟩ SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD spaces ON TABLE ⟨Space-User⟩ TYPE option<array<record<Space>>> REFERENCE;
			DEFINE FIELD users ON TABLE ⟨Space-User⟩ TYPE option<array<record<God|SuperUser|User>>> REFERENCE;
			DEFINE FIELD power ON TABLE ⟨Space-User⟩ TYPE option<record<Power>> REFERENCE;

	DEFINE TABLE UserTag SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD color ON TABLE UserTag VALUE <future> {RETURN SELECT VALUE group.color FROM ONLY $this};

			DEFINE FIELD group ON TABLE UserTag TYPE option<record<UserTagGroup>>;
		-- ROLES
			DEFINE FIELD users ON TABLE UserTag TYPE option<array<record<God|SuperUser|User>>> REFERENCE;

	DEFINE TABLE UserTagGroup SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD tags ON TABLE UserTagGroup TYPE option<array<record<UserTag>>> REFERENCE;
						DEFINE FIELD color ON TABLE UserTagGroup TYPE option<record<Color>> REFERENCE;
			DEFINE FIELD space ON TABLE UserTagGroup TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE SpaceObj SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD space ON TABLE SpaceObj TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE SpaceDef SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceObj;
		-- DATA FIELDS
			DEFINE FIELD description ON TABLE SpaceDef TYPE option<string>;
		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD space ON TABLE SpaceDef TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE Kind SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceDef;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Kind TYPE option<string>;
			DEFINE FIELD description ON TABLE Kind TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD fields ON TABLE Kind TYPE option<array<record<Field|DataField>>>;
			DEFINE FIELD dataFields ON TABLE Kind TYPE option<array<record<DataField>>>;
		-- ROLES
			DEFINE FIELD space ON TABLE Kind TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE Field SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceDef;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Field TYPE option<string>;
			DEFINE FIELD cardinality ON TABLE Field TYPE option<string>;
			DEFINE FIELD description ON TABLE Field TYPE option<string>;
		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD kinds ON TABLE Field TYPE option<array<record<Kind>>> REFERENCE;
			DEFINE FIELD space ON TABLE Field TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE DataField SCHEMAFULL PERMISSIONS FULL; //EXTENDS Field;
		-- DATA FIELDS
			DEFINE FIELD type ON TABLE DataField TYPE option<string>;
			DEFINE FIELD computeType ON TABLE DataField TYPE option<string>;
			DEFINE FIELD name ON TABLE DataField TYPE option<string>;
			DEFINE FIELD cardinality ON TABLE DataField TYPE option<string>;
			DEFINE FIELD description ON TABLE DataField TYPE option<string>;
		-- LINK FIELDS
			DEFINE FIELD values ON TABLE DataField TYPE option<array<record<DataValue>>>;
			DEFINE FIELD expression ON TABLE DataField TYPE option<record<Expression>>;
		-- ROLES
			DEFINE FIELD kinds ON TABLE DataField TYPE option<array<record<Kind>>> REFERENCE;
			DEFINE FIELD space ON TABLE DataField TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE DataValue SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD type ON TABLE DataValue TYPE option<string>;
		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD dataField ON TABLE DataValue TYPE option<record<DataField>> REFERENCE;

	DEFINE TABLE Expression SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD value ON TABLE Expression TYPE option<string>;
			DEFINE FIELD type ON TABLE Expression TYPE option<string>;
		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD dataField ON TABLE Expression TYPE option<record<DataField>> REFERENCE;

	DEFINE TABLE Self SCHEMAFULL PERMISSIONS FULL; //EXTENDS SpaceObj;
		-- DATA FIELDS

		-- LINK FIELDS
			DEFINE FIELD owned ON TABLE Self TYPE option<array<record<Self>>>;
		-- ROLES
			DEFINE FIELD owner ON TABLE Self TYPE option<record<Self>> REFERENCE;
			DEFINE FIELD space ON TABLE Self TYPE option<record<Space>> REFERENCE;

	DEFINE TABLE ThingRelation SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD moreStuff ON TABLE ThingRelation TYPE option<string>;
		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD things ON TABLE ThingRelation TYPE option<array<record<SubthingTwo|SubthingOne|Thing>>> REFERENCE;
			DEFINE FIELD root ON TABLE ThingRelation TYPE option<record<SubthingTwo|SubthingOne|Thing>> REFERENCE;
			DEFINE FIELD extra ON TABLE ThingRelation TYPE option<record<SubthingTwo|SubthingOne|Thing>> REFERENCE;

	DEFINE TABLE CascadeRelation SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD things ON TABLE CascadeRelation TYPE option<array<record<CascadeThing>>> REFERENCE;

	DEFINE TABLE HookParent SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD hooks ON TABLE HookParent TYPE option<array<record<Hook>>> REFERENCE;
			DEFINE FIELD mainHook ON TABLE HookParent TYPE option<record<Hook>> REFERENCE;

	DEFINE TABLE HookATag SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD hookTypeA ON TABLE HookATag TYPE option<record<Hook>> REFERENCE;
			DEFINE FIELD otherHooks ON TABLE HookATag TYPE option<array<record<Hook>>> REFERENCE;

	DEFINE TABLE Employee SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Employee TYPE string;
		-- LINK FIELDS

		-- ROLES
			DEFINE FIELD company ON TABLE Employee TYPE option<record<Company>>;
				DEFINE EVENT update_company ON TABLE Employee WHEN $before.company != $after.company THEN {
					IF ($before.company) THEN {UPDATE $before.company SET employees -= $before.id} END;
					IF ($after.company) THEN {UPDATE $after.company SET employees += $after.id} END;
				};

	DEFINE TABLE FlexRef SCHEMAFULL PERMISSIONS FULL; 
		-- DATA FIELDS
			DEFINE FIELD reference ON TABLE FlexRef TYPE option<record>;
			DEFINE FIELD references ON TABLE FlexRef TYPE option<array<record>>;
			DEFINE FIELD flexReference ON TABLE FlexRef TYPE option<record|bool|bytes|datetime|duration|geometry|number|object|string>;
			DEFINE FIELD flexReferences ON TABLE FlexRef TYPE option<array<record|bool|bytes|datetime|duration|geometry|number|object|string>>;
		
-- BORM TOOLS
	DEFINE FUNCTION fn::get_mutated_edges(
		$before_relation: option<array|record>,
		$after_relation: option<array|record>,
	) {
		LET $notEmptyCurrent = $before_relation ?? [];
		LET $current = array::flatten([$notEmptyCurrent]);
		LET $notEmptyResult = $after_relation ?? [];
		LET $result = array::flatten([$notEmptyResult]);
		LET $links = array::complement($result, $current);
		LET $unlinks = array::complement($current, $result);
		
		RETURN {
			additions: $links,
			deletions: $unlinks
		};
	};

	DEFINE FUNCTION fn::as_array($var: option<array<record>|record>) {           
		RETURN (type::is::array($var) AND $var) OR [$var]
	};
COMMIT TRANSACTION;