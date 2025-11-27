#!/bin/bash

CONTAINER_NAME="centrifugo"
PORT="8000"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.test"

# Check if container is already running
if docker inspect -f '{{.State.Running}}' $CONTAINER_NAME 2>/dev/null | grep -q "true"; then
  echo "✅ Centrifugo container is already running"
  exit 0
fi

# Remove any stopped container with same name
docker rm $CONTAINER_NAME 2>/dev/null || true

echo "🚀 Starting Centrifugo container..."
docker run --rm --name $CONTAINER_NAME -p $PORT:8000 --env-file "$ENV_FILE" centrifugo/centrifugo:v6 centrifugo
