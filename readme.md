Blitz-orm is a public package that can be open-sourced

Similar to Prisma, it's used to interpret a BQL schema and provide the client and the server with tools to ensure they are "speaking the same language"

## Compatibility
The only database that is currently compatible with borm is TypeDB. We want to build adapters in the future for other graph databases like dgraph and neo4j, as well as classic dbs like postgres and mongoDB. 

## How to use
- Install the package with your packages manager, like this: 
`yarn add @blitznocode/blitz-orm`
- Create a borm schema, ou have an example in the test folder
- borm.define() is still not working, this means you will need to translate your bql schema into a typeQL schema manually (an example in test folder)
- Create a configuration file with the database name that you have created in typeDB
- Init borm in a file like this
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
- And now you can run queries and mutations like this
```
const res = await bormClient.mutate({$entity: 'User', name: 'Ann'} { noMetadata: true });
```

## How to run typeDB locally
Follow official instructions: https://docs.vaticle.com/docs/running-typedb/install-and-run
We advice to run TypeDB studio, define the schema there and do some tests with pure typeQL before using borm.

## Collaborate / Contact
You can help us adding adapters (mongo, postgres, neo4j...), a BQL<>graphQL mapper, performance enhancements, or contributing with our public roadmap for this package (not yet published). Please feel free to send an email to loic@blitnocode.com 

## Warning
- This package is in alpha version, not yet ready for production. Most key queries and mutations do work, but a lot is missing and performance has to be enhanced also in the future. One of the biggest performance drops is on nested queries as they currently require as many calls to typeDB as levels of depth 

## Working
- To check what is working and some examples, please feel free to check the test folder, where there are a bunch of queries and mutations.