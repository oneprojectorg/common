#!/bin/bash
# Exit immediately if any command fails
set -e

# Execute the turbo-ignore command only if the current branch is "dev" or "main"
if [[ "$VERCEL_GIT_COMMIT_REF" == "dev" || "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "log-debugging" ]]; then
  npx turbo-ignore --fallback=HEAD^1
else
  echo "Error: This command should only be run on 'dev' or 'main'. Current branch: $VERCEL_GIT_COMMIT_REF"
  exit 0
fi

