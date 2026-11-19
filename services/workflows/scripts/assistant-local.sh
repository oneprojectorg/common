#!/usr/bin/env bash
# Boot the voting assistant REPL against the local dev database.
#
# Usage:
#   services/workflows/scripts/assistant-local.sh --phone <E.164> [--decision <slug>]
#   services/workflows/scripts/assistant-local.sh --email <address> [--decision <slug>]
#
# The script starts the dev Supabase stack when it is down, then starts the
# CLI. The database and the inference endpoint both come from .env.local
# (DATABASE_URL, AI_BASE_URL, AI_API_KEY). The script never migrates, seeds
# or deletes anything. Until the conversation-storage migration reaches your
# dev database, the first question fails with `relation "conversations" does
# not exist`; apply the migration and run the script again.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DEV_AUTH_HEALTH="http://127.0.0.1:54321/auth/v1/health"

if ! grep -qE '^AI_BASE_URL=.+' .env.local; then
  echo "AI_BASE_URL is empty in .env.local — set an OpenAI-compatible endpoint." >&2
  exit 1
fi
if ! grep -qE '^AI_API_KEY=.+' .env.local; then
  echo "AI_API_KEY is empty in .env.local — set your provider key." >&2
  exit 1
fi

if ! curl -sf -o /dev/null "$DEV_AUTH_HEALTH"; then
  echo "Dev Supabase is down; starting it..."
  pnpm w:db start
fi

exec pnpm w:workflows assistant:cli "$@"
