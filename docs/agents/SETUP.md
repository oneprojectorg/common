# Agent Setup

How to get a local Claude Code agent fully wired up against this repo. Works standalone or driven by any agent-orchestration platform that can shell out to the `claude` CLI.

## What you get

- Claude Code with the curated `.claude/skills/` (op-ui conventions, i18n, Drizzle, workspace shortcuts, branch/PR rules, Asana REST, Vercel React/Next.js performance, etc.).
- Pre-tool hooks that block `git`/`gh` against `main` or `dev`, force-push, destructive ops, and commits while on a protected branch.
- MCPs: Figma (design hand-off) and Playwright (browser testing).
- Asana access via plain REST + a Personal Access Token.
- The standard `docker:dev` stack on its usual ports (3100/3300). If a teammate or another agent already has those bound, pick a free `PORT_PREFIX` and run with it — see "Parallel agent stacks" below.

## One-time setup

### 1. Install Claude Code

Follow the install at https://docs.claude.com/claude-code. Run `claude --version` to confirm; log in once with `claude auth`.

### 2. (Optional) Install your orchestration platform's CLI / daemon

If you're driving Claude Code through an external orchestration platform (task board, scheduler, etc.), install its CLI and point it at your team's server per that tool's docs. The platform should auto-detect `claude` on your `PATH` and register it as a runtime. Skip this step if you're running Claude Code directly.

### 3. Create `.env.local`

```bash
cp .env.local.example .env.local
```

Fill in at minimum:

- `ASANA_API_KEY` — Personal Access Token from https://app.asana.com/0/my-apps.
- `ASANA_PROJECT_ID` — gid of the team's Asana task project (the trailing numeric segment of the project URL).
- `ASANA_BACKLOG_SECTION_ID`, `ASANA_IN_PROGRESS_SECTION_ID`, `ASANA_IN_REVIEW_SECTION_ID`, `ASANA_BLOCKED_SECTION_ID` — section gids inside `ASANA_PROJECT_ID`. Used by the `pickup-task` skill for the claim+move+verify flow and the failure path. Look them up once via `GET /projects/<gid>/sections`.
- The other values from the example file as needed for local dev.

### 4. Open Figma desktop (for the Figma MCP)

The Figma MCP listens at `http://127.0.0.1:3845/sse`. It's served by the Figma desktop app's Dev Mode. If Figma isn't open, the MCP fails silently — the agent will report it as unavailable.

### 5. Install dependencies + bring up the dev stack

```bash
pnpm install
pnpm docker:dev
```

App at http://localhost:3100, API at http://localhost:3300.

## Running an agent task

### Option A — drive Claude Code directly

```bash
cd <repo root>
claude
```

In the chat, you can:
- `list your skills` — confirm all 10 curated skills loaded.
- `pick up a task` — invokes the `pickup-task` skill, which lists Backlog tasks tagged `Type=Agent` assigned to you, claims one atomically, and starts work.
- `/fix-task <asana-url>` — pull a specific task by URL, plan it, and start work.
- `/plan <task description>` — plan workflow for a feature.

### Option B — let your orchestration platform assign work

On your platform's task board, assign a task to your runtime. The daemon spawns a Claude Code session in the repo (or a worktree, see below) and works the task autonomously.

## Parallel agent stacks

By default, just run `pnpm docker:dev` — it binds the standard ports (`3100`/`3300`). Only override when something else already has those ports.

If you need a second stack (e.g., a teammate is on `3100` already, or you're running two agents at once), set `PORT_PREFIX` and a Compose project name explicitly:

```bash
git worktree add ../common-2 -b feat/some-thing
cd ../common-2
pnpm install
PORT_PREFIX=55 COMPOSE_PROJECT_NAME=common-55 pnpm docker:dev
# app at http://localhost:5500, api at http://localhost:5501
```

Pick the smallest free 2-digit prefix you need — don't randomize, so stacks are easy to find and tear down (`COMPOSE_PROJECT_NAME=common-55 pnpm docker:down`).

## Smoke tests

Run these once to confirm everything is wired:

1. **Skills load:** `claude` → ask "list your skills". You should see all 10 in `.claude/skills/`.
2. **Branch hook:** ask Claude Code to run `git push origin dev`. It should be blocked. (`git push --force origin <feature-branch>` is allowed — needed after rebases.)
3. **Asana REST:** with `ASANA_API_KEY` + `ASANA_PROJECT_ID` set, ask Claude Code to list open tasks in our project. JSON should come back, not 401.
4. **Playwright MCP:** with `pnpm docker:dev` up, ask Claude Code to open `http://localhost:3100` in Playwright. The page should load.
5. **Parallel stack (only if needed):** in a separate worktree, `PORT_PREFIX=55 COMPOSE_PROJECT_NAME=common-55 pnpm docker:dev`, then visit `http://localhost:5500` — the app should be up independently of any other stack.

If a smoke test fails, check `.claude/settings.json` (permissions/sandbox), `.mcp.json` (Figma/Playwright wiring), or the hook scripts in `.claude/hooks/`.

## Where things live

| Path | Purpose |
|---|---|
| `.claude/skills/` | Curated repo-aware skills the agent loads automatically |
| `.claude/agents/` | Specialist subagents (database-optimizer, frontend-developer) |
| `.claude/commands/` | Slash commands (`/plan`, `/fix-task`, `/release`, …) |
| `.claude/hooks/` | Pre-tool guardrails |
| `.claude/settings.json` | Permission allow/deny + sandbox + hook wiring |
| `.mcp.json` | MCP server registry (Figma, Playwright) |
| `docs/agents/SETUP.md` | This file |

## Known gaps

- **No host-level isolation by default.** The agent runs on whatever host the daemon runs on. Mitigation: keep the daemon in a Docker-isolated env (or a dedicated VPS/microVM) and rely on `.claude/settings.json` sandbox for filesystem/network containment.
- **Figma MCP requires Figma desktop running.** No headless option today.
