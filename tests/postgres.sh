#!/usr/bin/env bash

CONTAINER_NAME=borm_test_postgres
USER=test
PASSWORD=test
DB=test

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

# Run the DB
docker run \
  --name ${CONTAINER_NAME} \
  -e POSTGRES_USER=${USER} \
  -e POSTGRES_PASSWORD=${PASSWORD} \
  -e POSTGRES_DB=${DB} \
  -p 5432:5432 \
  --rm \
  -d \
  postgres

sleep 2

# Create the tables
docker run \
  -it \
  --rm \
  --name borm_test_schema \
  --network container:${CONTAINER_NAME} \
  -v $(pwd)/tests/adapters/postgresDB/mocks:/tests \
  postgres \
  psql -h localhost -p 5432 -U ${USER} -d ${DB} -f /tests/schema.sql

sleep 2

# Insert data
docker run \
  -it \
  --rm \
  --name borm_test_data \
  --network container:${CONTAINER_NAME} \
  -v $(pwd)/tests/adapters/postgresDB/mocks:/tests \
  postgres \
  psql -h localhost -p 5432 -U ${USER} -d ${DB} -f /tests/data.sql

sleep 2

# Run tests and capture output
if CONTAINER_NAME=${CONTAINER_NAME} npx vitest run "${VITEST_ARGS[@]}"; then
    echo "Tests passed. Container ${CONTAINER_NAME} is still running."
    TEST_FAILED=false
else
    echo "Tests failed. Container ${CONTAINER_NAME} is still running."
    TEST_FAILED=true
fi

echo "Press Ctrl+C to stop the script and remove the container."

# # Keep the script running, which keeps the container alive
# while true; do
#     sleep 1
# done
