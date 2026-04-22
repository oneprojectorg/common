#!/bin/bash
# Block any gh CLI commands that target the main branch
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check that gh is actually a command being invoked (not part of a filename/path)
# and that main appears as a standalone word (not inside a path or string)
if echo "$COMMAND" | grep -qE '(^|[;|&(]\s*|^\s*)gh\s' && echo "$COMMAND" | grep -qE '(^|\s)main(\s|$)'; then
  echo "BLOCKED: gh commands targeting 'main' branch are not allowed. Use 'dev' instead." >&2
  exit 2
fi

exit 0
