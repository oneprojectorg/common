#!/bin/bash
# Block any git or gh command that references the main branch.
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# git or gh invoked at start of line, or after a shell separator (; | & ()
INVOKES_GIT_GH='(^|[;|&(]\s*)(git|gh)\s'

# "main" as a standalone ref token. Trailing boundary also includes git ref
# suffix chars (. ~ ^ @) so ranges like main...HEAD and main~5 match.
# Catches: main, origin/main, --base main, --base=main, refs/heads/main,
# main:refs/heads/x, main...HEAD, main~5, main^, main@{upstream}.
# Not matched: domain, maintain, main-repo.
REFERENCES_MAIN='(^|[[:space:]=:/])main([[:space:]=:/.~^@]|$)'

if echo "$COMMAND" | grep -qE "$INVOKES_GIT_GH" && echo "$COMMAND" | grep -qE "$REFERENCES_MAIN"; then
  echo "BLOCKED: git/gh commands targeting 'main' branch are not allowed. Use 'dev' instead." >&2
  exit 2
fi

exit 0
