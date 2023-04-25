# Blitz-orm
Blitz-orm is an Object Relational Mapper (ORM) for graph databases that uses a JSON query language called Blitz Query Language (BQL). BQL is similar to GraphQL but uses JSON instead of strings.

Blitz-orm is similar to other ORM packages such as Prisma. You define a BQL schema and it gets translated to different databases (currently only compatible with TypeDB).

## Compatibility
Currently, the only database that is compatible with Blitz-orm is TypeDB. The goal is to build adapters for other graph databases such as Dgraph and Neo4j, as well as classic databases like PostgreSQL and MongoDB in the future.

## How to Use
1. Install the package using your package manager, for example:
`yarn add @blitznocode/blitz-orm`
2. Create a Borm schema. You can find an example in the test folder. 
3. The borm.define() function is currently not working, so you will need to manually translate your BQL schema into a TypeQL schema (an example can be found in the test folder).
4. Create a configuration file with the database name that you have created in TypeDB.
5. Initialize Blitz-orm in a file like this:
```
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
```
const res = await bormClient.mutate({$entity: 'User', name: 'Ann'}, { noMetadata: true });
```
## Gotchas
1) There is no borm.define() method yet. This means you will need to translate your borm schema into typeQL schema manually
2) Private (non shared) attributes are defined in typeDB as "nameOfTheThing·nameOfTheAttribute", where "·" is a mid-do. As an example:
```
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

## The future of this package
- Achieve 100% compatibility with typeDB functions
- Enhance functionality with new features such as, cardinality management, ordered attributes, Vectors (ordered relations)...
- Expand compatibility to other graph databases and traditional databases such as PostgreSQL or MongoDB
- Enable the ability to split queries and mutations across multiple databases (for example, some data stored in PostgreSQL and other data in typeQL, all queried from a single point)
