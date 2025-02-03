INSERT INTO "User" ("id", "name", "email")
VALUES
  ('user1', 'Antoine', 'antoine@test.com'),
  ('user2', 'Loic', 'loic@test.com'),
  ('user3', 'Ann', 'ann@test.com'),
  ('user4', 'Ben', NULL),
  ('user5', 'Charlize', 'charlize@test.com');

INSERT INTO "Thing" ("id", "stuff")
VALUES
  ('thing1', 'A'),
  ('thing2', 'B'),
  ('thing3', 'C'),
  ('thing4', 'D'),
  ('thing5', 'E');

INSERT INTO "SubthingOne" ("id", "stuff")
VALUES
  ('subthingone1', 'F'),
  ('subthingone2', 'G'),
  ('subthingone3', 'H');

INSERT INTO "SubthingTwo" ("id", "stuff")
VALUES
  ('subthingtwo1', 'I'),
  ('subthingtwo2', 'J'),
  ('subthingtwo3', 'K');

INSERT INTO "ThingRelation" ("id", "thingId", "rootId", "extraId")
VALUES
  ('tr2', 'thing5', 'thing2', 'thing1'),
  ('tr3', 'thing5', 'thing1', 'thing1'), -- Can not have multiple thingId (thingId: ['thing5', 'thing5'])
  ('tr4', 'thing5', 'thing1', 'thing1'),
  ('tr5', 'thing5', 'thing1', 'thing1'),
  ('tr6', 'thing5', 'thing2', 'thing1'),
  ('tr7', 'thing5', 'thing3', 'thing1'),
  ('tr8', 'thing5', 'thing4', 'thing1'),
  ('tr9', 'thing5', 'thing4', 'thing1'),
  ('tr10', NULL, NULL, 'thing1'),
  ('tr11', NULL, 'thing4', 'thing5');

INSERT INTO "SuperUser" ("id", "name", "email", "power")
VALUES ('superuser1', 'Beatrix Kiddo', 'black.mamba@deadly-viper.com', 'katana');

INSERT INTO "God" ("id", "name", "email", "power", "isEvil")
VALUES ('god1', 'Richard David James', 'afx@rephlex.com', 'mind control', TRUE);

INSERT INTO "Account" ("id", "provider", "profile")
VALUES
  ('account1-1', 'google', '{"hobby":["Running"]}'),
  ('account1-2', 'facebook', NULL),
  ('account1-3', 'github', NUll),
  ('account2-1', 'google', NULL),
  ('account3-1', 'facebook', NULL);

INSERT INTO "User-Accounts" ("id", "userId", "accountId")
VALUES
 ('ua1-1', 'user1', 'account1-1'),
 ('ua1-2', 'user1', 'account1-2'),
 ('ua1-3', 'user1', 'account1-3'),
 ('ua2-1', 'user2', 'account2-1'),
 ('ua3-1', 'user3', 'account3-1');

INSERT INTO "Space" ("id", "name")
VALUES
  ('space-1', 'Production'),
  ('space-2', 'Dev'),
  ('space-3', 'Not-owned');

INSERT INTO "Power" ("id", "description")
VALUES ('power1', 'useless power');

INSERT INTO "Space-User" ("id", "spaceId", "userId", "powerId")
VALUES
  ('u1-s1', 'space-1', 'user1', NULL),
  ('u1-s2', 'space-2', 'user1', NULL),
  ('u5-s1', 'space-1', 'user5', NULL),
  ('u2-s2', 'space-2', 'user2', NULL),
  ('u3-s2', 'space-2', 'user3', 'power1');

INSERT INTO "UserTag" ("id", "userId")
VALUES
  ('tag-1', 'user1'),
  ('tag-2', 'user1'), -- Can not have multiple thingId (userId: ['user1', 'user3'])
  ('tag-3', 'user2'),
  ('tag-4', 'user2');

-- NOTE: Postgres does not support flex type
-- $yellowFreeForAll "yellowFreeForAll" isa Color·freeForAll, has longAttribute 7;
-- $blueFreeForAll "blueFreeForAll" isa Color·freeForAll, has stringAttribute "hey";
-- $redFreeForAll "redFreeForAll" isa Color·freeForAll, has stringAttribute "yay";

-- Can not set Color.freeForAll
INSERT INTO "Color" ("id")
VALUES
  ('red'),
  ('yellow'),
  ('blue');

INSERT INTO "UserTagGroup" ("id", "tagId", "colorId", "spaceId")
VALUES
  ('utg-1', 'tag-1', 'yellow', NULL), -- Can not have multiple tagId (tagId: ['tag-1', 'tag-2'])
  ('utg-2', 'tag-3', 'blue', 'space-3');

INSERT INTO "Kind" ("id", "name", "spaceId")
VALUES
  ('kind-book', 'book', 'space-2');

INSERT INTO "Self" ("id", "spaceId", "ownerId")
VALUES
('self1', 'space-2', NULL),
('self2', 'space-2', 'self1'),
('self3', 'space-2', 'self2'),
('self4', 'space-2', 'self2');

INSERT INTO "Hook" ("id", "requiredOption")
VALUES
('hook1', 'a'),
('hook2', 'b'),
('hook3', 'c'),
('hook4', 'a'),
('hook5', 'b');