USE NS test;
USE DB test;

BEGIN TRANSACTION;

INSERT INTO ⟨User⟩ [
  {id: "user1", name: "Antoine", email: "antoine@test.com"},
  {id: "user2", name: "Loic", email: "loic@test.com"},
  {id: "user3", name: "Ann", email: "ann@test.com"},
  {id: "user4", name: "Ben"},
  {id: "user5", name: "Charlize", email: "charlize@test.com"},
];

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
  { id: "ua1-1" },
  { id: "ua1-2" },
  { id: "ua1-3" },
  { id: "ua2-1" },
  { id: "ua3-1" }
];

RELATE ⟨`User-Accounts`⟩:`ua1-1` -> ⟨`User-Accounts_user`⟩ -> ⟨User⟩:user1;
RELATE ⟨`User-Accounts`⟩:`ua1-1` -> ⟨`User-Accounts_accounts`⟩ -> ⟨Account⟩:`account1-1`;
RELATE ⟨`User-Accounts`⟩:`ua1-2` -> ⟨`User-Accounts_user`⟩ -> ⟨User⟩:user1;
RELATE ⟨`User-Accounts`⟩:`ua1-2` -> ⟨`User-Accounts_accounts`⟩ -> ⟨Account⟩:`account1-2`;
RELATE ⟨`User-Accounts`⟩:`ua1-3` -> ⟨`User-Accounts_user`⟩ -> ⟨User⟩:user1;
RELATE ⟨`User-Accounts`⟩:`ua1-3` -> ⟨`User-Accounts_accounts`⟩ -> ⟨Account⟩:`account1-3`;
RELATE ⟨`User-Accounts`⟩:`ua2-1` -> ⟨`User-Accounts_user`⟩ -> ⟨User⟩:user2;
RELATE ⟨`User-Accounts`⟩:`ua2-1` -> ⟨`User-Accounts_accounts`⟩ -> ⟨Account⟩:`account2-1`;
RELATE ⟨`User-Accounts`⟩:`ua3-1` -> ⟨`User-Accounts_user`⟩ -> ⟨User⟩:user3;
RELATE ⟨`User-Accounts`⟩:`ua3-1` -> ⟨`User-Accounts_accounts`⟩ -> ⟨Account⟩:`account3-1`;

INSERT INTO ⟨Power⟩ [
  { id: "power1", description: "useless power" }
];

INSERT INTO ⟨Space-User⟩ [
  { id: "u1s1" },
  { id: "u1s2" },
  { id: "u5s1" },
  { id: "u2s2" },
  { id: "u3s2" }
];

RELATE ⟨`Space-User`⟩:u1s1 -> ⟨`Space-User_users`⟩ -> ⟨User⟩:user1;
RELATE ⟨`Space-User`⟩:u1s1 -> ⟨`Space-User_spaces`⟩ -> ⟨Space⟩:`space-1`;
RELATE ⟨`Space-User`⟩:u1s2 -> ⟨`Space-User_users`⟩ -> ⟨User⟩:user1;
RELATE ⟨`Space-User`⟩:u1s2 -> ⟨`Space-User_spaces`⟩ -> ⟨Space⟩:`space-2`;
RELATE ⟨`Space-User`⟩:u5s1 -> ⟨`Space-User_users`⟩ -> ⟨User⟩:user5;
RELATE ⟨`Space-User`⟩:u5s1 -> ⟨`Space-User_spaces`⟩ -> ⟨Space⟩:`space-1`;
RELATE ⟨`Space-User`⟩:u2s2 -> ⟨`Space-User_users`⟩ -> ⟨User⟩:user2;
RELATE ⟨`Space-User`⟩:u2s2 -> ⟨`Space-User_spaces`⟩ -> ⟨Space⟩:`space-2`;
RELATE ⟨`Space-User`⟩:u3s2 -> ⟨`Space-User_users`⟩ -> ⟨User⟩:user3;
RELATE ⟨`Space-User`⟩:u3s2 -> ⟨`Space-User_spaces`⟩ -> ⟨Space⟩:`space-2`;
RELATE ⟨`Space-User`⟩:u3s2 -> ⟨`Space-User_power`⟩ -> ⟨Power⟩:power1;

INSERT INTO ⟨UserTag⟩ [
  { id: "tag-1" },
  { id: "tag-2" },
  { id: "tag-3" },
  { id: "tag-4" }
];

RELATE UserTag:`tag-1` -> UserTag_users -> User:user1;
RELATE UserTag:`tag-2` -> UserTag_users -> User:user1;
RELATE UserTag:`tag-2` -> UserTag_users-> User:user3;
RELATE UserTag:`tag-3` -> UserTag_users -> User:user2;
RELATE UserTag:`tag-4` -> UserTag_users -> User:user2;

INSERT INTO ⟨Color⟩ [
  { id: "yellow" },
  { id: "blue" }
];

INSERT INTO ⟨UserTagGroup⟩ [
  { id: "utg-1" },
  { id: "utg-2" },
];

RELATE UserTagGroup:`utg-1` -> UserTagGroup_color -> Color:yellow;
RELATE UserTagGroup:`utg-1` -> UserTagGroup_tags -> UserTag:`tag-1`;
RELATE UserTagGroup:`utg-1` -> UserTagGroup_tags -> UserTag:`tag-2`;

RELATE UserTagGroup:`utg-2` -> UserTagGroup_color -> Color:blue;
RELATE UserTagGroup:`utg-2` -> UserTagGroup_tags -> UserTag:`tag-3`;
RELATE UserTagGroup:`utg-2` -> UserTagGroup_space -> Space:`space-3`;


INSERT INTO ⟨Kind⟩ [
  { id: "kind-book", name: "book" }
];

RELATE Kind:`kind-book` -> Kind_space -> Space:`space-2`;

INSERT INTO ⟨Self⟩ [
  { id: "self1" },
  { id: "self2" },
  { id: "self3" },
  { id: "self4" },
];

RELATE Self:self1 -> Self_space -> Space:`space-2`;
RELATE Self:self2 -> Self_space -> Space:`space-2`;
RELATE Self:self2 -> Self_owner -> Self:self1;
RELATE Self:self3 -> Self_space -> Space:`space-2`;
RELATE Self:self3 -> Self_owner -> Self:self2;
RELATE Self:self4 -> Self_space -> Space:`space-2`;
RELATE Self:self4 -> Self_owner -> Self:self2;

INSERT INTO ⟨Hook⟩ [
  { id: "hook1", requiredOption: "a" },
  { id: "hook2", requiredOption: "b" },
  { id: "hook3", requiredOption: "c" },
  { id: "hook4", requiredOption: "a" },
  { id: "hook5", requiredOption: "b" }
];

COMMIT TRANSACTION;