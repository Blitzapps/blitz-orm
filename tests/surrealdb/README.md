# SurrealDB test

At the time of writing, we [cannot define schema at runtime for SurrealDB](https://github.com/surrealdb/surrealdb/issues/3541). We also [cannot define schema in a file and import it with single command](https://github.com/surrealdb/surrealdb/issues/3548).

Therefore, we cannot only make all table schemaless.

Before we run test, start the db:

```sh
surreal start file:database.db  --allow-all
```

Then, we have to enter SQL shell by `surreal sql`, and execute the following command.

```sh
DEFINE NAMESPACE test; USE NS test; DEFINE DATABASE test; DEFINE USER tester ON NAMESPACE PASSWORD 'tester' ROLES OWNER;
```

And then copy the schema from `tests/surrealdb/mocks/schema.surql` and the seed from `tests/surrealdb/mocks/data.surql` into the shell to complete the migration and seeding.