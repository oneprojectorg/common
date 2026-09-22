#!/usr/bin/env bash
# Exercises number-adrs.sh against a bare remote in a temporary directory.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/number-adrs.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

fail() { echo "FAIL: $*" >&2; cat "$TMP/out" >&2 2>/dev/null || true; exit 1; }
pass() { echo "ok: $*"; }

git init -q --bare "$TMP/remote.git"
git clone -q "$TMP/remote.git" "$TMP/work" 2>/dev/null
cd "$TMP/work"
git checkout -q -b trunk
mkdir -p docs/adr scripts
cp "$SCRIPT" scripts/number-adrs.sh
printf '# NNNN. {short title}\n\n## Status\n\nAccepted\n' > docs/adr/adr-template.md
numbered() { printf '# %s. %s\n' "$1" "$2" > "docs/adr/$1-$3.md"; }
draft() { sed "s/{short title}/$2/" docs/adr/adr-template.md > "docs/adr/draft-$1.md"; }
numbered 0001 First first
numbered 0002 Second second
draft use-foo "Use foo"
git add -A && git commit -qm init && git push -q -u origin trunk

git clone -q "$TMP/remote.git" "$TMP/other" 2>/dev/null
git -C "$TMP/other" checkout -q trunk
other() { (cd "$TMP/other" && git pull -q --rebase && "$@" && git add -A && git commit -qm "someone else" && git push -q); }
run() { scripts/number-adrs.sh "$@" > "$TMP/out" 2>&1; }
out_has() { grep -q "$1" "$TMP/out"; }
remote_has() { [[ -n $(git ls-tree --name-only origin/trunk "docs/adr/$1") ]]; }
remote_heading() { git show "origin/trunk:docs/adr/$1" | head -1; }

# Numbers a draft, rewrites its heading, and pushes.
run --push || fail "push"
remote_has 0003-use-foo.md || fail "0003-use-foo.md not on remote"
[[ $(remote_heading 0003-use-foo.md) == "# 0003. Use foo" ]] || fail "heading not rewritten"
pass "numbers, rewrites the heading, pushes"

# Retries after an unrelated commit lands first.
draft race Race && git add -A && git commit -qm "draft" && git push -q
other sh -c 'echo x > unrelated.txt'
run --push || fail "push after unrelated commit"
remote_has 0004-race.md || fail "0004-race.md not on remote"
[[ -n $(git ls-tree --name-only origin/trunk unrelated.txt) ]] || fail "unrelated commit lost"
pass "retries when the branch moved"

# Skips a number claimed by hand while the run was in flight.
git pull -q --rebase
draft window Window && git add -A && git commit -qm "draft" && git push -q
other sh -c 'printf "# 0005. By hand\n" > docs/adr/0005-by-hand.md'
run --push || fail "push after hand-numbered ADR"
{ remote_has 0005-by-hand.md && remote_has 0006-window.md; } || fail "collision not avoided"
[[ $(remote_heading 0006-window.md) == "# 0006. Window" ]] || fail "heading after renumber"
[[ -z $(git status --porcelain) ]] || fail "tree dirty after retry"
pass "renumbers past a number claimed in the window"

# Exits cleanly when the remote already numbered the draft.
git pull -q --rebase
draft upstream Upstream && git add -A && git commit -qm "draft" && git push -q
other git mv docs/adr/draft-upstream.md docs/adr/0007-upstream.md
run --push || fail "push when already numbered upstream"
out_has "No draft ADRs" || fail "expected no-op message"
remote_has 0008-upstream.md && fail "numbered twice"
pass "no-op when the draft was numbered upstream"

# Fails fast when the push is refused and the branch did not move.
git pull -q --rebase
draft blocked Blocked && git add -A && git commit -qm "draft" && git push -q
printf '#!/bin/sh\nexit 1\n' > "$TMP/remote.git/hooks/pre-receive"
chmod +x "$TMP/remote.git/hooks/pre-receive"
run --push && fail "push should have failed"
out_has "has not moved" || fail "expected fail-fast message"
[[ $(git rev-list --count origin/trunk..HEAD) -eq 1 ]] || fail "expected one local commit"
rm "$TMP/remote.git/hooks/pre-receive"
git reset -q --hard origin/trunk
run --push || fail "push after hook removed"
pass "fails fast on a refused push"

# Refuses to run on a duplicate number.
numbered 0008 Other other && git add -A && git commit -qm "dupe"
run --push && fail "duplicate should have failed"
out_has "Duplicate ADR numbers" || fail "expected duplicate message"
git reset -q --hard HEAD~1
pass "refuses a duplicate number"

# Refuses --push on a dirty tree.
echo junk > junk.txt
run --push && fail "dirty tree should have failed"
out_has "must be clean" || fail "expected dirty-tree message"
rm junk.txt
pass "refuses a dirty tree"

# --check rejects a numbered ADR added by hand, allows drafts and edits.
git checkout -q -b feature
numbered 0009 "By hand" by-hand
echo edit >> docs/adr/0001-first.md
draft fine Fine
git add -A && git commit -qm "hand numbered"
run --check origin/trunk && fail "hand-numbered ADR should have failed"
out_has "0009-by-hand.md" || fail "expected the hand-numbered file listed"
git rm -q docs/adr/0009-by-hand.md && git commit -qm "drop"
run --check origin/trunk || fail "draft plus edit should pass"
git show origin/trunk:scripts/number-adrs.sh | bash -s -- --check origin/trunk > "$TMP/out" 2>&1 || fail "run from stdin"
git checkout -q trunk
pass "--check rejects hand numbering only"

# Refuses --push on a detached HEAD.
git checkout -q --detach
run --push && fail "detached HEAD should have failed"
out_has "detached" || fail "expected detached message"
git checkout -q trunk
pass "refuses a detached HEAD"

# Rejects an unknown flag.
run --nope && fail "unknown flag should have failed"
out_has "Usage" || fail "expected usage"
pass "rejects an unknown flag"

# Previews an untracked draft locally without pushing.
draft preview Preview
run || fail "preview"
[[ $(git diff --cached --name-only) == "docs/adr/0009-preview.md" ]] || fail "preview not staged"
[[ $(head -1 docs/adr/0009-preview.md) == "# 0009. Preview" ]] || fail "preview heading"
[[ $(git rev-list --count origin/trunk..HEAD) -eq 0 ]] || fail "preview committed"
pass "previews an untracked draft"

echo "All tests passed."
