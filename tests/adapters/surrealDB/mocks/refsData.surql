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
  { id: "u1-s1", users: [User:user1], spaces: [Space:`space-1`] },
	{ id: "u1-s2", users: [User:user1], spaces: [Space:`space-2`] },
	{ id: "u2-s2", users: [User:user2], spaces: [Space:`space-2`] },
	{ id: "u3-s2", users: [User:user3], spaces: [Space:`space-2`], power: Power:power1 },
	{ id: "u5-s1", users: [User:user5], spaces: [Space:`space-1`] }
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
  { id: "utg-1", tags: [UserTag:`tag-1`, UserTag:`tag-2`], color: Color:yellow },
	{ id: "utg-2", tags: [UserTag:`tag-3`], color: Color:blue, space: Space:`space-3` }
];

INSERT INTO ⟨Kind⟩ [
  { id: "kind-book", name: "book", space: Space:`space-2` }
];


INSERT INTO ⟨Self⟩ [
  { id: "self1", space: Space:`space-2`},
	{ id: "self2", space: Space:`space-2`, owner : Self:self1},
	{ id: "self3", space: Space:`space-2`, owner : Self:self2},
	{ id: "self4", space: Space:`space-2`, owner : Self:self2}
];


INSERT INTO ⟨Hook⟩ [
  { id: "hook1", requiredOption: "a" },
  { id: "hook2", requiredOption: "b" },
  { id: "hook3", requiredOption: "c" },
  { id: "hook4", requiredOption: "a" },
  { id: "hook5", requiredOption: "b" }
];


INSERT INTO ⟨ThingRelation⟩ [
	{ id: "tr2", things: [Thing:thing5], root: Thing:thing2, extra: Thing:thing1 },
	{ id: "tr3", things: [Thing:thing5, Thing:thing4], root: Thing:thing1, extra: Thing:thing1 },
	{ id: "tr4", things: [Thing:thing5], root: Thing:thing1, extra: Thing:thing1 },
	{ id: "tr5", things: [Thing:thing5], root: Thing:thing1, extra: Thing:thing1 },
	{ id: "tr6", things: [Thing:thing5], root: Thing:thing2, extra: Thing:thing1 },
	{ id: "tr7", things: [Thing:thing5], root: Thing:thing3, extra: Thing:thing1 },
	{ id: "tr8", things: [Thing:thing5], root: Thing:thing4, extra: Thing:thing1 },
	{ id: "tr9", things: [Thing:thing5], root: Thing:thing4, extra: Thing:thing1 },
	{ id: "tr10", extra: Thing:thing1 },
	{ id: "tr11", root: Thing:thing4, extra: Thing:thing5 }
];

## FlexRef

INSERT INTO ⟨FlexRef⟩ [
	{ id: "fr1", reference: User:user1 },
	{ id: "fr2", references: [User:user1, User:user2]},
	{ id: 'fr3', flexReference: 7},
	{ id: 'fr4', flexReference: User:user1},
	{ id: 'fr5', flexReferences: [7, User:user1,'hey']},
];
	
## big numbers

LET $companies = (
    function() {
        return Array.from({length: 1000}, (_, i) => i + 1);
    }
);

 FOR $company IN $companies {
   LET $compId = CREATE ONLY type::thing('Company',type::string($company) ) CONTENT {
        name: string::concat('Company ', type::string($company)),
        industry: rand::enum(['Tech', 'Finance', 'Healthcare', 'Retail', 'Manufacturing'])
    };
    FOR $employee IN [0,1,2,3,4,5,6,7,8,9] {
        CREATE type::thing('Employee',type::string(($company * 10) + $employee))  CONTENT {
            name: string::concat('Employee ',  type::string(($company * 10) + $employee)),
            company: $compId.id
        }
    }
};

COMMIT TRANSACTION;