# Blitz-orm

Blitz-orm is an Object Relational Mapper (ORM) for graph databases that uses a JSON query language called Blitz Query Language (BQL). BQL is similar to GraphQL but uses JSON instead of strings. This makes it easier to build dynamic queries.

Blitz-orm is similar to other ORM packages such as Prisma. You define a BQL schema and it gets translated to different databases (currently only compatible with TypeDB and SurrealDB).

## Compatibility

TypeDB

- Schema (working with issues)
- Queries (stable)
- Mutations (some issues)

SurrealDB

- Schema (to-do)
- Queries (stable)
- Mutations (some issues)

MultiDB

- Basic queries work and are correctly routed to different databases
- Nested queries with references to different dbs are not supported yet

Next-auth

- Fully compatible with next-auth (Auth.js) but we need to publish the adapter

## How to Use

1. Install the package using your package manager, for example:
`yarn add @blitznocode/blitz-orm`
2. Create a Borm schema. You can find an example in the test folder.
3. The borm.define() function is currently not working, so you will need to manually translate your BQL schema into a TypeQL schema (an example can be found in the test folder).
4. Create a configuration file with the database name that you have created in TypeDB.
5. Initialize Blitz-orm in a file like this:

```ts
import BormClient from '@blitznocode/blitz-orm';

import { bormConfig } from './borm.config';
import { schema } from './schema';

const bormClient = new BormClient({
  schema,
  config: bormConfig,
});

export default bormClient;
```

6. You can then run queries and mutations like this:

```ts
const res = await bormClient.mutate({$entity: 'User', name: 'Ann'}, { noMetadata: true });
```

## Gotchas

1) There is no borm.define() method yet. This means you will need to translate your borm schema into typeQL schema manually
2) Private (non shared) attributes are defined in typeDB as "nameOfTheThing·nameOfTheAttribute", where "·" is a mid-do. As an example:

```t
#shared attribute (shared: true) :
title sub attribute, value string;
#as a private attribute (shared: false), default behaviour:
book·title sub attribute, value string;
```

## Documentation & example queries

You can find example mutations and queries in the tests
There is no official documentation but you can check the draft RFC:
https://www.notion.so/blitzapps/BlitzORM-RFC-eb4a5e1464754cd7857734eabdeaa73c

The RFC includes future features and is not updated so please keep an eye on the query and mutation tests as those are designed for the features already working.

## How to Run TypeDB Locally

To run TypeDB locally, follow the official instructions at https://docs.vaticle.com/docs/running-typedb/install-and-run. It is recommended to run TypeDB Studio, define the schema there, and test with pure TypeQL before using Blitz-orm.

## Collaboration & Contact

You can contribute to the project by adding adapters for other databases, developing a BQL-to-GraphQL mapper, enhancing performance, or contributing to the public roadmap for this package (not yet published). To get in touch, please send an email to loic@blitznocode.com.

## Warning

Blitz-orm is currently in alpha version and not ready for production use. Some key queries and mutations do work, but there is still much that needs to be done and performance improvements are needed. One of the biggest performance issues is with nested queries, as they currently require a call to TypeDB for each level of depth.

## What is Currently Working

To see what is currently working and find examples, please check the test folder, where you will find a variety of queries and mutations.

## TypeGen

This orm includes a basic typeGen that gets you types depending on the structure of the borm Schema. You can use it like this:

```ts
type UserType = GenerateType<typeof typesSchema.relations.User>;
```

Due to typescript limitations and also to be able to type fields from extended things, you will need to compile your bormSchema to a particular format. In order to make this work you can see the example that we have in the tests that you can run with `pnpm test:buildSchema`. 

You can also use it with your base schema without compiling but some fields might not be there and you might need to ignore some ts errors. Also you will need "as const" at the end of your schema.

## The future of this package

- Achieve 100% compatibility with typeDB and surrealDB
- Automatic schemas: Transform BQL schemas into any schema
- GraphQL compatibility
- Enhance functionality with new features such as ordered attributes, Vectors (ordered relations)...
- Expand compatibility to other graph databases and traditional databases such as PostgreSQL or MongoDB
- Expand multidb compatibility, as now it is possible only for basic queries (querying data from two different DBs in a single BQL query)

## Development

- We use pnpm as a package manager
- You will need to add "-w", for instance `pnpm add -D husky -w`
