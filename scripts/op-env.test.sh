#!/usr/bin/env bash
# Exercises op-env.mjs against a fake `op` CLI in a temporary directory.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/op-env.mjs"
NODE="$(command -v node)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL: $*" >&2; cat "$TMP/out" >&2 2>/dev/null || true; exit 1; }
pass() { echo "ok: $*"; }

# A fake `op` that answers one reference with a dotenv body.
mkdir "$TMP/bin"
cat >"$TMP/bin/op" <<'EOF'
#!/bin/sh
[ "$1" = read ] && [ "$2" = "op://Vault/common env/notesPlain" ] || {
  echo "unknown reference" >&2
  exit 1
}
printf 'FROM_ITEM=item\nSHARED=item\nMULTILINE="line one\nline two"\n'
EOF
chmod +x "$TMP/bin/op"

with_op() {
  PATH="$TMP/bin:$PATH" OP_ENV_LOCAL_REF="op://Vault/common env/notesPlain" "$@"
}

print_env='console.log([process.env.FROM_ITEM, process.env.SHARED, JSON.stringify(process.env.MULTILINE), process.env.TURBO_ENV_MODE, process.env.OP_ENV_LOCAL_HASH?.length].join("|"))'

# 1. Unset reference: the command runs untouched.
unset OP_ENV_LOCAL_REF
out=$("$NODE" "$SCRIPT" "$NODE" -e "$print_env")
[ "$out" = "||||" ] || fail "passthrough leaked env: $out"
pass "runs untouched without OP_ENV_LOCAL_REF"

# 2. Item injected, shell wins, multi-line values parse, turbo vars set.
out=$(SHARED=shell with_op "$NODE" "$SCRIPT" "$NODE" -e "$print_env")
[ "$out" = 'item|shell|"line one\nline two"|loose|64' ] || fail "injection: $out"
pass "injects the item with shell precedence"

# 3. A failed read stops before running the command.
if PATH="$TMP/bin:$PATH" OP_ENV_LOCAL_REF="op://missing" "$NODE" "$SCRIPT" touch "$TMP/ran" 2>"$TMP/out"; then
  fail "bad reference exited 0"
fi
[ ! -e "$TMP/ran" ] || fail "command ran after a failed read"
grep -q 'Could not read op://missing' "$TMP/out" || fail "bad reference message"
pass "bad reference exits 1 without running the command"

# 4. Missing CLI gets an install hint.
mkdir "$TMP/empty"
if PATH="$TMP/empty" OP_ENV_LOCAL_REF="op://x" "$NODE" "$SCRIPT" true 2>"$TMP/out"; then
  fail "missing op exited 0"
fi
grep -q 'not installed' "$TMP/out" || fail "missing op message"
pass "missing op CLI explains itself"

# 5. Exit codes propagate, including 128+signal.
set +e
"$NODE" "$SCRIPT" sh -c 'exit 7'
[ $? -eq 7 ] || fail "exit code not propagated"
"$NODE" "$SCRIPT" sleep 30 &
wrapper=$!
sleep 1
kill -TERM "$wrapper"
wait "$wrapper"
[ $? -eq 143 ] || fail "SIGTERM not forwarded as 143"
set -e
pass "propagates exit codes and forwards SIGTERM"
