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
  { id: "space1", name: "Production" },
  { id: "space2", name: "Dev" },
  { id: "space3", name: "Not-owned" }
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

-- # $thingrelation-1 (things: $thing1, things: $subthing-one-1, things: $subthing-two-1, things: $subthing-two-2) isa ThingRelation, has id 'tr1';
-- $thingrelation-2 (things: $thing5, root: $thing2, extra: $thing1) isa ThingRelation, has id 'tr2';
-- $thingrelation-3 (things: $thing5, things: $thing4, root: $thing1, extra: $thing1) isa ThingRelation, has id 'tr3';
-- $thingrelation-4 (things: $thing5, root: $thing1, extra: $thing1) isa ThingRelation, has id 'tr4';
-- $thingrelation-5 (things: $thing5, root: $thing1, extra: $thing1) isa ThingRelation, has id 'tr5';
-- $thingrelation-6 (things: $thing5, root: $thing2, extra: $thing1) isa ThingRelation, has id 'tr6';
-- $thingrelation-7 (things: $thing5, root: $thing3, extra: $thing1) isa ThingRelation, has id 'tr7';
-- $thingrelation-8 (things: $thing5, root: $thing4, extra: $thing1) isa ThingRelation, has id 'tr8';
-- $thingrelation-9 (things: $thing5, root: $thing4, extra: $thing1) isa ThingRelation, has id 'tr9';
-- $thingrelation-10 (extra: $thing1) isa ThingRelation, has id 'tr10';
-- $thingrelation-11 (root: $thing4, extra: $thing5) isa ThingRelation, has id 'tr11';

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
  { id: "ua11", user: User:user1, account: Account:account11 },
  { id: "ua12", user: User:user1, account: Account:account12 },
  { id: "ua13", user: User:user1, account: Account:account13 },
  { id: "ua21", user: User:user2, account: Account:account21 },
  { id: "ua31", user: User:user3, account: Account:account31 }
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
  { id: "tag1", user: User:user1 },
  { id: "tag21", user: User:user1 },
  { id: "tag22", user: User:user3 },
  { id: "tag3", user: User:user2 },
  { id: "tag4", user: User:user2 }
];

-- $group-1 (tags: $tag-1, tags: $tag-2, color: $yellow) isa UserTagGroup, has id 'utg-1';
-- $group-2 (tags: $tag-3, color:$blue, space: $space-3) isa UserTagGroup, has id 'utg-2';

INSERT INTO Color [
  { id: "yellow" },
  { id: "blue" }
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