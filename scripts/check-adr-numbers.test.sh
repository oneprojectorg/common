#!/usr/bin/env bash
# Exercises check-adr-numbers.sh against a repository in a temporary directory.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-adr-numbers.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

fail() { echo "FAIL: $*" >&2; cat "$TMP/out" >&2 2>/dev/null || true; exit 1; }
pass() { echo "ok: $*"; }

git init -q "$TMP/work"
cd "$TMP/work"
git checkout -q -b trunk
mkdir -p docs/adr scripts
cp "$SCRIPT" scripts/check-adr-numbers.sh
echo "# Architecture Decision Records" > docs/adr/README.md
echo "# NNNN. {short title}" > docs/adr/adr-template.md
adr() { printf '# %s. %s\n' "$1" "$2" > "docs/adr/$1-$2.md"; }
commit() { git add -A && git commit -qm "$1"; }
run() { scripts/check-adr-numbers.sh "$@" > "$TMP/out" 2>&1; }
out_has() { grep -q "$1" "$TMP/out"; }
# Starts each case from a fresh branch off trunk.
feature() { git checkout -q trunk && git checkout -q -B feature; }

adr 0001 first
adr 0002 second
commit init

# Passes with and without a base, and skips the README and the template.
run || fail "clean tree"
run trunk || fail "clean tree against a base"
pass "accepts a clean tree"

# Accepts new ADRs that take the next free numbers.
feature
adr 0003 third
adr 0004 fourth
echo edit >> docs/adr/0001-first.md
commit "two new"
run trunk || fail "next free numbers should pass"
git show trunk:scripts/check-adr-numbers.sh | bash -s -- trunk > "$TMP/out" 2>&1 || fail "run from stdin"
pass "accepts the next free numbers"

# Rejects a new ADR that skips a number.
feature
adr 0004 gap
commit gap
run trunk && fail "a skipped number should have failed"
out_has "next free number on trunk is 0003" || fail "expected the next free number"
pass "rejects a skipped number"

# Rejects a new ADR whose number the base took after the branch was cut.
feature
adr 0003 mine
commit mine
git checkout -q trunk
adr 0003 theirs
commit theirs
git checkout -q feature
run trunk && fail "a number taken on the base should have failed"
out_has "0003-mine.md: the next free number on trunk is 0004" || fail "expected 0004"
git mv docs/adr/0003-mine.md docs/adr/0004-mine.md
echo "# 0004. mine" > docs/adr/0004-mine.md
commit renumber
run trunk || fail "the renumbered ADR should pass"
pass "rejects a number the base already took"

# Rejects an existing ADR renamed to a new number that is not the next one.
feature
git mv docs/adr/0001-first.md docs/adr/0009-first.md
echo "# 0009. first" > docs/adr/0009-first.md
commit rename
run trunk && fail "a renumbered old ADR should have failed"
out_has "0009-first.md" || fail "expected the renamed file listed"
pass "rejects renumbering an existing ADR"

# Rejects a file that has no number.
feature
echo "# NNNN. Draft" > docs/adr/draft-use-foo.md
commit draft
run && fail "an unnumbered file should have failed"
out_has "draft-use-foo.md: name an ADR" || fail "expected the naming message"
pass "rejects an unnumbered file"

# Rejects a heading that does not match the file name.
feature
echo "# 0005. wrong" > docs/adr/0004-wrong.md
commit heading
run && fail "a mismatched heading should have failed"
out_has "must start with '# 0004. '" || fail "expected the heading message"
pass "rejects a mismatched heading"

# Rejects a duplicate number.
feature
adr 0002 other
commit dupe
run && fail "a duplicate should have failed"
out_has "Duplicate ADR numbers in docs/adr: 0002" || fail "expected the duplicate message"
pass "rejects a duplicate number"

# Rejects an unknown flag.
run --nope && fail "an unknown flag should have failed"
out_has "Usage" || fail "expected usage"
pass "rejects an unknown flag"

echo "All tests passed."
