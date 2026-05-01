# syntax=docker/dockerfile:1.4
FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack so pnpm is resolved from the workspace's package.json
# (packageManager field) at runtime — always the correct version.
RUN corepack enable

# Bake .sandcastle/.env into the image so sandcastle-asana works regardless of
# whether the invoking shell inherits container env vars (prompt shell
# substitution, Claude Code's bash tool, etc.).
COPY .env /etc/sandcastle-asana.env

# Install sandcastle-asana — a curl-based wrapper for Asana's REST API,
# bundled by Sandcastle (NOT an external CLI). Source lives in
# src/InitService.ts (SANDCASTLE_ASANA_SCRIPT). Requires curl + jq from the
# base image.
RUN <<"SANDCASTLE_ASANA_INSTALL" bash
cat > /usr/local/bin/sandcastle-asana <<'SANDCASTLE_ASANA_SCRIPT_EOF'
#!/usr/bin/env bash
# sandcastle-asana — minimal Asana REST wrapper bundled by Sandcastle.
# Wraps curl + jq calls to https://app.asana.com/api/1.0/.
# Authenticated via $ASANA_PERSONAL_ACCESS_TOKEN.
set -euo pipefail

# Load credentials from the baked-in env file when not already in env.
# Required because the script may be invoked from contexts that don't
# inherit container env vars.
if [[ -r /etc/sandcastle-asana.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/sandcastle-asana.env
  set +a
fi

API="https://app.asana.com/api/1.0"

if [[ -z "${ASANA_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  echo "sandcastle-asana: ASANA_PERSONAL_ACCESS_TOKEN is not set" >&2
  exit 2
fi

# call <method> <path> [data]
call() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-sS --fail-with-body
    -H "Authorization: Bearer ${ASANA_PERSONAL_ACCESS_TOKEN}"
    -H "Accept: application/json"
    -X "$method" "${API}${path}")
  if [[ -n "$data" ]]; then
    args+=(-H "Content-Type: application/json" --data "$data")
  fi
  local body
  if ! body=$(curl "${args[@]}" 2>&1); then
    echo "sandcastle-asana: request failed: $body" >&2
    exit 1
  fi
  printf '%s' "$body"
}

cmd="${1:-}"; shift || true

case "$cmd" in
  list)
    section=""; tag=""; assignee=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --section)  section="$2";  shift 2 ;;
        --tag)      tag="$2";      shift 2 ;;
        --assignee) assignee="$2"; shift 2 ;;
        *) echo "sandcastle-asana list: unknown arg $1" >&2; exit 2 ;;
      esac
    done
    [[ -z "$section" ]] && { echo "sandcastle-asana list: --section <gid> required" >&2; exit 2; }
    if [[ "$assignee" == "me" ]]; then
      assignee=$(call GET "/users/me" | jq -r '.data.gid')
    fi
    raw=$(call GET "/sections/${section}/tasks?completed_since=now&limit=100&opt_fields=gid,name,notes,tags.name,assignee.gid")
    if [[ "$(printf '%s' "$raw" | jq -r '.next_page // empty')" != "" ]]; then
      echo "sandcastle-asana list: warning — section has more than 100 incomplete tasks; results truncated" >&2
    fi
    printf '%s' "$raw" | jq --arg tag "$tag" --arg assignee "$assignee" '
      [.data[]
        | {id: .gid, name: .name, notes: (.notes // ""), tags: [.tags[].name], assignee: (.assignee.gid // "")}
        | select($tag == "" or (.tags | index($tag)))
        | select($assignee == "" or .assignee == $assignee)
      ]'
    ;;
  view)
    gid="${1:-}"
    [[ -z "$gid" ]] && { echo "sandcastle-asana view: <task_gid> required" >&2; exit 2; }
    raw=$(call GET "/tasks/${gid}?opt_fields=gid,name,notes,completed,assignee.name,tags.name,permalink_url,created_at,modified_at")
    printf '%s' "$raw" | jq -r '.data | "Task: \(.name)\nURL:  \(.permalink_url // "n/a")\nID:   \(.gid)\nStatus: \(if .completed then "completed" else "open" end)\nAssignee: \(.assignee.name // "unassigned")\nTags: \([.tags[].name] | join(", "))\nCreated: \(.created_at)\nModified: \(.modified_at)\n\n\(.notes // "(no description)")"'
    stories=$(call GET "/tasks/${gid}/stories?opt_fields=gid,created_at,created_by.name,text,type")
    printf '\n--\n'
    printf '%s' "$stories" | jq -r '.data | map(select(.type == "comment")) | if length == 0 then "(no comments)" else map("[\(.created_at)] \(.created_by.name // "unknown"): \(.text)") | join("\n\n") end'
    ;;
  move)
    gid="${1:-}"; shift || true
    section=""; comment=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --section) section="$2"; shift 2 ;;
        --comment) comment="$2"; shift 2 ;;
        *) echo "sandcastle-asana move: unknown arg $1" >&2; exit 2 ;;
      esac
    done
    [[ -z "$gid"     ]] && { echo "sandcastle-asana move: <task_gid> required"      >&2; exit 2; }
    [[ -z "$section" ]] && { echo "sandcastle-asana move: --section <gid> required" >&2; exit 2; }
    payload=$(jq -nc --arg t "$gid" '{data:{task:$t}}')
    call POST "/sections/${section}/addTask" "$payload" >/dev/null
    if [[ -n "$comment" ]]; then
      cpayload=$(jq -nc --arg t "$comment" '{data:{text:$t}}')
      call POST "/tasks/${gid}/stories" "$cpayload" >/dev/null
    fi
    echo "Moved task $gid to section $section"
    ;;
  close)
    gid="${1:-}"; shift || true
    comment=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --comment) comment="$2"; shift 2 ;;
        *) echo "sandcastle-asana close: unknown arg $1" >&2; exit 2 ;;
      esac
    done
    [[ -z "$gid" ]] && { echo "sandcastle-asana close: <task_gid> required" >&2; exit 2; }
    if [[ -n "$comment" ]]; then
      payload=$(jq -nc --arg t "$comment" '{data:{text:$t}}')
      call POST "/tasks/${gid}/stories" "$payload" >/dev/null
    fi
    call PUT "/tasks/${gid}" '{"data":{"completed":true}}' >/dev/null
    echo "Closed task $gid"
    ;;
  ""|-h|--help|help)
    cat <<'USAGE'
Usage:
  sandcastle-asana list --section <section_gid> [--tag <name>] [--assignee me|<user_gid>]
  sandcastle-asana view <task_gid>
  sandcastle-asana move <task_gid> --section <section_gid> [--comment "..."]
  sandcastle-asana close <task_gid> [--comment "..."]
USAGE
    [[ "$cmd" == "" ]] && exit 2 || exit 0
    ;;
  *)
    echo "sandcastle-asana: unknown command '$cmd'" >&2
    exit 2
    ;;
esac
SANDCASTLE_ASANA_SCRIPT_EOF
chmod +x /usr/local/bin/sandcastle-asana
SANDCASTLE_ASANA_INSTALL

# Install GitHub CLI for PR creation. Adds GitHub's apt repo and installs gh.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Configure git's HTTPS credential helper to read GH_TOKEN from the baked-in
# env file. The helper is a shell function that sources the file each call,
# so it works regardless of whether the invoking process inherits container
# env vars.
RUN git config --system credential.https://github.com.helper \
  '!f(){ . /etc/sandcastle-asana.env; echo "username=x-access-token"; echo "password=$GH_TOKEN"; }; f'

# Rename the base image's "node" user (UID 1000) to "agent".
# This keeps UID 1000 so that --userns=keep-id (Podman) and
# --user 1000:1000 (Docker) map to the correct home directory owner.
RUN usermod -d /home/agent -m -l agent node
USER agent

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH
ENV PATH="/home/agent/.local/bin:$PATH"
USER root
RUN chmod -R a+rwX /home/agent
USER agent
WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
