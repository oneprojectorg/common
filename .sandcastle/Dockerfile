# syntax=docker/dockerfile:1.4
FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  ca-certificates \
  gnupg \
  lsb-release \
  && rm -rf /var/lib/apt/lists/*

# Install the Docker CLI (client only — no daemon). The sandbox talks to a
# DinD sidecar started by .sandcastle/main.ts via DOCKER_HOST=tcp://127.0.0.1:2375,
# which gives integration tests a working `supabase start` without privileged.
RUN install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
       > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y docker-ce-cli docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

# Install the Supabase CLI. Used by `pnpm w:api test:supabase:start` to bring
# up the test-only Supabase stack (Postgres on 55322, Kong on 55321, etc.) so
# vitest's globalSetup can run migrations.
RUN ARCH="$(dpkg --print-architecture)" \
  && curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_linux_${ARCH}.tar.gz" \
       | tar -xz -C /usr/local/bin supabase \
  && chmod +x /usr/local/bin/supabase

# Chromium system dependencies for Playwright. The reviewer's QA prompt drives
# UI verification via the Playwright MCP server (configured per-sandbox by the
# orchestrator), which launches a headless Chromium inside this container.
RUN apt-get update && apt-get install -y \
  libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
  libx11-6 libxext6 libxcb1 fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack so pnpm is resolved from the workspace's package.json
# (packageManager field) at runtime — always the correct version.
RUN corepack enable

# Install bun. Required by the vendored gstack at .claude/skills/gstack/ —
# the linux/amd64 versions of the bun-compiled binaries (browse, design,
# find-browse, gstack-global-discover) are rebuilt the first time a sandbox
# starts (see .sandcastle/main.ts → issueHooks → bun-build hook).
RUN curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun \
  && chmod -R a+rX /root/.bun

# Install the OpenAI codex CLI. Required by gstack's /codex skill, which
# is invoked from the reviewer prompt for an independent second opinion.
# Soft dependency: the skill checks for OPENAI_API_KEY at runtime and
# degrades gracefully if not configured.
RUN npm install -g @openai/codex

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
    section=""; type_filter=""; assignee=""; include_comments=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --section)          section="$2";       shift 2 ;;
        --type)             type_filter="$2";   shift 2 ;;
        --assignee)         assignee="$2";      shift 2 ;;
        --include-comments) include_comments=1; shift   ;;
        *) echo "sandcastle-asana list: unknown arg $1" >&2; exit 2 ;;
      esac
    done
    [[ -z "$section" ]] && { echo "sandcastle-asana list: --section <gid> required" >&2; exit 2; }
    if [[ "$assignee" == "me" ]]; then
      assignee=$(call GET "/users/me" | jq -r '.data.gid')
    fi
    # The "Type" custom field is multi_enum; we project its values into a
    # `type` array on each task so callers can filter without knowing the
    # custom field gid. Asana tags are returned as `tags` for context.
    raw=$(call GET "/sections/${section}/tasks?completed_since=now&limit=100&opt_fields=gid,name,notes,tags.name,assignee.gid,custom_fields.name,custom_fields.multi_enum_values.name,custom_fields.enum_value.name")
    if [[ "$(printf '%s' "$raw" | jq -r '.next_page // empty')" != "" ]]; then
      echo "sandcastle-asana list: warning — section has more than 100 incomplete tasks; results truncated" >&2
    fi
    filtered=$(printf '%s' "$raw" | jq --arg type "$type_filter" --arg assignee "$assignee" '
      [.data[]
        | {
            id: .gid,
            name: .name,
            notes: (.notes // ""),
            tags: [.tags[].name],
            assignee: (.assignee.gid // ""),
            type: [
              .custom_fields[]?
              | select(.name == "Type")
              | ((.multi_enum_values // []) | map(.name))
              + (if .enum_value then [.enum_value.name] else [] end)
              | .[]
            ]
          }
        | select($type == "" or (.type | index($type)))
        | select($assignee == "" or .assignee == $assignee)
      ]')
    if [[ -z "$include_comments" ]]; then
      printf '%s' "$filtered"
    else
      # Per-task /stories fetch (N+1). Filter has already trimmed N.
      enriched=$(printf '%s' "$filtered" | jq -c '.[]' | while IFS= read -r task; do
        gid=$(printf '%s' "$task" | jq -r '.id')
        stories=$(call GET "/tasks/${gid}/stories?opt_fields=created_at,created_by.name,text,type")
        comments=$(printf '%s' "$stories" | jq '[.data[]
          | select(.type == "comment")
          | {at: .created_at, by: (.created_by.name // "unknown"), text: .text}]')
        printf '%s' "$task" | jq --argjson c "$comments" '. + {comments: $c}'
      done | jq -s '.')
      printf '%s' "$enriched"
    fi
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
  claim)
    gid="${1:-}"; shift || true
    agent_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --agent-id) agent_id="$2"; shift 2 ;;
        *) echo "sandcastle-asana claim: unknown arg $1" >&2; exit 2 ;;
      esac
    done
    [[ -z "$gid"      ]] && { echo "sandcastle-asana claim: <task_gid> required"      >&2; exit 2; }
    [[ -z "$agent_id" ]] && { echo "sandcastle-asana claim: --agent-id <uuid> required" >&2; exit 2; }
    current_notes=$(call GET "/tasks/${gid}?opt_fields=notes" | jq -r '.data.notes // ""')
    trimmed=$(printf '%s' "$current_notes" | sed -E 's/[[:space:]]+$//')
    if [[ -z "$trimmed" ]]; then
      new_notes="Claimed by: ${agent_id}"
    else
      new_notes="${trimmed}

Claimed by: ${agent_id}"
    fi
    payload=$(jq -nc --arg n "$new_notes" '{data:{notes:$n}}')
    call PUT "/tasks/${gid}" "$payload" >/dev/null
    echo "Claimed task $gid as $agent_id"
    ;;
  verify-claim)
    gid="${1:-}"; shift || true
    agent_id=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --agent-id) agent_id="$2"; shift 2 ;;
        *) echo "sandcastle-asana verify-claim: unknown arg $1" >&2; exit 2 ;;
      esac
    done
    [[ -z "$gid"      ]] && { echo "sandcastle-asana verify-claim: <task_gid> required"      >&2; exit 2; }
    [[ -z "$agent_id" ]] && { echo "sandcastle-asana verify-claim: --agent-id <uuid> required" >&2; exit 2; }
    current_notes=$(call GET "/tasks/${gid}?opt_fields=notes" | jq -r '.data.notes // ""')
    expected="Claimed by: ${agent_id}"
    last_line=$(printf '%s\n' "$current_notes" | awk 'NF{p=$0} END{print p}')
    if [[ "$last_line" == "$expected" ]]; then
      echo "Verified claim on $gid for $agent_id"
      exit 0
    fi
    echo "sandcastle-asana verify-claim: claim mismatch on $gid" >&2
    echo "  last line: ${last_line}" >&2
    echo "  expected:  ${expected}"  >&2
    exit 1
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
  sandcastle-asana list  --section <section_gid> [--type <name>] [--assignee me|<user_gid>] [--include-comments]
  sandcastle-asana view  <task_gid>
  sandcastle-asana claim <task_gid> --agent-id <uuid>
  sandcastle-asana verify-claim <task_gid> --agent-id <uuid>
  sandcastle-asana move  <task_gid> --section <section_gid> [--comment "..."]
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

# Pre-install Chrome-for-Testing for the Playwright MCP server. The reviewer's
# QA prompt drives UI verification by spawning `npx @playwright/mcp` inside
# this container, which (with `--browser chromium`) launches the
# chrome-for-testing build distributed by the same `@playwright/mcp` package.
# Pre-installing avoids a 200MB+ download on first agent invocation.
RUN npx --yes @playwright/mcp@latest install-browser chrome-for-testing

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
