# SurrealDB test

Before we run test, start the db:

```sh
surreal start file:database.db  --allow-all -u tester -p tester
```

Then create the database:

```sh
cat ./tests/surrealdb/mocks/database.surql | surreal sql -u tester -p tester
```

Then execute the migration and seed script:

```sh
surreal import -u tester -p tester --namespace test --database test --endpoint http://localhost:8000  ./tests/surrealdb/mocks/schema.surql
surreal import -u tester -p tester --namespace test --database test --endpoint http://localhost:8000  ./tests/surrealdb/mocks/data.surql
```