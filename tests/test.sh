#!/usr/bin/env bash

CONTAINER_NAME=borm_test
USER=test
PASSWORD=test

# Function to clean up the container
cleanup() {
    echo "Stopping and removing container..."
    docker stop ${CONTAINER_NAME} >/dev/null 2>&1
    docker rm ${CONTAINER_NAME} >/dev/null 2>&1
    exit $((TEST_FAILED ? 1 : 0))
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT INT TERM

# Function to parse command line argumentsppa
parse_args() {
    VITEST_ARGS=()
    for arg in "$@"
    do
        VITEST_ARGS+=("$arg")
    done
}

# Parse the command line arguments
parse_args "$@"

# Set variables
SCHEMA_FILE="./tests/adapters/surrealDB/mocks/schema.surql"
DATA_FILE="./tests/adapters/surrealDB/mocks/data.surql"
NAMESPACE="test"

# Start the container
docker run --detach --rm --pull always -v "$(pwd)/tests":/tests -p 8100:8000 --name $CONTAINER_NAME surrealdb/surrealdb:v3.0.4 start --allow-all -u $USER -p $PASSWORD --bind 0.0.0.0:8000

# Wait for SurrealDB HTTP endpoint to be ready
until curl -sf -o /dev/null http://localhost:8100/health 2>/dev/null; do
    sleep 0.5;
done;

SURQL="curl -sf -X POST http://localhost:8100/sql -u $USER:$PASSWORD"

# Setup surrealdb database for the surrealdb test
$SURQL --data-binary "DEFINE NAMESPACE $NAMESPACE; USE NS $NAMESPACE; DEFINE DATABASE test; DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;"
# Create the schema
$SURQL -H "surreal-ns: $NAMESPACE" -H "surreal-db: test" --data-binary @"$SCHEMA_FILE"
# Insert data
$SURQL -H "surreal-ns: $NAMESPACE" -H "surreal-db: test" --data-binary @"$DATA_FILE"

# Setup surrealdb database for the multidb test
$SURQL --data-binary "DEFINE NAMESPACE multi_db_test; USE NS multi_db_test; DEFINE DATABASE test; DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;"
# Create the schema
$SURQL -H "surreal-ns: multi_db_test" -H "surreal-db: test" --data-binary @"./tests/multidb/mocks/schema.surql"
# Insert data
$SURQL -H "surreal-ns: multi_db_test" -H "surreal-db: test" --data-binary @"./tests/multidb/mocks/data.surql"

# Run tests and capture output
if CONTAINER_NAME=${CONTAINER_NAME} npx vitest run "${VITEST_ARGS[@]}"; then
    echo "Tests passed. Container ${CONTAINER_NAME} is still running."
    TEST_FAILED=false
else
    echo "Tests failed. Container ${CONTAINER_NAME} is still running."
    TEST_FAILED=true
fi

# echo "Press Ctrl+C to stop the script and remove the container."

# # Keep the script running, which keeps the container alive
# while true; do
#     sleep 1
# done
