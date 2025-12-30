USE NS borm_bench;
USE DB borm_bench;

BEGIN TRANSACTION;

DEFINE TABLE IF NOT EXISTS t_a SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE string_1 ON TABLE t_a TYPE option<string>;
DEFINE FIELD OVERWRITE number_1 ON TABLE t_a TYPE option<number>;
DEFINE FIELD OVERWRITE boolean_1 ON TABLE t_a TYPE option<bool>;
DEFINE FIELD OVERWRITE datetime_1 ON TABLE t_a TYPE option<datetime>;
DEFINE FIELD OVERWRITE ref_one ON TABLE t_a TYPE option<record<t_b>>;
DEFINE FIELD OVERWRITE ref_few ON TABLE t_a TYPE option<array<record<t_b>>>;
DEFINE FIELD OVERWRITE ref_many ON TABLE t_a TYPE option<array<record<t_b>>>;
DEFINE FIELD OVERWRITE fut_one ON TABLE t_a VALUE <future> { RETURN array::first(SELECT VALUE b FROM $parent.tunnel_one) || [] };
-- DEFINE FIELD OVERWRITE fut_one ON TABLE t_a VALUE <future> { RETURN SELECT VALUE b FROM $this.tunnel_one };
DEFINE FIELD OVERWRITE fut_few ON TABLE t_a VALUE <future> { RETURN SELECT VALUE b FROM $this.tunnel_few };
DEFINE FIELD OVERWRITE fut_many ON TABLE t_a VALUE <future> { RETURN SELECT VALUE b FROM $this.tunnel_many };
DEFINE FIELD OVERWRITE tunnel_one ON TABLE t_a TYPE option<record<tunnel_one>>;
DEFINE FIELD OVERWRITE tunnel_few ON TABLE t_a TYPE option<array<record<tunnel_few>>>;
DEFINE FIELD OVERWRITE tunnel_many ON TABLE t_a TYPE option<array<record<tunnel_many>>>;
DEFINE INDEX IF NOT EXISTS idx_a_string_1 ON TABLE t_a COLUMNS string_1;
DEFINE INDEX IF NOT EXISTS idx_a_ref_one ON TABLE t_a COLUMNS ref_one;
DEFINE INDEX IF NOT EXISTS idx_a_ref_few ON TABLE t_a COLUMNS ref_few;
DEFINE INDEX IF NOT EXISTS idx_a_ref_many ON TABLE t_a COLUMNS ref_many;
DEFINE INDEX IF NOT EXISTS idx_a_tunnel_one ON TABLE t_a COLUMNS tunnel_one;
DEFINE INDEX IF NOT EXISTS idx_a_tunnel_few ON TABLE t_a COLUMNS tunnel_few;
DEFINE INDEX IF NOT EXISTS idx_a_tunnel_many ON TABLE t_a COLUMNS tunnel_many;

DEFINE TABLE IF NOT EXISTS t_b SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE string_1 ON TABLE t_b TYPE option<string>;
DEFINE FIELD OVERWRITE number_1 ON TABLE t_b TYPE option<number>;
DEFINE FIELD OVERWRITE boolean_1 ON TABLE t_b TYPE option<bool>;
DEFINE FIELD OVERWRITE datetime_1 ON TABLE t_b TYPE option<datetime>;
DEFINE FIELD OVERWRITE ref_one ON TABLE t_b TYPE option<record<t_a>>;
DEFINE FIELD OVERWRITE ref_few ON TABLE t_b TYPE option<array<record<t_a>>>;
DEFINE FIELD OVERWRITE ref_many ON TABLE t_b TYPE option<array<record<t_a>>>;
DEFINE FIELD OVERWRITE fut_one ON TABLE t_b VALUE <future> { RETURN array::first(SELECT VALUE a FROM $parent.tunnel_one) || [] };
-- DEFINE FIELD OVERWRITE fut_one ON TABLE t_b VALUE <future> { RETURN SELECT VALUE a FROM $this.tunnel_one };
DEFINE FIELD OVERWRITE fut_few ON TABLE t_b VALUE <future> { RETURN SELECT VALUE a FROM $this.tunnel_few };
DEFINE FIELD OVERWRITE fut_many ON TABLE t_b VALUE <future> { RETURN SELECT VALUE a FROM $this.tunnel_many };
DEFINE FIELD OVERWRITE tunnel_one ON TABLE t_b TYPE option<record<tunnel_one>>;
DEFINE FIELD OVERWRITE tunnel_few ON TABLE t_b TYPE option<array<record<tunnel_few>>>;
DEFINE FIELD OVERWRITE tunnel_many ON TABLE t_b TYPE option<array<record<tunnel_many>>>;
DEFINE INDEX IF NOT EXISTS idx_b_string_1 ON TABLE t_b COLUMNS string_1;
DEFINE INDEX IF NOT EXISTS idx_b_ref_one ON TABLE t_b COLUMNS ref_one;
DEFINE INDEX IF NOT EXISTS idx_b_ref_few ON TABLE t_b COLUMNS ref_few;
DEFINE INDEX IF NOT EXISTS idx_b_ref_many ON TABLE t_b COLUMNS ref_many;
DEFINE INDEX IF NOT EXISTS idx_b_tunnel_one ON TABLE t_b COLUMNS tunnel_one;
DEFINE INDEX IF NOT EXISTS idx_b_tunnel_few ON TABLE t_b COLUMNS tunnel_few;
DEFINE INDEX IF NOT EXISTS idx_b_tunnel_many ON TABLE t_b COLUMNS tunnel_many;

DEFINE TABLE IF NOT EXISTS tunnel_one SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE a ON TABLE tunnel_one TYPE option<record<t_a>>;
DEFINE FIELD OVERWRITE b ON TABLE tunnel_one TYPE option<record<t_b>>;
DEFINE INDEX IF NOT EXISTS unique_tunnel_one_a ON TABLE tunnel_one COLUMNS a UNIQUE;
DEFINE INDEX IF NOT EXISTS unique_tunnel_one_b ON TABLE tunnel_one COLUMNS b UNIQUE;

DEFINE TABLE IF NOT EXISTS tunnel_few SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE a ON TABLE tunnel_few TYPE option<record<t_a>>;
DEFINE FIELD OVERWRITE b ON TABLE tunnel_few TYPE option<record<t_b>>;
DEFINE INDEX IF NOT EXISTS unique_tunnel_few_a_b ON TABLE tunnel_few COLUMNS a, b UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_tunnel_few_b ON TABLE tunnel_few COLUMNS b;

DEFINE TABLE IF NOT EXISTS tunnel_many SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD OVERWRITE a ON TABLE tunnel_many TYPE option<record<t_a>>;
DEFINE FIELD OVERWRITE b ON TABLE tunnel_many TYPE option<record<t_b>>;
DEFINE INDEX IF NOT EXISTS unique_tunnel_many_a_b ON TABLE tunnel_many COLUMNS a, b UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_tunnel_many_b ON TABLE tunnel_many COLUMNS b;

-- These tables are not needed for the benchmark, but they are here for reference

DEFINE TABLE IF NOT EXISTS edge_one SCHEMAFULL TYPE RELATION IN t_a OUT t_b PERMISSIONS FULL;
DEFINE INDEX IF NOT EXISTS unique_edge_one_in ON TABLE edge_one COLUMNS in UNIQUE;
DEFINE INDEX IF NOT EXISTS unique_edge_one_out ON TABLE edge_one COLUMNS out UNIQUE;

DEFINE TABLE IF NOT EXISTS edge_few SCHEMAFULL TYPE RELATION IN t_a OUT t_b PERMISSIONS FULL;
DEFINE INDEX IF NOT EXISTS unique_edge_few_in_out ON TABLE edge_few COLUMNS in, out UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_edge_few_out ON TABLE edge_few COLUMNS out;

DEFINE TABLE IF NOT EXISTS edge_many SCHEMAFULL TYPE RELATION IN t_a OUT t_b PERMISSIONS FULL;
DEFINE INDEX IF NOT EXISTS unique_edge_many_in_out ON TABLE edge_many COLUMNS in, out UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_edge_many_out ON TABLE edge_many COLUMNS out;

DEFINE FUNCTION fn::as_array($var: option<array<record>|record>) {
	RETURN (type::is::array($var) AND $var) OR [$var]
};

COMMIT TRANSACTION;
