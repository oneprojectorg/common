#!/bin/bash
# Refuse `git commit` while currently on `main` or `dev`.
# Wired as a PreToolUse hook in .claude/settings.json.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only act on `git commit` invocations.
if ! echo "$COMMAND" | grep -qE '(^|[;|&(]\s*)git\s+commit\b'; then
  exit 0
fi

CURRENT_BRANCH=$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "dev" ]; then
  echo "BLOCKED: you are on '$CURRENT_BRANCH'. Switch to a feature branch before committing." >&2
  exit 2
fi

exit 0
