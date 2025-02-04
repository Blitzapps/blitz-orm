CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS "SuperUser" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "power" TEXT
);

CREATE TABLE IF NOT EXISTS "God" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "power" TEXT,
  "isEvil" BOOLEAN
);

CREATE TABLE IF NOT EXISTS "Space" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT
);

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT,
  "profile" JSONB
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "expires" TIMESTAMPTZ,
  "sessionToken" TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "id" TEXT PRIMARY KEY,
  "expires" TIMESTAMPTZ,
  "identifier" TEXT,
  "token" TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS "Thing" (
  "id" TEXT PRIMARY KEY,
  "stuff" TEXT
);

CREATE TABLE IF NOT EXISTS "SubthingOne" (
  "id" TEXT PRIMARY KEY,
  "stuff" TEXT
);

CREATE TABLE IF NOT EXISTS "SubthingTwo" (
  "id" TEXT PRIMARY KEY,
  "stuff" TEXT
);

CREATE TABLE IF NOT EXISTS "CascadeThing" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "Color" (
  "id" TEXT PRIMARY KEY,
  -- freeForAll,
  "value" TEXT
);

CREATE TABLE IF NOT EXISTS "Power" (
  "id" TEXT PRIMARY KEY,
  "description" TEXT
);

CREATE TABLE IF NOT EXISTS "Hook" (
  "id" TEXT PRIMARY KEY,
  "requiredOption" TEXT,
  "manyOptions" TEXT, -- Cardinality: Not supported
  "fnValidatedField" TEXT,
  "timestamp" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "industry" TEXT
);

CREATE TABLE IF NOT EXISTS "User-Accounts" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT REFERENCES "Account"("id"),
  "userId" TEXT REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "User-Sessions" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT REFERENCES "Session"("id"),
  "userId" TEXT REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "Space-User" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id"),
  "userId" TEXT REFERENCES "User"("id"),
  "powerId" TEXT REFERENCES "Power"("id")
);

CREATE TABLE IF NOT EXISTS "UserTag" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "userId" TEXT REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "UserTagGroup" (
  "id" TEXT PRIMARY KEY,
  "tagId" TEXT REFERENCES "UserTag"("id"),
  "colorId" TEXT REFERENCES "Color"("id"),
  "spaceId" TEXT REFERENCES "Space"("id")
);

CREATE TABLE IF NOT EXISTS "SpaceObj" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id")
);

CREATE TABLE IF NOT EXISTS "SpaceDef" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id"),
  "description" TEXT
);

CREATE TABLE IF NOT EXISTS "Kind" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id"),
  "description" TEXT,
  "name" TEXT
);

CREATE TABLE IF NOT EXISTS "Field" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id"),
  "description" TEXT,
  "name" TEXT,
  "cardinality" TEXT,
  "kindId" TEXT REFERENCES "Kind"("id")
);

CREATE TABLE IF NOT EXISTS "DataField" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id"),
  "description" TEXT,
  "name" TEXT,
  "cardinality" TEXT,
  "kindId" TEXT REFERENCES "Kind"("id"),
  "type" TEXT,
  "computeType" TEXT
);

CREATE TABLE IF NOT EXISTS "DataValue" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT,
  "dataFieldId" TEXT REFERENCES "DataField"("id")
);

CREATE TABLE IF NOT EXISTS "Expression" (
  "id" TEXT PRIMARY KEY,
  "value" TEXT,
  "type" TEXT,
  "dataFieldId" TEXT REFERENCES "DataField"("id")
);

CREATE TABLE IF NOT EXISTS "Self" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT REFERENCES "Space"("id"),
  "ownerId" TEXT REFERENCES "Self"("id")
);

CREATE TABLE IF NOT EXISTS "ThingRelation" (
  "id" TEXT PRIMARY KEY,
  "moreStuff" TEXT,
  "thingId" TEXT REFERENCES "Thing"("id"),
  "rootId" TEXT REFERENCES "Thing"("id"),
  "extraId" TEXT REFERENCES "Thing"("id")
);

CREATE TABLE IF NOT EXISTS "CascadeRelation" (
  "id" TEXT PRIMARY KEY,
  "thingId" TEXT REFERENCES "CascadeThing"("id")
);

CREATE TABLE IF NOT EXISTS "HookParent" (
  "id" TEXT PRIMARY KEY,
  "hookId" TEXT REFERENCES "Hook"("id"),
  "mainHookId" TEXT REFERENCES "Hook"("id")
);

CREATE TABLE IF NOT EXISTS "HookATag" (
  "id" TEXT PRIMARY KEY,
  "hookTypeAId" TEXT REFERENCES "Hook"("id"),
  "otherHookId" TEXT REFERENCES "Hook"("id")
);

CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "companyId" TEXT REFERENCES "Company"("id")
);

-- Hotel
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Hotel" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "location" VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT PRIMARY KEY,
    "hotelId" TEXT REFERENCES "Hotel"("id"),
    "pricePerNight" DECIMAL(10,2) NOT NULL,
    "isAvailable" BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "Guest" (
    "id" TEXT PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE,
    "phone" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS "Booking" (
    "id" TEXT PRIMARY KEY,
    "roomId" TEXT REFERENCES "Room"("id"),
    "guestId" TEXT REFERENCES "Guest"("id"),
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'reserved', -- 'reserved', 'checked-in', 'checked-out', 'canceled'
    "totalCost" DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT PRIMARY KEY,
    "bookingId" TEXT REFERENCES "Booking"("id"),
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
