USE NS test;
USE DB test;

BEGIN TRANSACTION;
-- ENTITIES
	DEFINE TABLE User SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE User TYPE option<string>;
			DEFINE FIELD email ON TABLE User TYPE option<string>;
		-- EDGES
			DEFINE FIELD accounts ON TABLE User VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.accounts || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE User TYPE option<array<record<⟨User-Accounts⟩>>>;
			DEFINE FIELD sessions ON TABLE User VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.sessions || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE User TYPE option<array<record<⟨User-Sessions⟩>>>;
			DEFINE FIELD spaces ON TABLE User VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.spaces || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE User TYPE option<array<record<⟨Space-User⟩>>>;
			DEFINE FIELD ⟨user-tags⟩ ON TABLE User TYPE option<array<record<UserTag>>>;

	DEFINE TABLE SuperUser SCHEMAFULL PERMISSIONS FULL; //EXTENDS User;
		-- DATA FIELDS
			DEFINE FIELD power ON TABLE SuperUser TYPE string;
			DEFINE FIELD name ON TABLE SuperUser TYPE option<string>;
			DEFINE FIELD email ON TABLE SuperUser TYPE option<string>;
		-- EDGES
			DEFINE FIELD accounts ON TABLE SuperUser VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.accounts || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE SuperUser TYPE option<array<record<⟨User-Accounts⟩>>>;
			DEFINE FIELD sessions ON TABLE SuperUser VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.sessions || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE SuperUser TYPE option<array<record<⟨User-Sessions⟩>>>;
			DEFINE FIELD spaces ON TABLE SuperUser VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.spaces || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE SuperUser TYPE option<array<record<⟨Space-User⟩>>>;
			DEFINE FIELD ⟨user-tags⟩ ON TABLE SuperUser TYPE option<array<record<UserTag>>>;
			
	DEFINE TABLE God SCHEMAFULL PERMISSIONS FULL; //EXTENDS SuperUser;
		-- DATA FIELDS
			DEFINE FIELD isEvil ON TABLE God TYPE bool;
			DEFINE FIELD power ON TABLE God TYPE string;
			DEFINE FIELD name ON TABLE God TYPE option<string>;
			DEFINE FIELD email ON TABLE God TYPE option<string>;
		-- EDGES
			DEFINE FIELD accounts ON TABLE God VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.accounts || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE God TYPE option<array<record<⟨User-Accounts⟩>>>;
			DEFINE FIELD sessions ON TABLE God VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.sessions || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE God TYPE option<array<record<⟨User-Sessions⟩>>>;
			DEFINE FIELD spaces ON TABLE God VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.spaces || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE God TYPE option<array<record<⟨Space-User⟩>>>;
			DEFINE FIELD ⟨user-tags⟩ ON TABLE God TYPE option<array<record<UserTag>>>;

	DEFINE TABLE Space SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Space TYPE option<string>;
		-- EDGES
			DEFINE FIELD users ON TABLE Space VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨space-user⟩.users || []) FROM ONLY $this)};
				DEFINE FIELD ⟨space-user⟩ ON TABLE Space TYPE option<array<record<⟨Space-User⟩>>>;
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
		-- EDGES
			DEFINE FIELD user ON TABLE Account VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-accounts⟩.user || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-accounts⟩ ON TABLE Account TYPE option<array<record<⟨User-Accounts⟩>>>;

	DEFINE TABLE Session SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD expires ON TABLE Session TYPE option<datetime>;
			DEFINE FIELD sessionToken ON TABLE Session TYPE option<string>;
		-- EDGES
			DEFINE FIELD user ON TABLE Session VALUE <future> {array::distinct(SELECT VALUE array::flatten(⟨user-sessions⟩.user || []) FROM ONLY $this)};
				DEFINE FIELD ⟨user-sessions⟩ ON TABLE Session TYPE option<array<record<⟨User-Sessions⟩>>>;

	DEFINE TABLE VerificationToken SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD identifier ON TABLE VerificationToken TYPE option<string>;
			DEFINE FIELD token ON TABLE VerificationToken TYPE option<string>;
			DEFINE FIELD expires ON TABLE VerificationToken TYPE option<datetime>;
		-- EDGES

	DEFINE TABLE Thing SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD stuff ON TABLE Thing TYPE option<string>;
		-- EDGES
			DEFINE FIELD things ON TABLE Thing TYPE option<array<record<ThingRelation>>>;
			DEFINE FIELD root ON TABLE Thing TYPE option<record<ThingRelation>>;
			DEFINE FIELD extra ON TABLE Thing TYPE option<record<ThingRelation>>;

	DEFINE TABLE SubthingOne SCHEMAFULL PERMISSIONS FULL; //EXTENDS Thing;
		-- DATA FIELDS
			DEFINE FIELD stuff ON TABLE SubthingOne TYPE option<string>;
		-- EDGES
			DEFINE FIELD things ON TABLE SubthingOne TYPE option<array<record<ThingRelation>>>;
			DEFINE FIELD root ON TABLE SubthingOne TYPE option<record<ThingRelation>>;
			DEFINE FIELD extra ON TABLE SubthingOne TYPE option<record<ThingRelation>>;

	DEFINE TABLE SubthingTwo SCHEMAFULL PERMISSIONS FULL; //EXTENDS Thing;
		-- DATA FIELDS
			DEFINE FIELD stuff ON TABLE SubthingTwo TYPE option<string>;
		-- EDGES
			DEFINE FIELD things ON TABLE SubthingTwo TYPE option<array<record<ThingRelation>>>;
			DEFINE FIELD root ON TABLE SubthingTwo TYPE option<record<ThingRelation>>;
			DEFINE FIELD extra ON TABLE SubthingTwo TYPE option<record<ThingRelation>>;
			
	DEFINE TABLE CascadeThing SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS

		-- EDGES
			DEFINE FIELD cascadeRelations ON TABLE CascadeThing TYPE option<array<record<CascadeRelation>>>;

	DEFINE TABLE Color SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD freeForAll ON TABLE Color FLEXIBLE TYPE option<bool|bytes|datetime|duration|geometry|number|object|string>;
			DEFINE FIELD value ON TABLE Color TYPE option<string>;

		-- EDGES
			DEFINE FIELD ⟨user-tags⟩ ON TABLE Color VALUE <future> {array::distinct(SELECT VALUE array::flatten(group.tags || []) FROM ONLY $this)};
			DEFINE FIELD group ON TABLE Color TYPE option<record<UserTagGroup>>;

	DEFINE TABLE Power SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD description ON TABLE Power TYPE option<string>;
		-- EDGES
			DEFINE FIELD ⟨space-user⟩ ON TABLE Power TYPE option<record<⟨Space-User⟩>>;
	
	DEFINE TABLE Hook SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD requiredOption ON TABLE Hook TYPE "a"|"b"|"c";
			DEFINE FIELD manyOptions ON TABLE Hook TYPE option<"a"|"b"|"c">;
			DEFINE FIELD fnValidatedField ON TABLE Hook TYPE option<string>;
			DEFINE FIELD timestamp ON TABLE Hook TYPE option<datetime>;

		-- EDGES
			DEFINE FIELD hookParent ON TABLE Hook TYPE option<record<HookParent>>;
			DEFINE FIELD asMainHookOf ON TABLE Hook TYPE option<record<HookParent>>;
			DEFINE FIELD otherTags ON TABLE Hook VALUE <future> {RETURN IF (requiredOption = "a") THEN ( RETURN SELECT VALUE id FROM Hook WHERE (requiredOption != "a")) ELSE RETURN [] END;};
			DEFINE FIELD tagA ON TABLE Hook VALUE <future> {RETURN IF (requiredOption != "a") THEN ( RETURN SELECT VALUE id FROM Hook WHERE (requiredOption = "a")) ELSE RETURN [] END;};

	DEFINE TABLE Company SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Company TYPE string;
			DEFINE FIELD industry ON TABLE Company TYPE option<"Tech"|"Finance"|"Healthcare"|"Retail"|"Manufacturing">;
		-- EDGES
			DEFINE FIELD employees ON TABLE Company TYPE option<array<record<Employee>>>;
		

-- RELATIONS
	DEFINE TABLE ⟨User-Accounts⟩ SCHEMAFULL PERMISSIONS FULL;
		/* DEFINE EVENT delete_orphan ON TABLE ⟨User-Accounts⟩ WHEN $before != $after THEN { //todo: Add when transactions are smarter
			IF 
		};*/
		DEFINE FIELD user ON TABLE ⟨User-Accounts⟩ TYPE option<record<User|God|SuperUser>>; //Todo: remove option when surrealDB transactions are smarter.
			DEFINE EVENT update_user ON TABLE ⟨User-Accounts⟩ WHEN $before.user != $after.user THEN {

						LET $edges = fn::get_mutated_edges($before.user, $after.user);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET ⟨user-accounts⟩ -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET ⟨user-accounts⟩ += [$after.id]; // Todo: the right management for card one and many
						};
			};
		DEFINE FIELD accounts ON TABLE ⟨User-Accounts⟩ TYPE option<array<record<Account>>>; //Todo: remove option when surrealDB transactions are smarter.
			DEFINE EVENT update_accounts ON TABLE ⟨User-Accounts⟩ WHEN $before.accounts != $after.accounts THEN {

						LET $edges = fn::get_mutated_edges($before.accounts, $after.accounts);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET ⟨user-accounts⟩ -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET ⟨user-accounts⟩ += [$after.id];
						};
			};
		
	DEFINE TABLE ⟨User-Sessions⟩ SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD user ON TABLE ⟨User-Sessions⟩ TYPE record<User|God|SuperUser>;
				DEFINE EVENT update_user ON TABLE ⟨User-Sessions⟩ WHEN $before.sessions != $after.sessions THEN {

						LET $edges = fn::get_mutated_edges($before.sessions, $after.sessions);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET ⟨user-sessions⟩ -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET ⟨user-sessions⟩ += [$after.id];
						};
				};

		DEFINE FIELD sessions ON TABLE ⟨User-Sessions⟩ TYPE array<record<Session>>;
			DEFINE EVENT update_sessions ON TABLE ⟨User-Sessions⟩ WHEN $before.sessions != $after.sessions THEN {

						LET $edges = fn::get_mutated_edges($before.sessions, $after.sessions);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET `user-session` -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET `user-session` += [$after.id];
						};
				};

	DEFINE TABLE ⟨Space-User⟩ SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD spaces ON TABLE ⟨Space-User⟩ TYPE option<array<record<Space>>>; //Todo: remove option when surrealDB transactions are smarter.
				DEFINE EVENT update_space ON TABLE ⟨Space-User⟩ WHEN $before.spaces != $after.spaces THEN {

						LET $edges = fn::get_mutated_edges($before.spaces, $after.spaces);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET ⟨space-user⟩ -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET ⟨space-user⟩ += [$after.id];
						};
				};
		DEFINE FIELD users ON TABLE ⟨Space-User⟩ TYPE option<array<record<User|God|SuperUser>>>; //Todo: remove option when surrealDB transactions are smarter.
				DEFINE EVENT update_user ON TABLE ⟨Space-User⟩ WHEN $before.users != $after.users THEN {
						

						LET $edges = fn::get_mutated_edges($before.users, $after.users);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET ⟨space-user⟩ -= [$before.id]; //use before for DELETE events
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET ⟨space-user⟩ += [$after.id];
						};
				};
		DEFINE FIELD power ON TABLE ⟨Space-User⟩ TYPE option<record<Power>>;

	DEFINE TABLE UserTag SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
		DEFINE FIELD users ON TABLE UserTag TYPE option<array<record<User|God|SuperUser>>>;
				DEFINE EVENT update_user ON TABLE UserTag WHEN $before.users != $after.users THEN {

					LET $edges = fn::get_mutated_edges($before.users, $after.users);

					FOR $unlink IN $edges.deletions {
							UPDATE $unlink SET `user-tags` -= [$before.id];
					};
					FOR $link IN $edges.additions {
							UPDATE $link SET `user-tags` += [$after.id];
					};
				};
		DEFINE FIELD group ON TABLE UserTag TYPE option<record<UserTagGroup>>;				
		DEFINE FIELD color ON TABLE UserTag VALUE <future> { RETURN SELECT VALUE group.color FROM ONLY $this}; 

	DEFINE TABLE UserTagGroup SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD tags ON TABLE UserTagGroup TYPE option<array<record<UserTag>>>;
				DEFINE EVENT update_userTag ON TABLE UserTagGroup WHEN $before.tags != $after.tags THEN {

					//Usertag us special because is card ONE, this means that when we link it we also need to clean the previous link

					LET $edges = fn::get_mutated_edges($before.tags, $after.tags);

					FOR $unlink IN $edges.deletions {
							UPDATE $unlink SET group = NONE; //this does not work it is being created in the same transaction
					};
					FOR $link IN $edges.additions {
							//Usertag us special because is card ONE, this means that when we link it we also need to clean the previous link
							IF ($link.group) THEN {UPDATE $link.group SET tags -= $link.id} END;
							UPDATE $link SET group = $after.id; //Card ONE
					};
				};
		DEFINE FIELD space ON TABLE UserTagGroup TYPE option<record<Space>>;
					DEFINE EVENT update_space ON TABLE UserTagGroup WHEN $before.space != $after.space THEN {

					LET $edges = fn::get_mutated_edges($before.space, $after.space);

					FOR $unlink IN $edges.deletions {
							UPDATE $unlink SET group = NONE;
					};
					FOR $link IN $edges.additions {
							UPDATE $link SET group = $after.id; //Card ONE
					};
				};
		DEFINE FIELD color ON TABLE UserTagGroup TYPE option<record<Color>>;
				DEFINE EVENT update_color ON TABLE UserTagGroup WHEN $before.color != $after.color THEN {

					LET $edges = fn::get_mutated_edges($before.color, $after.color);

					FOR $unlink IN $edges.deletions {
							UPDATE $unlink SET group = NONE;
					};
					FOR $link IN $edges.additions {
							UPDATE $link SET group = $after.id; //Card ONE
					};
				};
		
	DEFINE TABLE ThingRelation SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD root ON TABLE ThingRelation TYPE record<Thing>;
		DEFINE FIELD extra ON TABLE ThingRelation TYPE record<Thing>;
		DEFINE FIELD things ON TABLE ThingRelation TYPE array<record<Thing>>;

	DEFINE TABLE HookParent SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD mainHook ON TABLE HookParent TYPE record<Hook>;
		DEFINE FIELD hooks ON TABLE HookParent TYPE  array<record<Hook>>;

	DEFINE TABLE HookATag SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD hookTypeA ON TABLE HookATag TYPE record<Hook>;
		DEFINE FIELD otherHooks ON TABLE HookATag TYPE array<record<Hook>>;

	DEFINE TABLE SpaceObj SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD space ON TABLE SpaceObj TYPE record<Space>;
			DEFINE EVENT update_space ON TABLE SpaceObj WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET objects -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET objects += [$after.id];
						};
			};

	DEFINE TABLE SpaceDef SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD description ON SpaceDef TYPE string;
		DEFINE FIELD space ON TABLE SpaceDef TYPE record<Space>;
			DEFINE EVENT update_space ON TABLE SpaceDef WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET definitions -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET definitions += [$after.id];
						};
			};

	DEFINE TABLE Kind SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON Table Kind TYPE option<string>;
		
		DEFINE FIELD space ON TABLE Kind TYPE option<record<Space>>; //fix once surrealDB supports self-aware transactions
			DEFINE EVENT update_space ON TABLE Kind WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET kinds -= [$before.id], objects -= [$before.id], definitions -= [$before.id] ; //KIND extends SpaceDef which extends SpaceObj
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET kinds += [$after.id], objects += [$after.id], definitions += [$after.id] ; //KIND extends SpaceDef which extends SpaceObj
						};
			};
		DEFINE FIELD dataFields ON TABLE Kind TYPE option<array<record<DataField>>>;
		DEFINE FIELD fields ON TABLE Kind TYPE option<array<record<Field|DataField>>>;
		
	DEFINE TABLE Field SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON TABLE Field TYPE option<string>;
		DEFINE FIELD cardinality ON TABLE Field TYPE option<string>;
		DEFINE FIELD description ON TABLE Field TYPE option<string>;
		DEFINE FIELD space ON TABLE Field TYPE option<record<Space>>; //fix once surrealDB supports self-aware transactions
			DEFINE EVENT update_space ON TABLE Field WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET fields -= [$before.id], objects -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET fields += [$after.id], objects += [$after.id];
						};
			};
		DEFINE FIELD kinds ON TABLE Field TYPE option<array<record<Kind>>>;
			DEFINE EVENT update_kinds ON TABLE Field WHEN $before.kinds != $after.kinds THEN {

						LET $edges = fn::get_mutated_edges($before.kinds, $after.kinds);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET objects -= [$before.id], definitions -= [$before.id], fields -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET  objects += [$after.id], definitions += [$after.id], fields += [$after.id];
						};
			};
				-- there is no subtyping in SurrealDB, we need to duplicate the fields
			DEFINE TABLE DataField SCHEMAFULL PERMISSIONS FULL;
				DEFINE FIELD name ON TABLE DataField TYPE option<string>;
				DEFINE FIELD cardinality ON TABLE DataField TYPE option<string>;
				DEFINE FIELD type ON TABLE DataField TYPE option<string>;
				DEFINE FIELD computeType ON TABLE DataField TYPE option<string>;
				DEFINE FIELD description ON TABLE DataField TYPE option<string>;
				DEFINE FIELD space ON TABLE DataField TYPE option<record<Space>>; //fix once surrealDB supports self-aware transactions
					DEFINE EVENT update_space ON TABLE DataField WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET objects -= [$before.id], definitions -= [$before.id], fields -= [$before.id], dataFields -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET  objects += [$after.id], definitions += [$after.id], fields += [$after.id], dataFields += [$after.id];
						};
					};
				DEFINE FIELD kinds ON TABLE DataField TYPE option<array<record<Kind>>>;
					DEFINE EVENT update_kinds ON TABLE DataField WHEN $before.kinds != $after.kinds THEN {

						LET $edges = fn::get_mutated_edges($before.kinds, $after.kinds);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET dataFields -= [$before.id],  fields -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET dataFields += [$after.id], fields += [$after.id];
						};
				};
	DEFINE TABLE Self SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD space ON TABLE Self TYPE record<Space>;
			DEFINE EVENT update_space ON TABLE Self WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET selfs -= [$before.id], objects -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET selfs += [$after.id], objects += [$after.id];
						};
			};
		DEFINE FIELD owner ON TABLE Self TYPE option<record<Self>>;
			DEFINE EVENT update_owned ON TABLE Self WHEN $before.owner != $after.owner THEN {

						LET $edges = fn::get_mutated_edges($before.owner, $after.owner);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET owned -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET owned += [$after.id];
						};
			};
		DEFINE FIELD owned ON TABLE Self TYPE option<array<record<Self>>>;
	
	DEFINE TABLE Employee SCHEMAFULL PERMISSIONS FULL;
		-- DATA FIELDS
			DEFINE FIELD name ON TABLE Employee TYPE string;
		-- EDGES
			DEFINE FIELD company ON TABLE Employee TYPE record<Company>;
						DEFINE EVENT update_company ON TABLE Employee WHEN $before.company != $after.company THEN {

						LET $edges = fn::get_mutated_edges($before.company, $after.company);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET employees -= [$before.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET employees += [$after.id];
						};
			};



-- BORM TOOLS
	DEFINE FUNCTION fn::get_mutated_edges(
			$before_relation: option<array|record>,
			$after_relation: option<array|record>,
	) {
			LET $notEmptyCurrent = $before_relation || [];
			LET $current = array::flatten([$notEmptyCurrent]);
			LET $notEmptyResult = $after_relation || [];
			LET $result = array::flatten([$notEmptyResult]);
			LET $links = array::complement($result, $current);
			LET $unlinks = array::complement($current, $result);
			
			RETURN {
					additions: $links,
					deletions: $unlinks
			};
	};

	DEFINE FUNCTION fn::as_array(
			$var: option<array<record>|record>,
	) {           
				RETURN (type::is::array($var) AND $var) OR [$var]
		
	};

COMMIT TRANSACTION;