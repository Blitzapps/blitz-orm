#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME=borm_bench_v2
USER=borm_bench
PASSWORD=borm_bench
NAMESPACE=borm_bench
DATABASE=borm_bench
SCHEMA_FILE="./benches/schema.v2.surql"

# Function to clean up the container
cleanup() {
  echo "Stopping and removing container..."
  docker stop ${CONTAINER_NAME} >/dev/null 2>&1
  docker rm ${CONTAINER_NAME} >/dev/null 2>&1
  exit ${EXIT_CODE:-1} # Default to 1 if EXIT_CODE is unset (e.g. early crash)
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT INT TERM

# Function to parse command line arguments
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

# Start the container
if ! docker run \
  --rm \
  --detach \
  --name $CONTAINER_NAME \
  --user root \
  -p 8002:8002 \
  --pull always \
  surrealdb/surrealdb:v2.3.7 \
  start \
  -u $USER \
  -p $PASSWORD \
  --bind 0.0.0.0:8002 \
  rocksdb:///data/blitz.db; then
    echo "Failed to start SurrealDB container"
    exit 1
fi

until [ "`docker inspect -f {{.State.Running}} $CONTAINER_NAME`" == "true" ]; do
  sleep 0.1;
done;

# Wait for SurrealDB to be ready
echo "Waiting for SurrealDB to be ready..."
until docker exec $CONTAINER_NAME ./surreal is-ready --endpoint http://localhost:8002 2>/dev/null; do
  sleep 0.5;
done;
echo "SurrealDB is ready!"

# Setup surrealdb database: create the namespace, database, and user dynamically
docker exec -i $CONTAINER_NAME ./surreal sql -u $USER -p $PASSWORD --endpoint http://localhost:8002 <<EOF
DEFINE NAMESPACE $NAMESPACE;
USE NS $NAMESPACE;
DEFINE DATABASE $DATABASE;
DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;
EOF

# Create the schema
docker cp $SCHEMA_FILE $CONTAINER_NAME:/tmp/schema.surql
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace $NAMESPACE --database $DATABASE --endpoint http://localhost:8002 /tmp/schema.surql

# Always stop container, but exit with 1 when tests are failing
# if CONTAINER_NAME=${CONTAINER_NAME} npx vitest bench "${VITEST_ARGS[@]}"; then
if CONTAINER_NAME=${CONTAINER_NAME} tsx benches/v2.bench.ts; then
  echo "Bench passed. Container ${CONTAINER_NAME} is still running."
  EXIT_CODE=0
else
  echo "Bench failed. Container ${CONTAINER_NAME} is still running."
  EXIT_CODE=1
fi
