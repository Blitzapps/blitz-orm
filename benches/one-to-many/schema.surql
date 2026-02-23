
USE NS borm_bench;
USE DB borm_bench;

BEGIN TRANSACTION;

DEFINE TABLE IF NOT EXISTS parent SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE name ON TABLE parent TYPE option<string>;
-- DEFINE FIELD OVERWRITE children ON TABLE parent TYPE option<array<record<child>>>;
DEFINE FIELD OVERWRITE foster_children ON TABLE parent VALUE <future> {
  RETURN array::distinct(array::flatten((SELECT VALUE ->foster_parent_child->child FROM ONLY $this) || []));
};

DEFINE TABLE IF NOT EXISTS child SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE name ON TABLE child TYPE option<string>;
-- DEFINE FIELD OVERWRITE parent ON TABLE child TYPE option<record<parent>>;
DEFINE FIELD OVERWRITE foster_parent ON TABLE child TYPE option<record<parent>>;
-- DEFINE EVENT OVERWRITE update_parent ON TABLE child WHEN $before.parent != $after.parent THEN {
--   IF ($before.parent) THEN {UPDATE $before.parent SET children -= $before.id} END;
--   IF ($after.parent) THEN {UPDATE $after.parent SET children += $after.id} END;
-- };
-- DEFINE EVENT OVERWRITE sync_foster_parent_child ON TABLE child WHEN true THEN {
--   IF (!$after) THEN {
--     DELETE foster_parent_child WHERE out = $before.id;
--     RETURN NONE;
--   } END;

--   IF ($before.foster_parent AND $before.foster_parent != $after.foster_parent) THEN {
--     DELETE foster_parent_child WHERE in = $before.foster_parent AND out = $before.id;
--   } END;

--   IF ($after.foster_parent AND $before.foster_parent != $after.foster_parent) THEN {
--     RELATE ($after.foster_parent)->foster_parent_child->($after.id);
--   } END;
-- };

DEFINE TABLE IF NOT EXISTS parent_child SCHEMAFULL TYPE RELATION IN parent OUT child PERMISSIONS FULL;

DEFINE TABLE IF NOT EXISTS foster_parent_child SCHEMAFULL TYPE RELATION IN parent OUT child PERMISSIONS FULL;

COMMIT TRANSACTION;