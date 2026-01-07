#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME=borm_bench_v2
USER=borm_bench
PASSWORD=borm_bench
NAMESPACE=borm_bench
DATABASE=borm_bench
SCHEMA_FILE="./benches/schema.v2.surql"

# Start the container
docker run \
  --rm \
  --detach \
  --name $CONTAINER_NAME \
  -v borm_bench_data_v2:/data \
  -e SURREAL_CAPS_ALLOW_EXPERIMENTAL=graphql \
  --user root \
  -p 8101:8101 \
  --pull always \
  surrealdb/surrealdb:v2 \
  start \
  -u $USER \
  -p $PASSWORD \
  --bind 0.0.0.0:8101 \
  rocksdb:///data/blitz.db
  # surrealkv:///data/blitz.db

until [ "`docker inspect -f {{.State.Running}} $CONTAINER_NAME`" == "true" ]; do
    sleep 0.1;
done;

# Wait for SurrealDB to be ready
echo "Waiting for SurrealDB to be ready..."
until docker exec $CONTAINER_NAME ./surreal is-ready --endpoint http://localhost:8101 2>/dev/null; do
    sleep 0.5;
done;
echo "SurrealDB is ready!"

# Setup surrealdb database: create the namespace, database, and user dynamically
docker exec -i $CONTAINER_NAME ./surreal sql -u $USER -p $PASSWORD --endpoint http://localhost:8101 <<EOF
DEFINE NAMESPACE $NAMESPACE;
USE NS $NAMESPACE;
DEFINE DATABASE $DATABASE;
DEFINE USER $USER ON NAMESPACE PASSWORD '$PASSWORD' ROLES OWNER;
EOF

# Create the schema
docker cp $SCHEMA_FILE $CONTAINER_NAME:/tmp/schema.surql
docker exec -i $CONTAINER_NAME ./surreal import -u $USER -p $PASSWORD --namespace $NAMESPACE --database $DATABASE --endpoint http://localhost:8101 /tmp/schema.surql
