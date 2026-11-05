#!/usr/bin/env bash
# Fails when HEAD adds a Drizzle migration that is not newer than every
# migration on <base-ref>. Drizzle does not apply a migration that is older
# than the last one it ran, so such a migration never reaches the database.
#
#   check-migration-order.sh <base-ref>
set -euo pipefail

MIGRATIONS_DIR="services/db/migrations"

base="${1:-}"
if [[ -z $base ]]; then
  echo "Usage: $0 <base-ref>" >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

# Directory names start with a 14-digit timestamp, so they sort by time.
newest_on_base=$(git ls-tree --name-only "$base" "$MIGRATIONS_DIR/" | sed 's#.*/##' | sort | tail -1)
newest_timestamp=${newest_on_base:0:14}

# --no-renames so a renamed migration directory shows up as an add.
added=$(git diff --name-only --diff-filter=A --no-renames "$base...HEAD" -- "$MIGRATIONS_DIR/*/migration.sql")

stale=()
while IFS= read -r file; do
  name=$(basename "$(dirname "$file")")
  # Drizzle compares timestamps only, so an equal one is stale too.
  if [[ -n $file && ! ${name:0:14} > $newest_timestamp ]]; then
    stale+=("$file")
  fi
done <<< "$added"

if [[ ${#stale[@]} -gt 0 ]]; then
  echo "These migrations are not newer than $newest_on_base, the newest migration on $base:" >&2
  printf '  %s\n' "${stale[@]}" >&2
  echo "Drizzle will not apply them. Merge $base, delete these migration directories, and run 'pnpm w:db generate' again." >&2
  exit 1
fi

echo "Migrations are newer than $base."
