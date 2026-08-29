#!/bin/bash
# PreToolUse Bash hook: blocks mutating git commands that target protected
# branches ('main', 'dev'). Allows read-only operations (log, diff, status,
# checkout, etc.) and mutations on feature branches.

COMMAND=$(jq -r '.tool_input.command // empty')

# Catches: main, origin/main, --base main, --base=main, refs/heads/main.
# Not matched: domain, maintain, main-repo, develop, devtools.
REFERENCES_PROTECTED='(^|[[:space:]=:/])(main|dev)([[:space:]=:/.~^@]|$)'

# Mutating subcommands that write to a branch ref:
# - git push              (writes to remote branch)
# - git branch -d/-D/-f/-m/-M/--delete/--force/--move   (modifies local ref)
# - git push --delete     (covered by git push match)
MUTATING_PUSH='(^|[;|&(]\s*)git[[:space:]]+push\b'
MUTATING_BRANCH='(^|[;|&(]\s*)git[[:space:]]+branch[[:space:]]+(-[dDfmM]|--delete|--force|--move)\b'

if echo "$COMMAND" | grep -qE "$REFERENCES_PROTECTED"; then
  if echo "$COMMAND" | grep -qE "$MUTATING_PUSH" || echo "$COMMAND" | grep -qE "$MUTATING_BRANCH"; then
    echo "BLOCKED: mutating git commands targeting protected branches ('main', 'dev') are not allowed. Use a feature branch and open a PR." >&2
    exit 2
  fi
fi

exit 0
