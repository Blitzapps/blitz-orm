USE NS test;
USE DB test;

BEGIN TRANSACTION;


INSERT INTO ⟨Thing⟩ [
  {id: "thing1", stuff: "A"},
  {id: "thing2", stuff: "B"},
  {id: "thing3", stuff: "C"},
  {id: "thing4", stuff: "D"},
  {id: "thing5", stuff: "E"}
];

INSERT INTO ⟨SubthingOne⟩ [
  {id: "subthingone1", stuff: "F"},
  {id: "subthingone2", stuff: "G"},
  {id: "subthingone3", stuff: "H"}
];

INSERT INTO ⟨SubthingTwo⟩ [
  {id: "subthingtwo1", stuff: "I"},
  {id: "subthingtwo2", stuff: "J"},
  {id: "subthingtwo3", stuff: "K"}
];

RELATE ThingRelation:tr2 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr2 -> ThingRelation_root -> Thing:thing2;
RELATE ThingRelation:tr2 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr3 -> ThingRelation_things -> Thing:thing4;
RELATE ThingRelation:tr3 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr3 -> ThingRelation_root -> Thing:thing1;
RELATE ThingRelation:tr3 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr4 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr4 -> ThingRelation_root -> Thing:thing1;
RELATE ThingRelation:tr4 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr5 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr5 -> ThingRelation_root -> Thing:thing1;
RELATE ThingRelation:tr5 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr6 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr6 -> ThingRelation_root -> Thing:thing2;
RELATE ThingRelation:tr6 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr7 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr7 -> ThingRelation_root -> Thing:thing3;
RELATE ThingRelation:tr7 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr8 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr8 -> ThingRelation_root -> Thing:thing4;
RELATE ThingRelation:tr8 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr9 -> ThingRelation_things -> Thing:thing5;
RELATE ThingRelation:tr9 -> ThingRelation_root -> Thing:thing4;
RELATE ThingRelation:tr9 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr10 -> ThingRelation_extra -> Thing:thing1;

RELATE ThingRelation:tr11 -> ThingRelation_root -> Thing:thing4;
RELATE ThingRelation:tr11 -> ThingRelation_extra -> Thing:thing5;

INSERT INTO ⟨SuperUser⟩ [
  {id: "superuser1", name: "Beatrix Kiddo", email: "black.mamba@deadly-viper.com", power: "katana"}
];

INSERT INTO ⟨God⟩ [
  {id: "god1", name: "Richard David James", email: "afx@rephlex.com", power: "mind control", isEvil: true}
];

INSERT INTO ⟨Space⟩ [
  { id: "space-1", name: "Production" },
  { id: "space-2", name: "Dev" },
  { id: "space-3", name: "Not-owned" }
];

INSERT INTO ⟨User⟩ [
  {id: "user1", name: "Antoine", email: "antoine@test.com"},
  {id: "user2", name: "Loic", email: "loic@test.com"},
  {id: "user3", name: "Ann", email: "ann@test.com"},
  {id: "user4", name: "Ben"},
  {id: "user5", name: "Charlize", email: "charlize@test.com"},
];

INSERT INTO ⟨Account⟩ [
  { id: "account1-1", "provider": "google", profile: {hobby:["Running"]}},
  { id: "account1-2", "provider": "facebook" },
  { id: "account1-3", "provider": "github" },
  { id: "account2-1", "provider": "google" },
  { id: "account3-1", "provider": "facebook" }
];


INSERT INTO ⟨Post⟩ [
  { id: "post1", "mentions": [ "@Antoine" ]},
  { id: "post2", "mentions": [ "@Antoine", "@Loic" ]},
  { id: "post3", "mentions": [ "@Loic" ] },
  { id: "post4", "mentions": [ "@Ann" ] }
];

INSERT INTO ⟨User-Accounts⟩ [
  { id: "ua1-1", user: User:user1, accounts: [Account:⟨account1-1⟩] },
	{ id: "ua1-2", user: User:user1, accounts: [Account:⟨account1-2⟩] },
	{ id: "ua1-3", user: User:user1, accounts: [Account:⟨account1-3⟩] },
	{ id: "ua2-1", user: User:user2, accounts: [Account:⟨account2-1⟩] },
	{ id: "ua3-1", user: User:user3, accounts: [Account:⟨account3-1⟩] }
];


INSERT INTO ⟨Power⟩ [
  { id: "power1", description: "useless power" }
];

INSERT INTO ⟨Space-User⟩ [
  { id: "u1s1", users: [User:user1], spaces: [Space:`space-1`] },
	{ id: "u1s2", users: [User:user1], spaces: [Space:`space-2`] },
	{ id: "u5s1", users: [User:user5], spaces: [Space:`space-1`] },
	{ id: "u2s2", users: [User:user2], spaces: [Space:`space-2`] },
	{ id: "u3s2", users: [User:user3], spaces: [Space:`space-2`], power: Power:power1 }
];

INSERT INTO ⟨UserTag⟩ [
  { id: "tag-1", users: [User:user1] },
	{ id: "tag-2", users: [User:user1, User:user3] },
	{ id: "tag-3", users: [User:user2] },
	{ id: "tag-4", users: [User:user2] }
];

INSERT INTO ⟨Color⟩ [
  { id: "yellow", freeForAll: 7 },
  { id: "blue", freeForAll: "hey" },
	{ id: "red", freeForAll: "yay" }
];

INSERT INTO ⟨UserTagGroup⟩ [
  { id: "utg-1" },
  { id: "utg-2" },
];

RELATE ONLY UserTagGroup:`utg-1` -> UserTagGroup_color -> Color:yellow;
RELATE UserTagGroup:`utg-1` -> UserTagGroup_tags -> UserTag:`tag-1`;
RELATE UserTagGroup:`utg-1` -> UserTagGroup_tags -> UserTag:`tag-2`;

RELATE ONLY UserTagGroup:`utg-2` -> UserTagGroup_color -> Color:blue;
RELATE UserTagGroup:`utg-2` -> UserTagGroup_tags -> UserTag:`tag-3`;
RELATE UserTagGroup:`utg-2` -> UserTagGroup_space -> Space:`space-3`;


INSERT INTO ⟨Kind⟩ [
  { id: "kind-book", name: "book" }
];

RELATE Kind:`kind-book` -> SpaceObj_space -> Space:`space-2`;

INSERT INTO ⟨Self⟩ [
  { id: "self1" },
  { id: "self2" },
  { id: "self3" },
  { id: "self4" },
];

RELATE Self:self1 -> SpaceObj_space -> Space:`space-2`;
RELATE Self:self2 -> SpaceObj_space -> Space:`space-2`;
RELATE Self:self2 -> Self_owner -> Self:self1;
RELATE Self:self3 -> SpaceObj_space -> Space:`space-2`;
RELATE Self:self3 -> Self_owner -> Self:self2;
RELATE Self:self4 -> SpaceObj_space -> Space:`space-2`;
RELATE Self:self4 -> Self_owner -> Self:self2;

INSERT INTO ⟨Hook⟩ [
  { id: "hook1", requiredOption: "a" },
  { id: "hook2", requiredOption: "b" },
  { id: "hook3", requiredOption: "c" },
  { id: "hook4", requiredOption: "a" },
  { id: "hook5", requiredOption: "b" }
];

COMMIT TRANSACTION;