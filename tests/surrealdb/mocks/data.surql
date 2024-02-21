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

INSERT INTO ThingRelation [
  { id: "tr2", things: [ Thing:thing5 ], root: Thing:thing2, extra: Thing:thing1 },
  { id: "tr3", things: [ Thing:thing4, Thing:thing5 ], root: Thing:thing1, extra: Thing:thing1 },
  { id: "tr4", things: [ Thing:thing5 ], root: Thing:thing1, extra: Thing:thing1 },
  { id: "tr5", things: [ Thing:thing5 ], root: Thing:thing1, extra: Thing:thing1 },
  { id: "tr6", things: [ Thing:thing5 ], root: Thing:thing2, extra: Thing:thing1 },
  { id: "tr7", things: [ Thing:thing5 ], root: Thing:thing3, extra: Thing:thing1 },
  { id: "tr8", things: [ Thing:thing5 ], root: Thing:thing4, extra: Thing:thing1 },
  { id: "tr9", things: [ Thing:thing5 ], root: Thing:thing4, extra: Thing:thing1 },
  { id: "tr10", things: [], extra: Thing:thing1 },
  { id: "tr11", things: [], root: Thing:thing4, extra: Thing:thing5 }
];

INSERT INTO SuperUser [
  {id: "superuser1", name: "Beatrix Kiddo", email: "black.mamba@deadly-viper.com", power: "katana"}
];

INSERT INTO God [
  {id: "god1", name: "Richard David James", email: "afx@rephlex.com", power: "mind control", isEvil: true}
];

INSERT INTO Space [
  { id: "space1", name: "Production" },
  { id: "space2", name: "Dev" },
  { id: "space3", name: "Not-owned" }
];

INSERT INTO Account [
  { id: "account11", "provider": "google" },
  { id: "account12", "provider": "facebook" },
  { id: "account13", "provider": "github" },
  { id: "account21", "provider": "google" },
  { id: "account31", "provider": "facebook" }
];

INSERT INTO Post [
  { id: "post1", "mentions": [ "@Antoine" ]},
  { id: "post2", "mentions": [ "@Antoine", "@Loic" ]},
  { id: "post3", "mentions": [ "@Loic" ] },
  { id: "post4", "mentions": [ "@Ann" ] }
];

INSERT INTO UserAccounts [
  { id: "ua11", user: User:user1, accounts: [ Account:account11 ] },
  { id: "ua12", user: User:user1, accounts: [ Account:account12 ] },
  { id: "ua13", user: User:user1, accounts: [ Account:account13 ] },
  { id: "ua21", user: User:user2, accounts: [ Account:account21 ] },
  { id: "ua31", user: User:user3, accounts: [ Account:account31 ] }
];

INSERT INTO Power [
  { id: "power1", description: "useless power" }
];

INSERT INTO SpaceUser [
  { id: "u1s1", users: User:user1, spaces: Space:space1 },
  { id: "u1s2", users: User:user1, spaces: Space:space2 },
  { id: "u5s1", users: User:user5, spaces: Space:space1 },
  { id: "u2s2", users: User:user2, spaces: Space:space2 },
  { id: "u3s2", users: User:user3, spaces: Space:space2, power: Power:power1}
];

INSERT INTO UserTag [
  { id: "tag1", users: [ User:user1 ] },
  { id: "tag2", users: [ User:user1, User:user3 ] },
  { id: "tag3", users: [ User:user2 ] },
  { id: "tag4", users: [ User:user2 ] }
];

INSERT INTO Color [
  { id: "yellow" },
  { id: "blue" }
];

INSERT INTO UserTagGroup [
  { id: "utg1", tags: [ UserTag:tag1, UserTag:tag2 ], color: Color:yellow },
  { id: "utg2", tags: [ UserTag:tag3 ], color: Color:blue, space: Space:space3 },
];

INSERT INTO Kind [
  { id: "kind_book", name: "book", space: Space:space2 }
];

INSERT INTO Self [
  { id: "self1", space: Space:space2 },
  { id: "self2", space: Space:space2, owner: Self:self1 },
  { id: "self3", space: Space:space2, owner: Self:self2 },
  { id: "self4", space: Space:space2, owner: Self:self2 },
];

INSERT INTO Hook [
  { id: "hook1", requiredOption: "a" },
  { id: "hook2", requiredOption: "b" },
  { id: "hook3", requiredOption: "c" },
  { id: "hook4", requiredOption: "a" },
  { id: "hook5", requiredOption: "b" }
];

COMMIT TRANSACTION;