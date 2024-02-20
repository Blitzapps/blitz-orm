USE NS test;
USE DB test;

BEGIN TRANSACTION;

INSERT INTO User [
  {id: "user1", name: "Antoine", email: "antoine@test.com"},
  {id: "user2", name: "Loic", email: "loic@test.com"},
  {id: "user3", name: "Ann", email: "ann@test.com"},
  {id: "user4", name: "Ben"},
  {id: "user5", name: "Charlize", email: "charlize@test.com"},
];

INSERT INTO SuperUser [
  {id: "superuser1", name: "Beatrix Kiddo", email: "black.mamba@deadly-viper.com", power: "katana"}
];

INSERT INTO God [
  {id: "god1", name: "Richard David James", email: "afx@rephlex.com", power: "mind control", isEvil: true}
];

INSERT INTO Space [
  { id: "space-1", name: "Production" },
  { id: "space-2", name: "Dev" },
  { id: "space-3", name: "Not-owned" }
];

INSERT INTO Thing [
  {id: "thing1", stuff: "A"},
  {id: "thing2", stuff: "B"},
  {id: "thing3", stuff: "C"},
  {id: "thing4", stuff: "D"},
  {id: "thing5", stuff: "E"}
];

INSERT INTO SubthingOne [
  {id: "subthingone1", stuff: "F"},
  {id: "subthingone2", stuff: "G"},
  {id: "subthingone3", stuff: "H"}
];

INSERT INTO SubthingTwo [
  {id: "subthingtwo1", stuff: "I"},
  {id: "subthingtwo2", stuff: "J"},
  {id: "subthingtwo3", stuff: "K"}
];

INSERT INTO Account [
  { id: "account1-1", "provider": "google" },
  { id: "account1-2", "provider": "facebook" },
  { id: "account1-3", "provider": "github" },
  { id: "account2-1", "provider": "google" },
  { id: "account3-1", "provider": "facebook" }
];

INSERT INTO Post [
  { id: "post1", "mentions": [ "@Antoine" ]},
  { id: "post2", "mentions": [ "@Antoine", "@Loic" ]},
  { id: "post3", "mentions": [ "@Loic" ] },
  { id: "post4", "mentions": [ "@Ann" ] }
];

INSERT INTO Color [
  { id: "yellow" },
  { id: "blue" }
];

INSERT INTO Power [
  { id: "power1", description: "useless power" }
];

INSERT INTO Hook [
  { "id": "hook1", "requiredOption": "a" },
  { "id": "hook2", "requiredOption": "b" },
  { "id": "hook3", "requiredOption": "c" },
  { "id": "hook4", "requiredOption": "a" },
  { "id": "hook5", "requiredOption": "b" }
];

COMMIT TRANSACTION;