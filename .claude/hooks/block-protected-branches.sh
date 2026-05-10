#!/bin/bash
# Block git/gh commands that write to protected branches (main, dev),
# perform force pushes, or run destructive operations.
#
# Allowed:
#   - `gh pr create --base dev`  — normal feature → dev PR
#   - read-only inspection of dev/main only when prefixed with the
#     `/release`-marker (`CLAUDE_RELEASE=1`)
#   - `gh pr create --base main` only under the `/release` marker
#
# Always denied (no marker bypass):
#   - `git push` targeting main/dev (incl. force-push)
#   - destructive ops (`reset --hard`, `clean -f`, `branch -D`, `checkout --`)
#
# Wired as a PreToolUse hook in .claude/settings.json.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# git or gh invoked at start of line, or after a shell separator (; | & ()
INVOKES_GIT_GH='(^|[;|&(]\s*)(git|gh)\s'

# A protected branch ("main" or "dev") as a standalone ref token. Trailing
# boundary also includes git ref suffix chars (. ~ ^ @) so ranges like
# main...HEAD and dev~5 match.
# Catches: main, dev, origin/main, --base dev, refs/heads/main,
# main:refs/heads/x, dev...HEAD, main~5, dev^, main@{upstream}.
# Not matched: domain, maintain, develop, development, devops.
REFERENCES_PROTECTED='(^|[[:space:]=:/])(main|dev)([[:space:]=:/.~^@]|$)'

# /release marker. Prefixed on the read + PR-create commands inside the
# /release command so the hook lets them through.
RELEASE_MARKER='(^|[[:space:]])CLAUDE_RELEASE=1([[:space:]=]|$)'

# `gh pr create` targeting a protected branch as the PR base.
GH_PR_CREATE_BASE_MAIN='gh\s+pr\s+create\s+(.*\s)?--base[[:space:]=]main(\s|$)'
GH_PR_CREATE_BASE_DEV='gh\s+pr\s+create\s+(.*\s)?--base[[:space:]=]dev(\s|$)'

DESTRUCTIVE_RESET='git\s+reset\s+(--hard|-{1,2}H)'
DESTRUCTIVE_CLEAN='git\s+clean\s+(-[a-zA-Z]*f|--force)'
DESTRUCTIVE_BRANCH_D='git\s+branch\s+(-[a-zA-Z]*D)'
DESTRUCTIVE_CHECKOUT='git\s+checkout\s+(--|\.[[:space:]]|\.[[:space:]]*$)'

# Destructive ops are never allowed, even under /release.
if echo "$COMMAND" | grep -qE "$DESTRUCTIVE_RESET|$DESTRUCTIVE_CLEAN|$DESTRUCTIVE_BRANCH_D|$DESTRUCTIVE_CHECKOUT"; then
  echo "BLOCKED: destructive git operation (reset --hard, clean -f, branch -D, checkout --). Ask the user before running this." >&2
  exit 2
fi

# Pushes targeting main/dev are never allowed, even under /release.
if echo "$COMMAND" | grep -qE 'git\s+push' && echo "$COMMAND" | grep -qE "$REFERENCES_PROTECTED"; then
  echo "BLOCKED: pushing to 'main' or 'dev' is never allowed. Open a PR from a feature branch." >&2
  exit 2
fi

# `gh pr create --base main` is the dev → main release PR — only under the
# /release marker. We check this before the generic protected-ref block so
# the marker can let it through.
if echo "$COMMAND" | grep -qE "$GH_PR_CREATE_BASE_MAIN"; then
  if echo "$COMMAND" | grep -qE "$RELEASE_MARKER"; then
    exit 0
  fi
  echo "BLOCKED: 'gh pr create --base main' is only allowed inside the /release flow (prefix with CLAUDE_RELEASE=1)." >&2
  exit 2
fi

# `gh pr create --base dev` is the normal feature → dev PR. Always allowed.
if echo "$COMMAND" | grep -qE "$GH_PR_CREATE_BASE_DEV"; then
  exit 0
fi

# Generic protected-branch reference block (catches `git fetch origin dev`,
# `git log main..feature`, etc.), with /release exception.
if echo "$COMMAND" | grep -qE "$INVOKES_GIT_GH" && echo "$COMMAND" | grep -qE "$REFERENCES_PROTECTED"; then
  if echo "$COMMAND" | grep -qE "$RELEASE_MARKER"; then
    exit 0
  fi
  echo "BLOCKED: git/gh commands targeting 'main' or 'dev' are not allowed. Work on a feature branch and open a PR. (The /release command is the only exception, via the CLAUDE_RELEASE=1 marker.)" >&2
  exit 2
fi

exit 0
