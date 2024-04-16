USE NS multi_db_test;
USE DB test;

DEFINE TABLE company SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE company TYPE string;

DEFINE TABLE person SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE person TYPE string;
DEFINE FIELD email ON TABLE person TYPE string;

DEFINE TABLE task SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD name ON TABLE task TYPE string;

DEFINE TABLE company_employee SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON company_employee TYPE record<company> ASSERT $value != NONE;
DEFINE FIELD out ON company_employee TYPE record<person> ASSERT $value != NONE;

DEFINE TABLE person_task SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD in ON person_task TYPE record<person> ASSERT $value != NONE;
DEFINE FIELD out ON person_task TYPE record<task> ASSERT $value != NONE;
