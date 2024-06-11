USE NS multi_db_test;
USE DB test;

BEGIN TRANSACTION;

INSERT INTO company [
  {id: "company1", name: "Google"},
  {id: "company2", name: "Apple"},
  {id: "company3", name: "Microsoft"},
	{id: "company4", name: "Facebook"},
];

INSERT INTO person [
  {id: "person1", name: "Antoine", email: "antoine@google.com"},
  {id: "person2", name: "Loic", email: "loic@google.com"},
  {id: "person3", name: "Ann", email: "ann@google.com"},
  {id: "person4", name: "Ben", email: "ben@google.com"},
  {id: "person5", name: "Charlize", email: "charlize@apple.com"},
  {id: "person6", name: "Susi", email: "susi@apple.com"},
  {id: "person7", name: "Budi", email: "budi@apple.com"},
  {id: "person8", name: "Intan", email: "intan@apple.com"},
  {id: "person9", name: "Satya", email: "satya@microsoft.com"},
];

INSERT INTO task [
  {id: "task1", name: "Build search engine"},
  {id: "task2", name: "Build Google Sheet"},
];

RELATE company:company1 -> company_employees -> person:person1;
RELATE company:company1 -> company_employees -> person:person2;
RELATE company:company1 -> company_employees -> person:person3;
RELATE company:company1 -> company_employees -> person:person4;
RELATE company:company2 -> company_employees -> person:person5;
RELATE company:company2 -> company_employees -> person:person6;
RELATE company:company2 -> company_employees -> person:person7;
RELATE company:company2 -> company_employees -> person:person8;
RELATE company:company3 -> company_employees -> person:person9;
RELATE company:company3 -> company_employees -> person:person10;

RELATE person:person1 -> person_tasks -> task:task1;
RELATE person:person2 -> person_tasks -> task:task2;

COMMIT TRANSACTION;
