#!/usr/bin/env bash
# Run the SMS voting demo scripts in this folder against the local database.
# DATABASE_URL comes from the environment, or from the repo's .env.local.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

DEFAULT_SLUG="sms-voting-test"

usage() {
  cat <<'EOF'
Usage: run.sh <command> [argument]

Commands:
  show [slug]            Print one decision's whole voting state as JSON.
  reset-decision [slug]  Delete every voter's registrations, drafts, chat
                         sessions and cast ballots on one decision.
  reset-account <phone>  Delete the account behind one phone number so JOIN
                         starts from scratch.
  reset <phone> [slug]   reset-decision, then reset-account, then show.

Default: slug=sms-voting-test. The phone number is always explicit.
DATABASE_URL is read from the environment, else from .env.local.
EOF
}

db_url() {
  if [ -n "${DATABASE_URL:-}" ]; then
    printf '%s' "$DATABASE_URL"
    return
  fi
  if [ -f "$REPO_ROOT/.env.local" ]; then
    grep '^DATABASE_URL=' "$REPO_ROOT/.env.local" | cut -d= -f2-
    return
  fi
  echo "DATABASE_URL is not set and $REPO_ROOT/.env.local does not exist" >&2
  exit 1
}

DB=''

ensure_db() {
  DB="$(db_url)"
  if [ -z "$DB" ]; then
    echo "DATABASE_URL is empty" >&2
    exit 1
  fi

  # These scripts hard-delete demo state. Refuse a non-local database unless
  # the caller opts in explicitly.
  case "$DB" in
    *localhost* | *127.0.0.1* | *0.0.0.0*) ;;
    *)
      if [ "${SMS_DEMO_ALLOW_REMOTE:-}" != "1" ]; then
        echo "Refusing a non-local DATABASE_URL. Set SMS_DEMO_ALLOW_REMOTE=1 to override." >&2
        exit 1
      fi
      ;;
  esac
}

maybe_jq() {
  if command -v jq > /dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

show() {
  psql "$DB" -v slug="$1" -At -f "$SCRIPT_DIR/describeDecisionProcess.sql" | maybe_jq
}

reset_decision() {
  psql "$DB" -v slug="$1" -At -f "$SCRIPT_DIR/resetDecisionVoting.sql"
}

reset_account() {
  psql "$DB" -v phone="$1" -At -f "$SCRIPT_DIR/resetSmsAccount.sql"
}

case "${1:-}" in
  show)
    ensure_db
    show "${2:-$DEFAULT_SLUG}"
    ;;
  reset-decision)
    ensure_db
    reset_decision "${2:-$DEFAULT_SLUG}"
    ;;
  reset-account)
    if [ -z "${2:-}" ]; then
      echo "reset-account needs a phone number, e.g. +15555550123" >&2
      exit 1
    fi
    ensure_db
    reset_account "$2"
    ;;
  reset)
    if [ -z "${2:-}" ]; then
      echo "reset needs a phone number first, e.g. reset +15555550123 [slug]" >&2
      exit 1
    fi
    ensure_db
    reset_decision "${3:-$DEFAULT_SLUG}"
    reset_account "$2"
    show "${3:-$DEFAULT_SLUG}"
    ;;
  -h | --help | help | '')
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
