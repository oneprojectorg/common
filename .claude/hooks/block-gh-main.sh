#!/bin/bash
# Block any git or gh command that references the main branch.
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# git or gh invoked at start of line, or after a shell separator
# (; | & ( ` — covers chains, pipes, subshells, and command substitution).
INVOKES_GIT_GH='(^|[;|&(`]\s*)(git|gh)\s'

# "main" as a standalone ref token. Boundary classes also accept shell
# quoting / subshell / separator chars so the ref token still matches
# inside $(...), `...`, "...", '...', and command lists.
# Catches: main, origin/main, --base main, --base=main, refs/heads/main,
# main:refs/heads/x, main...HEAD, main~5, main^, main@{upstream},
# $(git rev-parse main), `git rev-parse main`, "main", 'main',
# git push origin main; echo done, ... main && ..., ... main | ...
# Not matched: domain, maintain, main-repo.
REFERENCES_MAIN=$'(^|[[:space:]=:/(\'"`])main([[:space:]=:/.~^@)\'"`;&|]|$)'

if echo "$COMMAND" | grep -qE "$INVOKES_GIT_GH" && echo "$COMMAND" | grep -qE "$REFERENCES_MAIN"; then
  echo "BLOCKED: git/gh commands targeting 'main' branch are not allowed. Use 'dev' instead." >&2
  exit 2
fi

exit 0
