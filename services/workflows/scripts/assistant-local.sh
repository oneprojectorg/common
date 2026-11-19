#!/usr/bin/env bash
# Boot the voting assistant REPL against the local test Supabase.
#
# Usage:
#   services/workflows/scripts/assistant-local.sh --phone <E.164> [--decision <slug>]
#   services/workflows/scripts/assistant-local.sh --email <address> [--decision <slug>]
#
# The script starts the test Supabase stack when it is down, applies the
# test-database migrations (additive), and starts the CLI pointed at it.
# It never deletes data. On a fresh or deseeded database, access checks fail
# with "does not have access"; run `pnpm w:db seed:test` once yourself —
# WARNING: that command wipes the test database first.
# The inference endpoint comes from AI_BASE_URL / AI_API_KEY in .env.local.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
TEST_AUTH_HEALTH="http://127.0.0.1:55321/auth/v1/health"

if ! grep -qE '^AI_BASE_URL=.+' .env.local; then
  echo "AI_BASE_URL is empty in .env.local — set an OpenAI-compatible endpoint." >&2
  exit 1
fi
if ! grep -qE '^AI_API_KEY=.+' .env.local; then
  echo "AI_API_KEY is empty in .env.local — set your provider key." >&2
  exit 1
fi

if ! curl -sf -o /dev/null "$TEST_AUTH_HEALTH"; then
  echo "Test Supabase is down; starting it..."
  pnpm test:supabase:start
fi

# Additive only. This is the test stack; CI owns real migrations. This
# script never seeds: `pnpm w:db seed:test` WIPES the database first, which
# would erase members, decisions and stored conversations between sessions.
pnpm w:db migrate:test

exec env DATABASE_URL="$TEST_DATABASE_URL" pnpm w:workflows assistant:cli "$@"
