
USE NS borm_bench;
USE DB borm_bench;

BEGIN TRANSACTION;

DEFINE TABLE IF NOT EXISTS parent SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE name ON TABLE parent TYPE option<string>;
DEFINE FIELD OVERWRITE children ON TABLE parent TYPE option<array<record<child>>>;

DEFINE TABLE IF NOT EXISTS child SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE name ON TABLE child TYPE option<string>;
DEFINE FIELD OVERWRITE parent ON TABLE child TYPE option<record<parent>>;
DEFINE EVENT OVERWRITE update_parent ON TABLE child WHEN $before.parent != $after.parent THEN {
  IF ($before.parent) THEN {UPDATE $before.parent SET children -= $before.id} END;
  IF ($after.parent) THEN {UPDATE $after.parent SET children += $after.id} END;
};

DEFINE TABLE IF NOT EXISTS parent_child SCHEMAFULL TYPE RELATION IN parent OUT child PERMISSIONS FULL;

COMMIT TRANSACTION;