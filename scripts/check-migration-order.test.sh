#!/usr/bin/env bash
# Exercises check-migration-order.sh in a temporary repository.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-migration-order.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

fail() { echo "FAIL: $*" >&2; cat "$TMP/out" >&2 2>/dev/null || true; exit 1; }
pass() { echo "ok: $*"; }
run() { "$SCRIPT" "$@" > "$TMP/out" 2>&1; }
out_has() { grep -qF -- "$1" "$TMP/out"; }
# Passes only when the script rejects the branch, not when it crashes.
rejects() {
  local status=0
  run "$@" || status=$?
  [[ $status -eq 1 ]] && out_has "not newer than"
}

migration() {
  mkdir -p "services/db/migrations/$1"
  echo "-- $1" > "services/db/migrations/$1/migration.sql"
  echo '{}' > "services/db/migrations/$1/snapshot.json"
  git add -A && git commit -qm "migration $1"
}

git init -q "$TMP/repo"
cd "$TMP/repo"
git checkout -q -b trunk
migration 20260101000000_first

# A branch that adds a migration newer than the base passes.
git checkout -q -b newer
migration 20260201000000_newer
run trunk || fail "newer migration should pass"
pass "accepts a migration newer than the base"

# A branch with no new migration passes.
git checkout -q -b no-migration trunk
echo x > unrelated.txt && git add -A && git commit -qm "unrelated"
run trunk || fail "branch without migrations should pass"
pass "accepts a branch without migrations"

# A migration merged to the base after the branch was cut makes the branch's older one stale.
git checkout -q -b stale trunk
migration 20260301000000_stale
git checkout -q trunk
migration 20260401000000_merged
git checkout -q stale
rejects trunk || fail "stale migration should have failed"
out_has "services/db/migrations/20260301000000_stale/migration.sql" || fail "expected the stale file listed"
out_has "20260401000000_merged" || fail "expected the newest base migration named"
pass "rejects a migration older than the newest on the base"

# Works from stdin, the way CI runs the base branch's copy.
bash -s -- trunk < "$SCRIPT" > "$TMP/out" 2>&1 && fail "stale migration from stdin should have failed"
out_has "20260301000000_stale" || fail "expected the stale file listed from stdin"
pass "runs from stdin"

# Merging the base in does not hide the stale migration.
git merge -q --no-edit trunk
rejects trunk || fail "stale migration after merging the base should have failed"
pass "rejects a stale migration after the base is merged in"

# Only the stale migration is listed when the branch adds a newer one too.
migration 20260450000000_fresh
rejects trunk || fail "mixed migrations should have failed"
out_has "20260450000000_fresh" && fail "fresh migration listed as stale"
pass "lists only the stale migrations"
git rm -rq services/db/migrations/20260450000000_fresh
git commit -qm "drop fresh"

# Regenerating the migration with a newer timestamp passes.
git rm -rq services/db/migrations/20260301000000_stale
git commit -qm "drop stale"
migration 20260501000000_regenerated
run trunk || fail "regenerated migration should pass"
pass "accepts a regenerated migration"

# An edit to an existing migration is not an added migration.
git checkout -q -b edit trunk
echo "-- edit" >> services/db/migrations/20260101000000_first/migration.sql
git add -A && git commit -qm "edit"
run trunk || fail "edit should not count as an added migration"
pass "ignores edits to existing migrations"

# Renaming an existing migration counts as adding it.
git checkout -q -b rename trunk
git mv services/db/migrations/20260101000000_first services/db/migrations/20260102000000_first
git commit -qm "rename"
rejects trunk || fail "renamed migration should have failed"
pass "rejects a renamed migration"

# Drizzle skips a migration whose timestamp equals the last one applied.
git checkout -q -b same-second trunk
migration 20260401000000_same_second
rejects trunk || fail "equal timestamp should have failed"
pass "rejects a migration with the newest timestamp on the base"

# Fails on a base ref that does not exist.
run no-such-ref && fail "unknown base should have failed"
out_has "fatal" || fail "expected the git error"
pass "rejects an unknown base ref"

# Rejects a missing base ref.
run && fail "missing base should have failed"
out_has "Usage" || fail "expected usage"
pass "requires a base ref"

echo "All tests passed."
