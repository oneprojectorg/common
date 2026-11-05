#!/bin/sh
# Run a command with the variables from a 1Password Environment, via the
# documented `op run --environment`. Set OP_ENVIRONMENT_ID to the
# Environment's ID (1Password app: Developer > View Environments > Manage
# environment > Copy environment ID). Unset, the command runs untouched and
# `.env.local` works as before.
#
# A root `.env.local`, if present, is layered on top so local values override
# the shared Environment (dotenv-cli `-o`; the Next and drizzle loaders never
# override variables that are already set).
#
# TURBO_ENV_MODE=loose because turbo's default strict mode passes a task only
# the variables listed in turbo.json, a filter the `.env.local` loaders never
# hit because they read the file in-process. TURBO_CACHE is disabled because
# turbo hashes `.env.local` through globalDependencies but cannot see the
# Environment, so a cached build could replay output made with old values.
if [ -z "$OP_ENVIRONMENT_ID" ]; then
  exec "$@"
fi
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TURBO_ENV_MODE=loose TURBO_CACHE=local:,remote: exec op run \
  --environment "$OP_ENVIRONMENT_ID" -- \
  "$ROOT/node_modules/.bin/dotenv" -e "$ROOT/.env.local" -o -- "$@"
