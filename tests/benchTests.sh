#!/usr/bin/env bash

set -e

CONTAINER_NAME=borm_bench
USER=test
PASSWORD=test


# Function to clean up the container
cleanup() {
    echo "Stopping and removing container..."
    docker stop ${CONTAINER_NAME} >/dev/null 2>&1
    exit ${EXIT_CODE:-1}
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT INT TERM

# Function to parse command line arguments
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
docker run --detach --rm --pull always -v "$(pwd)/tests":/tests -p 8100:8000 --name $CONTAINER_NAME surrealdb/surrealdb:v3.0.4 start --allow-all -u $USER -p $PASSWORD --bind 0.0.0.0:8000 || { echo "Failed to start SurrealDB container"; exit 1; }

until [ "$(docker inspect -f {{.State.Running}} $CONTAINER_NAME)" == "true" ]; do
    sleep 0.1;
done;

# Setup surrealdb database for the surrealdb test
# Create the namespace, database, and user
docker exec -i $CONTAINER_NAME ./surreal sql --endpoint http://127.0.0.1:8000 -u $USER -p $PASSWORD <<EOF
DEFINE NAMESPACE $NAMESPACE;
USE NS $NAMESPACE;
DEFINE DATABASE test;
DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;
EOF

# Create the schema
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace $NAMESPACE --database test --endpoint http://127.0.0.1:8000 $SCHEMA_FILE
# Insert data
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace $NAMESPACE --database test --endpoint http://127.0.0.1:8000 $DATA_FILE

# Always stop container, but exit with 1 when tests are failing
if CONTAINER_NAME=${CONTAINER_NAME} tsx "$(dirname "${BASH_SOURCE[0]}")/unit/bench/testsBench.ts" "${VITEST_ARGS[@]}"; then
    echo "Bench passed. Container ${CONTAINER_NAME} is still running."
    EXIT_CODE=0
else
    echo "Bench failed. Container ${CONTAINER_NAME} is still running."
    EXIT_CODE=1
fi
