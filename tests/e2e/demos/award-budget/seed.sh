#!/usr/bin/env bash
set -euo pipefail

S="$(cd "$(dirname "$0")" && pwd)"
ROOT="$S"
while [ ! -f "$ROOT/pnpm-workspace.yaml" ]; do
  ROOT="$(dirname "$ROOT")"
  [ "$ROOT" != "/" ] || { echo "repo root not found above $S" >&2; exit 1; }
done
LABEL="${1:-demo}"
BUDGET="${2:-12000}"
HIDE_BUDGET="${3:-false}"

env_value() {
  grep -E "^$1=" "$ROOT/.env.local" | head -1 | cut -d= -f2- | sed -E 's/^"|"$//g'
}

SEEDER="scripts/seed-award-demo.ts"
if [ ! -f "$ROOT/tests/e2e/$SEEDER" ]; then
  SEEDER="scripts/seed-award-demo.staged.ts"
fi
[ -f "$ROOT/tests/e2e/$SEEDER" ] || { echo "no seeder under $ROOT/tests/e2e/scripts; run 'just main-demo-stage' on the PR branch first" >&2; exit 1; }

NEXT_PUBLIC_SUPABASE_URL="$(env_value NEXT_PUBLIC_SUPABASE_URL)" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)" \
SUPABASE_SERVICE_ROLE="$(env_value SUPABASE_SERVICE_ROLE)" \
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
pnpm --dir "$ROOT" --filter @op/e2e exec tsx "$SEEDER" \
  "--label=$LABEL" "--budget=$BUDGET" "--hide-budget=$HIDE_BUDGET" "--out=$S/seed-$LABEL.json" \
  2>&1 | grep -v -E 'WARN|npmrc|Unsupported engine'
