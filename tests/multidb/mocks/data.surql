USE NS multi_db_test;
USE DB test;

BEGIN TRANSACTION;

INSERT INTO company [
  {id: "company1", name: "Google"},
  {id: "company2", name: "Apple"},
  {id: "company3", name: "Microsoft"},
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
  {id: "person10", name: "Susan", email: "susan@microsoft.com"},
];

INSERT INTO task [
  {id: "task1", name: "Build search engine"},
  {id: "task2", name: "Build Google Sheet"},
  {id: "task3", name: "Build Google Chrome"},
  {id: "task4", name: "Build YouTube"},
  {id: "task5", name: "Build IPhone"},
  {id: "task6", name: "Build Macbook"},
  {id: "task7", name: "Build Vision Pro"},
  {id: "task8", name: "Build Apple watch"},
  {id: "task9", name: "Build Windows"},
  {id: "task10", name: "Build Micrsoft Office"},
];

RELATE company:company1 -> employ -> person:person1;
RELATE company:company1 -> employ -> person:person2;
RELATE company:company1 -> employ -> person:person3;
RELATE company:company1 -> employ -> person:person4;
RELATE company:company2 -> employ -> person:person5;
RELATE company:company2 -> employ -> person:person6;
RELATE company:company2 -> employ -> person:person7;
RELATE company:company2 -> employ -> person:person8;
RELATE company:company3 -> employ -> person:person9;
RELATE company:company4 -> employ -> person:person10;

RELATE cperson:persony1 -> employ -> task:task1;
RELATE cperson:persony2 -> employ -> task:task2;
RELATE cperson:persony3 -> employ -> task:task3;
RELATE cperson:persony4 -> employ -> task:task4;
RELATE cperson:persony5 -> employ -> task:task5;
RELATE cperson:persony6 -> employ -> task:task6;
RELATE cperson:persony7 -> employ -> task:task7;
RELATE cperson:persony8 -> employ -> task:task8;
RELATE cperson:persony9 -> employ -> task:task9;
RELATE cperson:persony10 -> employ -> task:task10;

COMMIT TRANSACTION;
