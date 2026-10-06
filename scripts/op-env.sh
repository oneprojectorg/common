#!/bin/sh
# Run a command with the variables from a 1Password Environment, via the
# documented `op run --environment`. Set OP_ENVIRONMENT_ID to the
# Environment's ID (1Password app: Developer > View Environments > Manage
# environment > Copy environment ID). Unset, the command runs untouched and
# `.env.local` works as before.
#
# TURBO_ENV_MODE=loose because turbo's default strict mode passes a task only
# the variables listed in turbo.json, a filter the `.env.local` loaders never
# hit because they read the file in-process.
if [ -z "$OP_ENVIRONMENT_ID" ]; then
  exec "$@"
fi
TURBO_ENV_MODE=loose exec op run --environment "$OP_ENVIRONMENT_ID" -- "$@"
