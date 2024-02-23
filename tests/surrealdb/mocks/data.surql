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
  { id: "ua11" },
  { id: "ua12" },
  { id: "ua13" },
  { id: "ua21" },
  { id: "ua31" }
];

RELATE UserAccounts:ua11 -> UserAccounts_user -> User:user1;
RELATE UserAccounts:ua11 -> UserAccounts_accounts -> Account:account11;
RELATE UserAccounts:ua12 -> UserAccounts_user -> User:user1;
RELATE UserAccounts:ua12 -> UserAccounts_accounts -> Account:account12;
RELATE UserAccounts:ua13 -> UserAccounts_user -> User:user1;
RELATE UserAccounts:ua13 -> UserAccounts_accounts -> Account:account13;
RELATE UserAccounts:ua21 -> UserAccounts_user -> User:user2;
RELATE UserAccounts:ua21 -> UserAccounts_accounts -> Account:account21;
RELATE UserAccounts:ua31 -> UserAccounts_user -> User:user3;
RELATE UserAccounts:ua31 -> UserAccounts_accounts -> Account:account31;

INSERT INTO Power [
  { id: "power1", description: "useless power" }
];

INSERT INTO SpaceUser [
  { id: "u1s1" },
  { id: "u1s2" },
  { id: "u5s1" },
  { id: "u2s2" },
  { id: "u3s2" }
];

RELATE SpaceUser:u1s1 -> SpaceUser_users -> User:user1;
RELATE SpaceUser:u1s1 -> SpaceUser_spaces -> Space:space1;
RELATE SpaceUser:u1s2 -> SpaceUser_users -> User:user1;
RELATE SpaceUser:u1s2 -> SpaceUser_spaces -> Space:space2;
RELATE SpaceUser:u5s1 -> SpaceUser_users -> User:user5;
RELATE SpaceUser:u5s1 -> SpaceUser_spaces -> Space:space1;
RELATE SpaceUser:u2s2 -> SpaceUser_users -> User:user2;
RELATE SpaceUser:u2s2 -> SpaceUser_spaces -> Space:space2;
RELATE SpaceUser:u3s2 -> SpaceUser_users -> User:user3;
RELATE SpaceUser:u3s2 -> SpaceUser_spaces -> Space:space2;
RELATE SpaceUser:u3s2 -> SpaceUser_power -> Power:power1;

INSERT INTO UserTag [
  { id: "tag1" },
  { id: "tag2" },
  { id: "tag3" },
  { id: "tag4" }
];

RELATE UserTag:tag1 -> UserTag_users -> User:user1;
RELATE UserTag:tag2 -> UserTag_users -> User:user1;
RELATE UserTag:tag2 -> UserTag_users -> User:user3;
RELATE UserTag:tag3 -> UserTag_users -> User:user2;
RELATE UserTag:tag4 -> UserTag_users -> User:user2;

INSERT INTO Color [
  { id: "yellow" },
  { id: "blue" }
];

INSERT INTO UserTagGroup [
  { id: "utg1" },
  { id: "utg2" },
];

RELATE UserTagGroup:utg1 -> UserTagGroup_color -> Color:yellow;
RELATE UserTagGroup:utg1 -> UserTagGroup_tags -> UserTag:tag1;
RELATE UserTagGroup:utg1 -> UserTagGroup_tags -> UserTag:tag2;

RELATE UserTagGroup:utg2 -> UserTagGroup_color -> Color:blue;
RELATE UserTagGroup:utg2 -> UserTagGroup_tags -> UserTag:tag3;
RELATE UserTagGroup:utg2 -> UserTagGroup_space -> Space:space3;


INSERT INTO Kind [
  { id: "kind_book", name: "book" }
];

RELATE Kind:kind_book -> Kind_space -> Space:space2;

INSERT INTO Self [
  { id: "self1" },
  { id: "self2" },
  { id: "self3" },
  { id: "self4" },
];

RELATE Self:self1 -> Self_space -> Space:space2;
RELATE Self:self2 -> Self_space -> Space:space2;
RELATE Self:self2 -> Self_owner -> Self:self1;
RELATE Self:self3 -> Self_space -> Space:space2;
RELATE Self:self3 -> Self_owner -> Self:self2;
RELATE Self:self4 -> Self_space -> Space:space2;
RELATE Self:self4 -> Self_owner -> Self:self2;

INSERT INTO Hook [
  { id: "hook1", requiredOption: "a" },
  { id: "hook2", requiredOption: "b" },
  { id: "hook3", requiredOption: "c" },
  { id: "hook4", requiredOption: "a" },
  { id: "hook5", requiredOption: "b" }
];

COMMIT TRANSACTION;