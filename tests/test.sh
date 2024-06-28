#!/usr/bin/env bash

CONTAINER_NAME=borm_test

# Start the container
docker run --detach --rm --pull always -v $(pwd)/tests:/tests -p 8000:8000  --name $CONTAINER_NAME surrealdb/surrealdb:v2.0.0-alpha.3 start --allow-all -u tester -p tester --bind 0.0.0.0:8000

until [ "`docker inspect -f {{.State.Running}} $CONTAINER_NAME`"=="true" ]; do
    sleep 0.1;
done;

# Setup surrealdb database for the surrealdb test
# Create the namespace, database, and user
cat tests/surrealdb/mocks/database.surql | docker exec -i $CONTAINER_NAME ./surreal sql -u tester -p tester
# Create the schema
docker exec -i $CONTAINER_NAME ./surreal import -u tester -p tester --namespace test --database test --endpoint http://localhost:8000 ./tests/surrealdb/mocks/schema.surql
# Insert data
docker exec -i $CONTAINER_NAME ./surreal import -u tester -p tester --namespace test --database test --endpoint http://localhost:8000 ./tests/surrealdb/mocks/data.surql

# Setup surrealdb database for the multidb test
# Create the namespace, database, and user
cat tests/multidb/mocks/database.surql | docker exec -i $CONTAINER_NAME ./surreal sql -u tester -p tester
# Create the schema
docker exec -i $CONTAINER_NAME ./surreal import -u tester -p tester --namespace multi_db_test --database test --endpoint http://localhost:8000 ./tests/multidb/mocks/schema.surql
# Insert data
docker exec -i $CONTAINER_NAME ./surreal import -u tester -p tester --namespace multi_db_test --database test --endpoint http://localhost:8000 ./tests/multidb/mocks/data.surql

# Always stop container, but exit with 1 when tests are failing
if CONTAINER_NAME=${CONTAINER_NAME} npx vitest run $@; then
    docker stop ${CONTAINER_NAME}
else
    docker stop ${CONTAINER_NAME} && exit 1
fi