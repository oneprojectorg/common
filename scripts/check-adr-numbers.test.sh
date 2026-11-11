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
printf '# Architecture Decision Records\n\n- [the template](./adr-template.md)\n\n## Index\n\n' > docs/adr/README.md
echo "# NNNN. {short title}" > docs/adr/adr-template.md
# Writes the file only.
file() { printf '# %s. %s\n' "$1" "$2" > "docs/adr/$1-$2.md"; }
# Writes the file and appends its index line.
adr() { file "$1" "$2" && printf -- '- [%s. %s](./%s-%s.md)\n' "$1" "$2" "$1" "$2" >> docs/adr/README.md; }
commit() { git add -A && git commit -qm "$1"; }
run() { scripts/check-adr-numbers.sh "$@" > "$TMP/out" 2>&1; }
out_has() { grep -q -- "$1" "$TMP/out"; }
# Starts each case from a fresh, clean branch off trunk.
feature() { git checkout -q -f trunk && git clean -qfd && git checkout -q -B feature; }

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

# Checks an ADR that is not committed yet.
feature
adr 0004 uncommitted
run trunk && fail "an uncommitted skipped number should have failed"
out_has "0004-uncommitted.md: the next free number on trunk is 0003" || fail "expected 0003"
pass "checks the working tree"

# Rejects a new ADR whose number the base took after the branch was cut, and
# git refuses the merge because both sides appended to the index.
feature
adr 0003 mine
commit mine
git checkout -q trunk
adr 0003 theirs
commit theirs
git checkout -q feature
run trunk && fail "a number taken on the base should have failed"
out_has "0003-mine.md: the next free number on trunk is 0004" || fail "expected 0004"
git merge -q trunk > /dev/null 2>&1 && fail "the index should have conflicted"
git diff --name-only --diff-filter=U | grep -qx docs/adr/README.md || fail "expected a conflict in the index"
git merge --abort
pass "rejects a number the base already took, and the merge conflicts"

# Accepts the ADR once it is renumbered on top of the base.
git merge -q -X theirs trunk > /dev/null 2>&1 || fail "merge"
git rm -q -f docs/adr/0003-mine.md
adr 0004 mine
commit renumber
run trunk || fail "the renumbered ADR should pass"
git checkout -q trunk && git reset -q --hard HEAD~1
pass "accepts the renumbered ADR"

# Rejects an existing ADR renamed to a new number that is not the next one.
feature
git rm -q docs/adr/0001-first.md
file 0009 first
sed -i.bak 's/0001/0009/g' docs/adr/README.md && rm docs/adr/README.md.bak
commit rename
run trunk && fail "a renumbered old ADR should have failed"
out_has "0009-first.md: the next free number" || fail "expected the renamed file listed"
pass "rejects renumbering an existing ADR"

# Rejects an ADR that is missing from the index.
feature
file 0003 unlisted
commit unlisted
run && fail "an unlisted ADR should have failed"
out_has "does not list every ADR" || fail "expected the index message"
out_has "- \[0003. unlisted\](./0003-unlisted.md)" || fail "expected the missing line"
pass "rejects an ADR missing from the index"

# Rejects an index line whose title differs from the heading.
feature
file 0003 third
echo "- [0003. Something else](./0003-third.md)" >> docs/adr/README.md
commit title
run && fail "a wrong index title should have failed"
out_has "does not list every ADR" || fail "expected the index message"
pass "rejects an index title that differs from the heading"

# Rejects a file that has no number.
feature
echo "# NNNN. Draft" > docs/adr/draft-use-foo.md
commit draft
run && fail "an unnumbered file should have failed"
out_has "draft-use-foo.md: name an ADR" || fail "expected the naming message"
pass "rejects an unnumbered file"

# Rejects a heading that does not match the file name.
feature
echo "# 0005. wrong" > docs/adr/0003-wrong.md
commit heading
run && fail "a mismatched heading should have failed"
out_has "must start with '# 0003. '" || fail "expected the heading message"
pass "rejects a mismatched heading"

# Rejects a duplicate number.
feature
adr 0002 other
commit dupe
run && fail "a duplicate should have failed"
out_has "Duplicate ADR numbers in docs/adr: 0002" || fail "expected the duplicate message"
pass "rejects a duplicate number"

# Passes a branch that predates a change to the folder and touches no ADR.
git checkout -q -f trunk && git clean -qfd
echo "# NNNN. Old" > docs/adr/draft-old.md
commit "old layout"
git checkout -q -B stale
echo x > unrelated.txt
commit unrelated
git checkout -q trunk
git rm -q docs/adr/draft-old.md
adr 0003 old
commit "new layout"
git checkout -q stale
run && fail "the old layout should fail without a base"
run trunk || fail "a stale branch with no ADR change should pass"
out_has "No ADR changes since trunk" || fail "expected the no-change message"
echo edit >> docs/adr/0001-first.md
run trunk && fail "a stale branch that edits an ADR should be checked"
git checkout -q -f trunk && git reset -q --hard HEAD~2
pass "skips a branch with no ADR change"

# Rejects an unknown flag.
run --nope && fail "an unknown flag should have failed"
out_has "Usage" || fail "expected usage"
pass "rejects an unknown flag"

echo "All tests passed."
