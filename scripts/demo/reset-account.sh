#!/usr/bin/env bash
#
# Delete the local account holding the demo phone number, so the Join path can
# be run again from nothing.
#
# The demos park previous holders on spare 1500555xxxx numbers rather than
# deleting them, because some of those accounts authored proposals. That is
# safe but it accumulates, so this script also sweeps the litter.
#
#   ./scripts/demo/reset-account.sh              # delete the holder of the test number
#   ./scripts/demo/reset-account.sh --dry-run    # say what would go, change nothing
#   ./scripts/demo/reset-account.sh --sweep      # also delete parked accounts that own nothing
#   ./scripts/demo/reset-account.sh --force      # delete even if the account authored proposals
#
# An account that authored proposals is refused by default: deleting it takes
# its proposals with it, and those are what the demos display.

cd "$(dirname "$0")/../.." || exit 1

SESSION="reset"  # unused; lib.sh defines a browser helper we do not call here
# shellcheck source=scripts/demo/lib.sh
. scripts/demo/lib.sh

DRY_RUN=0
SWEEP=0
FORCE=0
# Numbers the demos park previous holders on. Narrow on purpose: it must never
# match a real local account.
PARKED_PREFIX="1500555"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --sweep) SWEEP=1 ;;
    --force) FORCE=1 ;;
    --phone) PHONE="$2"; shift ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "✗ database container $DB_CONTAINER not found" >&2
  exit 1
fi

# Reports "<auth_id>|<user_id>|<profile_id>|<name>|<proposals>" for one number.
account_row() {
  psql_q "
    SELECT au.id
        || '|' || coalesce(u.id::text, '')
        || '|' || coalesce(u.current_profile_id::text, '')
        || '|' || coalesce(p.name, '(no profile)')
        || '|' || (SELECT count(*) FROM decision_proposals dp
                   WHERE dp.submitted_by_profile_id = u.current_profile_id)
    FROM auth.users au
    LEFT JOIN users u ON u.auth_user_id = au.id
    LEFT JOIN profiles p ON p.id = u.current_profile_id
    WHERE au.phone = '${1#+}';"
}

# Deletes profile, then the app user row, then the auth user — the order the
# repository's own gating-test cleanup uses.
delete_account() {
  local auth_id="$1" user_id="$2" profile_id="$3"
  local sql="BEGIN;"
  [ -n "$profile_id" ] && sql="$sql DELETE FROM profiles WHERE id = '$profile_id';"
  [ -n "$user_id" ]    && sql="$sql DELETE FROM users WHERE id = '$user_id';"
  sql="$sql DELETE FROM auth.users WHERE id = '$auth_id'; COMMIT;"
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -q -c "$sql" >/dev/null 2>&1
}

removed=0
kept=0

# One number, named explicitly: report what it owns before touching it.
consider() {
  local phone="$1" row auth_id user_id profile_id name proposals
  row=$(account_row "$phone")

  if [ -z "$row" ]; then
    echo "· $phone — no account holds it"
    return 0
  fi

  IFS='|' read -r auth_id user_id profile_id name proposals <<<"$row"

  if [ "$proposals" != "0" ] && [ "$FORCE" -eq 0 ]; then
    echo "! $phone — '$name' authored $proposals proposal(s); keeping it."
    echo "  Those proposals go with the account. Pass --force to delete anyway."
    kept=$((kept + 1))
    return 0
  fi

  local note=""
  [ "$proposals" != "0" ] && note=" (and $proposals proposal(s), --force)"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "would delete: $phone — '$name'$note"
    return 0
  fi

  delete_account "$auth_id" "$user_id" "$profile_id"
  if [ -z "$(account_row "$phone")" ]; then
    echo "✓ deleted $phone — '$name'$note"
    removed=$((removed + 1))
  else
    echo "✗ failed to delete $phone — '$name'" >&2
  fi
}

echo "▸ The demo number"
consider "$PHONE"

if [ "$SWEEP" -eq 1 ]; then
  echo
  echo "▸ Parked demo accounts"
  # Everything on the parking prefix except the demo number itself, which the
  # step above already handled.
  parked=$(psql_q "SELECT au.phone FROM auth.users au
                   WHERE au.phone LIKE '${PARKED_PREFIX}%'
                     AND au.phone <> '${PHONE#+}'
                   ORDER BY au.phone;")
  if [ -z "$parked" ]; then
    echo "· none"
  else
    while read -r phone; do
      [ -n "$phone" ] && consider "+$phone"
    done <<<"$parked"
  fi
fi

echo
if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run — nothing was changed."
else
  echo "Removed $removed account(s); kept $kept with proposals."
fi

# Leaving no orphans matters more than the count: a stale profile_users row
# still grants access.
orphans=$(psql_q "SELECT count(*) FROM profile_users pu
                  WHERE pu.auth_user_id NOT IN (SELECT id FROM auth.users)
                    AND pu.auth_user_id <> '00000000-0000-4000-a000-000000000001';")
if [ "${orphans:-0}" != "0" ]; then
  echo "! $orphans profile_users row(s) reference a deleted auth user" >&2
fi
