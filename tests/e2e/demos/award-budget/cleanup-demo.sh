#!/usr/bin/env bash
set -euo pipefail

S="$(cd "$(dirname "$0")" && pwd)"
LABEL="${1:-}"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

delete_profiles() {
  local where="$1"
  local names
  names="$(psql "$DB" -At -c "select coalesce(name, slug) from profiles where $where")"
  if [ -n "$names" ]; then
    echo "profiles:"; echo "$names" | sed 's/^/  /'
    psql "$DB" -At -c "delete from profiles where $where" | sed 's/^/  /'
  fi
}

delete_users() {
  local where="$1"
  local ids
  ids="$(psql "$DB" -At -c "select auth_user_id from users where $where")"
  if [ -n "$ids" ]; then
    echo "auth users:"
    # shellcheck disable=SC2086
    node "$S/rmusers.ts" $ids | sed 's/^/  /'
  fi
}

if [ -n "$LABEL" ]; then
  for seed in "$S/seed-$LABEL"*.json; do
    [ -f "$seed" ] || continue
    ids="$(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(s.cleanup.profileIds.map(id=>`'"'"'${id}'"'"'`).join(","))' "$seed")"
    delete_profiles "id in ($ids)"
  done
  if [ -f "$S/draft-$LABEL.slug" ]; then
    delete_profiles "slug = '$(cat "$S/draft-$LABEL.slug")'"
  fi
  delete_profiles "name like 'Award Demo Org $LABEL%' or name = 'Award demo $LABEL'"
  delete_users "email like 'award-demo-$LABEL-%' or email like 'screenshot-$LABEL-%'"
  rm -f "$S/seed-$LABEL"*.json "$S/session-$LABEL.json" "$S/cookies-$LABEL"*.json "$S/batch-$LABEL.json" "$S/batch-$LABEL.result.json" "$S/draft-$LABEL.slug"
else
  for seed in "$S"/seed-*.json; do
    [ -f "$seed" ] || continue
    ids="$(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(s.cleanup.profileIds.map(id=>`'"'"'${id}'"'"'`).join(","))' "$seed")"
    delete_profiles "id in ($ids)"
  done
  for slugfile in "$S"/draft-*.slug; do
    [ -f "$slugfile" ] || continue
    delete_profiles "slug = '$(cat "$slugfile")'"
  done
  delete_profiles "name like 'Award Demo Org %' or name like 'Award demo %'"
  delete_users "email like 'award-demo-%' or email like 'screenshot-%'"
  rm -f "$S"/seed-*.json "$S"/session-*.json "$S"/cookies-*.json "$S"/batch-*.json "$S"/batch-*.result.json "$S"/draft-*.slug
fi

echo "remaining: users=$(psql "$DB" -At -c "select count(*) from users where email like 'award-demo-%' or email like 'screenshot-%'") orgs=$(psql "$DB" -At -c "select count(*) from profiles where name like 'Award Demo Org %'")"
agent-browser close --all >/dev/null 2>&1 || true
echo "browser closed"
