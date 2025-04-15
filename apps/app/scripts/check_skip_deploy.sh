#!/bin/bash
# Exit immediately if any command fails
set -e

# Get the current branch name
current_branch=$(git symbolic-ref --short HEAD)

# Execute the turbo-ignore command only if the current branch is "dev" or "main"
if [[ "$current_branch" == "dev" || "$current_branch" == "main" ]]; then
  npx turbo-ignore --fallback=HEAD^1
else
  echo "Error: This command should only be run on 'dev' or 'main'. Current branch: $current_branch"
  exit 0
fi

