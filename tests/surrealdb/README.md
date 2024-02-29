# SurrealDB test

Before we run test, start the db:

```sh
surreal start file:database.db  --allow-all -u tester -p tester
```

Then, we have to enter SQL shell by `surreal sql -u tester -p tester`, and execute the following command to set up the database.

```sh
DEFINE NAMESPACE test; USE NS test; DEFINE DATABASE test; DEFINE USER tester ON NAMESPACE PASSWORD 'tester' ROLES OWNER;
```

Then exit the shell, and execute the migration and seed script:

```sh
surreal import -u tester -p tester --namespace test --database test --endpoint http://localhost:8000  ./tests/surrealdb/mocks/schema.surql
surreal import -u tester -p tester --namespace test --database test --endpoint http://localhost:8000  ./tests/surrealdb/mocks/data.surql
```