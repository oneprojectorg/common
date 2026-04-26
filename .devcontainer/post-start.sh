#!/usr/bin/env bash
# Runs every time the devcontainer starts (including after a rebuild).
# Keep it fast and idempotent — heavy work belongs in post-create.sh.
set -euo pipefail

# Make sure the docker-in-docker daemon is reachable. The dind feature starts
# it on container start, but on slow hosts it can lag the first command.
if command -v docker >/dev/null; then
  for _ in 1 2 3 4 5; do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi
