USE NS test;
USE DB test;

BEGIN TRANSACTION;
-- ENITIES 
	DEFINE TABLE User SCHEMAFULL PERMISSIONS FULL ;
		--ATTRIBUTES
		DEFINE FIELD name ON TABLE User TYPE option<string>;
		DEFINE FIELD email ON TABLE User TYPE option<string>;

		--EDGES
		DEFINE FIELD accounts ON TABLE User VALUE <future> { array::flatten(SELECT VALUE array::flatten(`user-accounts`.accounts || []) FROM $this)}; //todo: intermediary events when $input works on events
		DEFINE FIELD sessions ON TABLE User VALUE <future> { array::flatten(SELECT VALUE array::flatten(`user-sessions`.sessions || []) FROM $this)};
		DEFINE FIELD spaces ON TABLE User VALUE <future> { array::flatten(SELECT VALUE array::flatten(`space-user`.spaces || []) FROM $this)};
		DEFINE FIELD ⟨user-tags⟩ ON TABLE User TYPE option<array<record<UserTag>>>;
		DEFINE FIELD ⟨add_user-tags⟩ ON TABLE User TYPE option<array<record<UserTag>>>;
			DEFINE EVENT ⟨add_user-tags⟩ ON TABLE User WHEN $after.⟨add_user-tags⟩ && $before.⟨add_user-tags⟩ == NONE THEN {
				FOR $each in $after. ⟨add_user-tags⟩ {
					UPDATE $each SET users += [$after.id];
				};
				 UPDATE $this SET  ⟨add_user-tags⟩ = NONE;
			};
		DEFINE FIELD ⟨remove_user-tags⟩ ON TABLE User TYPE option<array<record<UserTag>>>;
			DEFINE EVENT ⟨remove_user-tags⟩ ON TABLE User WHEN $after.⟨remove_user-tags⟩ && $before.⟨remove_user-tags⟩ == NONE THEN {
				FOR $each in $after. ⟨remove_user-tags⟩ {
					UPDATE $each SET users -= [$after.id];
				};
				 UPDATE $this SET  ⟨remove_user-tags⟩ = NONE;
			};

		--SUPPORT FOR target:role	
		DEFINE FIELD `user-accounts` ON TABLE User TYPE option<array<record<⟨User-Accounts⟩>>>;
		DEFINE FIELD `user-sessions` ON TABLE User TYPE option<array<record<⟨User-Sessions⟩>>>;
		DEFINE FIELD `space-user` ON TABLE User TYPE option<array<record<⟨Space-User⟩>>>;

		-- there is no subtyping in SurrealDB, we need to duplicate the fields
				DEFINE TABLE SuperUser SCHEMAFULL PERMISSIONS FULL;
					--ATTRIBUTES
					DEFINE FIELD name ON TABLE SuperUser TYPE option<string>;
					DEFINE FIELD email ON TABLE SuperUser TYPE option<string>;
					DEFINE FIELD power ON TABLE SuperUser TYPE string;

					--EDGES
					DEFINE FIELD accounts ON TABLE SuperUser VALUE <future> { array::flatten(SELECT VALUE array::flatten(`user-accounts`.accounts || []) FROM $this)}; 
					DEFINE FIELD sessions ON TABLE SuperUser VALUE <future> { array::flatten(SELECT VALUE array::flatten(`user-sessions`.sessions || []) FROM $this)};
					DEFINE FIELD spaces ON TABLE SuperUser VALUE <future> { array::flatten(SELECT VALUE array::flatten(`space-user`.spaces || []) FROM $this)};
					DEFINE FIELD `user-tags` ON TABLE SuperUser TYPE option<array<record<UserTag>>>;

					--SUPPORT FOR target:role	
					DEFINE FIELD `user-accounts` ON TABLE SuperUser TYPE option<array<record<⟨User-Accounts⟩>>>;
					DEFINE FIELD `user-sessions` ON TABLE SuperUser TYPE option<array<record<⟨User-Sessions⟩>>>;
					DEFINE FIELD `space-user` ON TABLE SuperUser TYPE option<array<record<⟨Space-User⟩>>>;

					-- there is no subtyping in SurrealDB, we need to duplicate the fields
							DEFINE TABLE God SCHEMAFULL PERMISSIONS FULL;
								--ATTRIBUTES
								DEFINE FIELD name ON TABLE God TYPE option<string>;
								DEFINE FIELD email ON TABLE God TYPE option<string>;
								DEFINE FIELD power ON TABLE God TYPE string;
								DEFINE FIELD isEvil ON TABLE God TYPE bool;
									--EDGES
								DEFINE FIELD accounts ON TABLE God VALUE <future> { array::flatten(SELECT VALUE array::flatten(`user-accounts`.accounts || []) FROM $this)}; 
								DEFINE FIELD sessions ON TABLE God VALUE <future> { array::flatten(SELECT VALUE array::flatten(`user-sessions`.sessions || []) FROM $this)};
								DEFINE FIELD spaces ON TABLE God VALUE <future> { array::flatten(SELECT VALUE array::flatten(`space-user`.spaces || []) FROM $this)};
								DEFINE FIELD `user-tags` ON TABLE God TYPE option<array<record<UserTag>>>;

								--SUPPORT FOR target:role	
								DEFINE FIELD `user-accounts` ON TABLE God TYPE option<array<record<⟨User-Accounts⟩>>>;
								DEFINE FIELD `user-sessions` ON TABLE God TYPE option<array<record<⟨User-Sessions⟩>>>;
								DEFINE FIELD `space-user` ON TABLE God TYPE option<array<record<⟨Space-User⟩>>>;

	DEFINE TABLE Space SCHEMAFULL PERMISSIONS FULL;
		--ATTRIBUTES
		DEFINE FIELD name ON TABLE Space TYPE string;

		--EDGES
		DEFINE FIELD users ON TABLE Space VALUE <future> { array::flatten(SELECT VALUE array::flatten(`space-user`.users || []) FROM $this)};
		DEFINE FIELD objects ON TABLE Space TYPE option<array<record<SpaceObj|Self|SpaceDef|Kind|Field|DataField>>>;
		DEFINE FIELD definitions ON TABLE Space TYPE option<array<record<SpaceDef|Kind|Field|DataField>>>;
		DEFINE FIELD kinds ON TABLE Space TYPE option<array<record<Kind>>>;
		DEFINE FIELD fields ON TABLE Space TYPE option<array<record<Field|DataField>>>; 
		DEFINE FIELD dataFields ON TABLE Space TYPE option<array<record<DataField>>>;
		DEFINE FIELD selfs ON TABLE Space TYPE option<array<record<Self>>>;

			--SUPPORT FOR target:role	
		DEFINE FIELD `space-user` ON TABLE Space TYPE option<array<record<⟨Space-User⟩>>>;

	DEFINE TABLE Thing SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD stuff ON TABLE Thing TYPE string;

			DEFINE TABLE SubthingOne SCHEMAFULL PERMISSIONS FULL;
				DEFINE FIELD stuff ON TABLE SubthingOne TYPE string;

				DEFINE TABLE SubthingTwo SCHEMAFULL PERMISSIONS FULL;
					DEFINE FIELD stuff ON TABLE SubthingTwo TYPE string;

	DEFINE TABLE Account SCHEMAFULL PERMISSIONS FULL;
		--ATTRIBUTES
		DEFINE FIELD provider ON TABLE Account TYPE option<string>;
		DEFINE FIELD isSecureProvider ON TABLE Account VALUE {$this.provider = "google"} TYPE option<bool>; --<future> not needed when there are parameters
		DEFINE FIELD profile ON TABLE Account FLEXIBLE TYPE option<object>;

		--EDGES
		DEFINE FIELD user ON TABLE Account VALUE <future> { RETURN SELECT VALUE `user-accounts`.user FROM ONLY $this }; 

		--- SUPPORT
		DEFINE FIELD `user-accounts` ON TABLE Account TYPE option<array<record<⟨User-Accounts⟩>>>;


	DEFINE TABLE Post SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD mentions ON TABLE Post TYPE array<string>;

	DEFINE TABLE Color SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON TABLE Color TYPE option<string>;
		DEFINE FIELD freeForAll ON TABLE Color FLEXIBLE TYPE option<string|number|datetime|bool>;

		DEFINE FIELD `user-tags` ON TABLE Color VALUE <future> { RETURN SELECT VALUE group.tags FROM ONLY $this };
		DEFINE FIELD group ON TABLE Color TYPE option<record<UserTagGroup>>;

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

-- RELATIONS
	DEFINE TABLE ⟨User-Accounts⟩ SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD user ON TABLE ⟨User-Accounts⟩ TYPE record<User|God|SuperUser>;
			DEFINE EVENT update_user ON TABLE ⟨User-Accounts⟩ WHEN $before.user != $after.user THEN {

						LET $edges = fn::get_mutated_edges($before.user, $after.user);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET `user-accounts` -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET `user-accounts` += [$after.id]; // Todo: the right management for card one and many
						};
			};
		DEFINE FIELD accounts ON TABLE ⟨User-Accounts⟩ TYPE array<record<Account>>;
			DEFINE EVENT update_accounts ON TABLE ⟨User-Accounts⟩ WHEN $before.accounts != $after.accounts THEN {

						LET $edges = fn::get_mutated_edges($before.accounts, $after.accounts);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET `user-accounts` -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET `user-accounts` += [$after.id];
						};
			};
		
	DEFINE TABLE ⟨User-Sessions⟩ SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD user ON TABLE ⟨User-Sessions⟩ TYPE record<User|God|SuperUser>;
		DEFINE FIELD sessions ON TABLE ⟨User-Sessions⟩ TYPE array<record<Session>>;

	DEFINE TABLE ⟨Space-User⟩ SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD spaces ON TABLE ⟨Space-User⟩ TYPE array<record<Space>>;
				DEFINE EVENT update_space ON TABLE ⟨Space-User⟩ WHEN $before.spaces != $after.spaces THEN {

						LET $edges = fn::get_mutated_edges($before.spaces, $after.spaces);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET `space-user` -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET `space-user` += [$after.id];
						};
				};
		DEFINE FIELD users ON TABLE ⟨Space-User⟩ TYPE array<record<User|God|SuperUser>>;
				DEFINE EVENT update_user ON TABLE ⟨Space-User⟩ WHEN $before.users != $after.users THEN {

						LET $edges = fn::get_mutated_edges($before.users, $after.users);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET `space-user` -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET `space-user` += [$after.id];
						};
				};
		DEFINE FIELD power ON TABLE ⟨Space-User⟩ TYPE option<record<Power>>;

	DEFINE TABLE UserTag SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON TABLE UserTag TYPE option<string>;
		DEFINE FIELD users ON TABLE UserTag TYPE option<array<record<User|God|SuperUser>>>;
				DEFINE EVENT update_user ON TABLE UserTag WHEN $before.users != $after.users THEN {

					LET $edges = fn::get_mutated_edges($before.users, $after.users);

					FOR $unlink IN $edges.deletions {
							UPDATE $unlink SET `user-tags` -= $after.id;
					};
					FOR $link IN $edges.additions {
							UPDATE $link SET `user-tags` += $after.id;
					};
				};
		DEFINE FIELD group ON TABLE UserTag TYPE option<record<UserTagGroup>>;
		DEFINE FIELD color ON TABLE UserTag VALUE <future> { RETURN SELECT VALUE group.color FROM ONLY $this}; 

	DEFINE TABLE UserTagGroup SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD tags ON TABLE UserTagGroup TYPE array<record<UserTag>>;
				DEFINE EVENT update_userTag ON TABLE UserTagGroup WHEN $before.tags != $after.tags THEN {

					LET $edges = fn::get_mutated_edges($before.tags, $after.tags);

					FOR $unlink IN $edges.deletions {
							UPDATE $unlink SET group = NONE;
					};
					FOR $link IN $edges.additions {
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
								UPDATE $unlink SET objects -= [$after.id];
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
								UPDATE $unlink SET definitions -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET definitions += [$after.id];
						};
			};

	DEFINE TABLE Kind SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON Table Kind TYPE string;
		
		DEFINE FIELD space ON TABLE Kind TYPE record<Space>;
			DEFINE EVENT update_space ON TABLE Kind WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET kinds -= [$after.id], objects -= [$after.id], definitions -= [$after.id] ; //KIND extends SpaceDef which extends SpaceObj
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET kinds += [$after.id], objects += [$after.id], definitions += [$after.id] ; //KIND extends SpaceDef which extends SpaceObj
						};
			};


	DEFINE TABLE Self SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD space ON TABLE Self TYPE record<Space>;
			DEFINE EVENT update_space ON TABLE Self WHEN $before.space != $after.space THEN {

						LET $edges = fn::get_mutated_edges($before.space, $after.space);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET selfs -= [$after.id], objects -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET selfs += [$after.id], objects += [$after.id];
						};
			};
		DEFINE FIELD owner ON TABLE Self TYPE option<record<Self>>;
			DEFINE EVENT update_owned ON TABLE Self WHEN $before.owner != $after.owner THEN {

						LET $edges = fn::get_mutated_edges($before.owner, $after.owner);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET owned -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET owned += [$after.id];
						};
			};
		DEFINE FIELD owned ON TABLE Self TYPE option<array<record<Self>>>;


	DEFINE TABLE Employee SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON TABLE Employee TYPE string;
		DEFINE FIELD company ON TABLE Employee TYPE record<Company>;
						DEFINE EVENT update_company ON TABLE Employee WHEN $before.company != $after.company THEN {

						LET $edges = fn::get_mutated_edges($before.company, $after.company);

						FOR $unlink IN $edges.deletions {
								UPDATE $unlink SET employees -= [$after.id];
						};
						FOR $link IN $edges.additions {
								UPDATE $link SET employees += [$after.id];
						};
			};

	DEFINE TABLE Company SCHEMAFULL PERMISSIONS FULL;
		DEFINE FIELD name ON TABLE Company TYPE string;
		DEFINE FIELD industry ON TABLE Company TYPE string;
		DEFINE FIELD employees ON TABLE Company TYPE option<array<record<Employee>>>;


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

COMMIT TRANSACTION;