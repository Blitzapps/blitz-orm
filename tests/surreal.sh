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
        case $arg in
            -link=*)
            # We'll ignore this parameter now
            ;;
            *)
            VITEST_ARGS+=("$arg")
            ;;
        esac
    done
}

# Parse the command line arguments
parse_args "$@"

# Check if BORM_TEST_SURREALDB_LINK_MODE is set and valid
if [ -z "$BORM_TEST_SURREALDB_LINK_MODE" ]; then
    echo "Error: BORM_TEST_SURREALDB_LINK_MODE environment variable is not set"
    exit 1
elif [ "$BORM_TEST_SURREALDB_LINK_MODE" != "edges" ] && [ "$BORM_TEST_SURREALDB_LINK_MODE" != "refs" ]; then
    echo "Error: BORM_TEST_SURREALDB_LINK_MODE must be either 'edges' or 'refs'"
    exit 1
fi

# Set LINK based on BORM_TEST_SURREALDB_LINK_MODE
if [ "$BORM_TEST_SURREALDB_LINK_MODE" == "edges" ]; then
    LINK="edges"
else
    LINK="refs"
fi

# Set variables based on LINK
SCHEMA_FILE="./tests/adapters/surrealDB/mocks/${LINK}Schema.surql"
DATA_FILE="./tests/adapters/surrealDB/mocks/${LINK}Data.surql"
NAMESPACE="test_${LINK}"

# Start the container
docker run --detach --rm --pull always -v $(pwd)/tests:/tests -p 8000:8000 --name $CONTAINER_NAME surrealdb/surrealdb:v2.0.1 start --allow-all -u $USER -p $PASSWORD --bind 0.0.0.0:8000

until [ "`docker inspect -f {{.State.Running}} $CONTAINER_NAME`"=="true" ]; do
    sleep 0.1;
done;

# Setup surrealdb database for the surrealdb test
# Create the namespace, database, and user dynamically
docker exec -i $CONTAINER_NAME ./surreal sql -u $USER -p $PASSWORD <<EOF
DEFINE NAMESPACE $NAMESPACE;
USE NS $NAMESPACE;
DEFINE DATABASE test;
DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;
EOF

# Create the schema
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace $NAMESPACE --database test --endpoint http://localhost:8000 $SCHEMA_FILE
# Insert data
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace $NAMESPACE --database test --endpoint http://localhost:8000 $DATA_FILE

# Setup surrealdb database for the multidb test
# Create the namespace, database, and user
docker exec -i $CONTAINER_NAME ./surreal sql -u $USER -p $PASSWORD <<EOF
DEFINE NAMESPACE multi_db_test;
USE NS multi_db_test;
DEFINE DATABASE test;
DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;
EOF

# Create the schema
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace multi_db_test --database test --endpoint http://localhost:8000 ./tests/multidb/mocks/schema.surql
# Insert data
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace multi_db_test --database test --endpoint http://localhost:8000 ./tests/multidb/mocks/data.surql

# Run tests and capture output
if CONTAINER_NAME=${CONTAINER_NAME} npx vitest run "${VITEST_ARGS[@]}"; then
    echo "Tests passed. Container ${CONTAINER_NAME} is still running."
    TEST_FAILED=false
else
    echo "Tests failed. Container ${CONTAINER_NAME} is still running."
    TEST_FAILED=true
fi

echo "Press Ctrl+C to stop the script and remove the container."

# Keep the script running, which keeps the container alive
while true; do
    sleep 1
done
