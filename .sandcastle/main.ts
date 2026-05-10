// Parallel Planner with Review — four-phase orchestration loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import * as sandcastle from '@ai-hero/sandcastle';
import { hostSessionStore } from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Heartbeat: how long to sleep (seconds) between Asana polls when the backlog
// is empty. Cheap REST check — does NOT invoke Claude. Override with
// HEARTBEAT_INTERVAL_SECONDS in the environment.
const HEARTBEAT_INTERVAL_SECONDS = Number(
  process.env.HEARTBEAT_INTERVAL_SECONDS ?? 120,
);

// Maximum number of issues the planner may claim per iteration. Phase 2 runs
// these pipelines concurrently. Override with MAX_PARALLEL_ISSUES.
const MAX_PARALLEL_ISSUES = Number(process.env.MAX_PARALLEL_ISSUES ?? 2);

// Load .sandcastle/.env into process.env so the heartbeat can hit Asana
// without spinning up a sandbox. Existing process env wins; we only fill
// in unset keys.
const envPath = '.sandcastle/.env';
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) {
      process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
    }
  }
}

// ---------------------------------------------------------------------------
// Heartbeat — poll Asana for matching backlog tasks without invoking Claude
// ---------------------------------------------------------------------------

interface AsanaTask {
  gid: string;
  assignee: { gid: string } | null;
  custom_fields: Array<{
    name: string;
    multi_enum_values?: Array<{ name: string }> | null;
    enum_value?: { name: string } | null;
  }>;
}

async function asanaGet<T>(path: string): Promise<T> {
  const token = process.env.ASANA_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('ASANA_PERSONAL_ACCESS_TOKEN is not set');
  }
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(
      `Asana GET ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as T;
}

async function asanaPost<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.ASANA_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('ASANA_PERSONAL_ACCESS_TOKEN is not set');
  }
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Asana POST ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as T;
}

// Replace the `Claimed by: <...>` last line of a task's notes with
// `Claimed by: session:<sessionId>`. The planner stamps a random UUID
// as the initial claim (race-protection during the planner's claim+move
// window); after the implementer finishes its first run, we overwrite
// that with the actual Claude Code session ID so the next pickup of
// this task — whether after success-but-reviewer-failure, or just
// later cycles — can pass `resumeSession` to the implementer and
// continue Claude's prior context. The session JSONL lives at
// `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` and is
// preserved by sandcastle on the host. Best-effort: errors are
// logged, never thrown.
async function stampSessionClaim(
  taskId: string,
  sessionId: string,
): Promise<void> {
  try {
    const task = await asanaGet<{ data: { notes?: string } }>(
      `/tasks/${taskId}?opt_fields=notes`,
    );
    const notes = task.data.notes ?? '';
    // Drop a trailing "Claimed by: ..." line if present, then append
    // the session-prefixed claim. Mirrors the shell `claim` command
    // (Dockerfile) — keep behaviour aligned with `verify-claim` /
    // `get-claim` which read the LAST non-empty line.
    const lines = notes.split('\n');
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
      lines.pop();
    }
    if (
      lines.length > 0 &&
      lines[lines.length - 1]!.startsWith('Claimed by: ')
    ) {
      lines.pop();
    }
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
      lines.pop();
    }
    const newClaim = `Claimed by: session:${sessionId}`;
    const newNotes =
      lines.length === 0 ? newClaim : lines.join('\n') + '\n\n' + newClaim;
    await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.ASANA_PERSONAL_ACCESS_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { notes: newNotes } }),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`Asana PUT /tasks/${taskId} ${res.status}`);
      }
    });
    console.log(`  ◆ ${taskId} claim updated to session:${sessionId}`);
  } catch (err) {
    console.error(`  ! failed to stamp session claim on ${taskId}:`, err);
  }
}

// Move a stranded task back to Backlog so the next planner iteration can
// re-pick it. Used when the issue pipeline rejects (AgentIdleTimeoutError,
// network blip, sandbox crash, etc.) — without this, the task sits in
// In-Progress forever because the planner only queries the Backlog
// section. Best-effort: a failure here is logged but does not bubble.
async function requeueTaskToBacklog(
  taskId: string,
  reason: string,
): Promise<void> {
  const backlogId = process.env.ASANA_BACKLOG_SECTION_ID;
  if (!backlogId) {
    console.warn(
      `requeueTaskToBacklog(${taskId}): ASANA_BACKLOG_SECTION_ID not set; leaving task in In-Progress.`,
    );
    return;
  }
  try {
    await asanaPost(`/sections/${backlogId}/addTask`, {
      data: { task: taskId },
    });
    await asanaPost(`/tasks/${taskId}/stories`, {
      data: { text: `sandcastle: requeued to Backlog after failure — ${reason}` },
    });
    console.log(`  ↺ ${taskId} moved back to Backlog (${reason}).`);
  } catch (err) {
    console.error(`  ! failed to requeue ${taskId}:`, err);
  }
}

async function countMatchingBacklogTasks(): Promise<number> {
  const sectionId = process.env.ASANA_BACKLOG_SECTION_ID;
  if (!sectionId) {
    throw new Error('ASANA_BACKLOG_SECTION_ID is not set');
  }

  const me = await asanaGet<{ data: { gid: string } }>('/users/me');
  const myGid = me.data.gid;

  const fields = [
    'gid',
    'assignee.gid',
    'custom_fields.name',
    'custom_fields.multi_enum_values.name',
    'custom_fields.enum_value.name',
  ].join(',');
  const tasks = await asanaGet<{ data: AsanaTask[] }>(
    `/sections/${sectionId}/tasks?completed_since=now&limit=100&opt_fields=${fields}`,
  );

  return tasks.data.filter((task) => {
    if (task.assignee?.gid !== myGid) return false;
    const types = task.custom_fields
      .filter((cf) => cf.name === 'Type')
      .flatMap((cf) => [
        ...(cf.multi_enum_values ?? []).map((v) => v.name),
        ...(cf.enum_value ? [cf.enum_value.name] : []),
      ]);
    return types.includes('Agent');
  }).length;
}

async function waitForBacklog(): Promise<boolean> {
  // Returns true when there's work to do. Returns false if heartbeat is
  // disabled (HEARTBEAT_INTERVAL_SECONDS <= 0) and the backlog is empty —
  // the caller should exit the loop in that case.
  while (true) {
    const count = await countMatchingBacklogTasks();
    if (count > 0) {
      console.log(`Heartbeat: ${count} matching task(s) in backlog. Resuming.`);
      return true;
    }
    if (HEARTBEAT_INTERVAL_SECONDS <= 0) {
      console.log('Heartbeat disabled and backlog empty. Exiting.');
      return false;
    }
    console.log(
      `Heartbeat: no matching tasks. Sleeping ${HEARTBEAT_INTERVAL_SECONDS}s before re-polling.`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, HEARTBEAT_INTERVAL_SECONDS * 1000),
    );
  }
}

// Hooks run inside the sandbox before the agent starts each iteration.
// The disable-sandbox hook overrides .claude/settings.json (which enables
// Claude Code's bubblewrap sandbox for host-side use) — Docker is already
// providing isolation, and bwrap/socat aren't installed in the image.
// pnpm install ensures the sandbox always has fresh dependencies.
//
// `enabledMcpjsonServers: ["playwright"]` allowlists the playwright entry
// from `.mcp.json` so Claude Code starts it without the first-run approval
// prompt. We also overwrite `.mcp.json` in the worktree with a sandbox-only
// version that:
//   - drops figma-dev-mode (SSE to host's localhost:3845 — unreachable here)
//   - drops asana SSE (different auth surface; sandcastle-asana CLI is used)
//   - passes `--browser chromium` to @playwright/mcp so it uses the chromium
//     bundle pre-installed by the Dockerfile instead of looking for Chrome
const SETTINGS_LOCAL_JSON =
  '{"sandbox":{"enabled":false},"enabledMcpjsonServers":["playwright"]}';
const SANDBOX_MCP_JSON = JSON.stringify({
  mcpServers: {
    playwright: {
      type: 'stdio',
      command: 'npx',
      args: ['@playwright/mcp@latest', '--headless', '--browser', 'chromium'],
    },
  },
});
const writeSettingsLocal = {
  command:
    `mkdir -p .claude && printf '%s\\n' '${SETTINGS_LOCAL_JSON}' > .claude/settings.local.json && ` +
    `printf '%s\\n' '${SANDBOX_MCP_JSON}' > .mcp.json`,
};

// Configure the codex CLI to route through OpenRouter so gstack /review's
// Step 5.7 adversarial pass uses our team's gateway (and billing) rather
// than calling OpenAI directly. Codex's default `auth.json` flow only
// covers OpenAI; for any other OpenAI-compatible endpoint we register a
// `model_provider` in ~/.codex/config.toml that names an env var holding
// the API key. Codex reads OPENAI_API_KEY at request time — no
// `codex login` step is involved.
//
// We reuse the OPENAI_API_KEY name even though the endpoint is OpenRouter:
// the variable's value is the OpenRouter key, the codex provider config
// just points the wire to https://openrouter.ai/api/v1.
//
// The default model is overridable via OPENROUTER_CODEX_MODEL on the host
// (forwarded into the sandbox env). Pick a non-Claude model — the whole
// point of the codex pass is cross-family coverage that complements
// Claude's adversarial subagent.
//
// No-op when OPENAI_API_KEY isn't forwarded; /review then reports
// "Codex CLI not authed" and continues with Claude-only adversarial
// coverage.
const configureCodex = {
  command:
    'if [ -n "${OPENAI_API_KEY:-}" ]; then ' +
    'mkdir -p ~/.codex && ' +
    'cat > ~/.codex/config.toml <<EOF\n' +
    'model_provider = "openrouter"\n' +
    'model = "${OPENROUTER_CODEX_MODEL:-openai/gpt-5-codex}"\n' +
    '\n' +
    '[model_providers.openrouter]\n' +
    'name = "OpenRouter"\n' +
    'base_url = "https://openrouter.ai/api/v1"\n' +
    'env_key = "OPENAI_API_KEY"\n' +
    'wire_api = "chat"\n' +
    'EOF\n' +
    'echo "configureCodex: wrote ~/.codex/config.toml (model=${OPENROUTER_CODEX_MODEL:-openai/gpt-5-codex})"; ' +
    'else ' +
    'echo "configureCodex: OPENAI_API_KEY not set in sandbox env — codex adversarial pass will be skipped"; ' +
    'fi',
};

// Hooks for the planner and merger phases. Both run in temp worktrees
// (branchStrategy: merge-to-head, see the run() calls below) so the
// worktree starts as a fresh checkout with no node_modules.
//
// We deliberately skip `pnpm install` here:
//   - The planner only invokes `sandcastle-asana`, which is baked into
//     the Docker image at /usr/local/bin (see .sandcastle/Dockerfile).
//   - The merger is a no-op (see .sandcastle/merge-prompt.md).
// Adding `pnpm install` would burn ~1 min per planner heartbeat for no
// benefit. If either phase ever grows a need for node_modules, copy
// from the host via `copyToWorktree: ['node_modules', ...]` and
// re-add the install hook for platform-specific binaries.
const planHooks = {
  sandbox: {
    onSandboxReady: [writeSettingsLocal],
  },
};

// Implementer/reviewer/ship sandboxes additionally bring up the test Supabase
// stack so `pnpm test` works. The DinD sidecar (set up below) provides the
// docker daemon; `supabase start` spawns Postgres + Kong + GoTrue inside it.
// Wait-for-supabase loops until the API gateway is reachable so vitest's
// globalSetup can run migrations against a healthy stack.
const issueHooks = {
  sandbox: {
    onSandboxReady: [
      writeSettingsLocal,
      configureCodex,
      // `--force` is load-bearing: copyToWorktree below seeds the sandbox
      // with the host's macOS-arm64 node_modules, but the container is
      // linux-x64. Plain `pnpm install` sees the lockfile as satisfied
      // (`@turbo/cli-darwin-arm64` is present) and won't replace
      // platform-specific binaries — `pnpm typecheck`/`pnpm test` then
      // fail with "Turbo binary issue", and the agent has historically
      // rationalised that as an environment limitation and shipped the PR
      // anyway. `--force` reinstalls every package so the linux-x64
      // binaries land. 5-min ceiling because the first install on a fresh
      // store can take a couple minutes; subsequent runs are fast.
      { command: 'pnpm install --force', timeoutMs: 5 * 60 * 1000 },
      // The dind sidecar starts cold every sandbox, but its /var/lib/docker
      // is bind-mounted to a shared named volume (see startDindSidecar
      // below) so supabase image layers persist across runs. First time
      // that volume is populated → ~5-8min of pulls. Every run after →
      // ~30-60s of container starts. 10min ceiling absorbs the worst-case
      // cold-pull on a slow network.
      {
        command: 'pnpm w:api test:supabase:start',
        timeoutMs: 10 * 60 * 1000,
      },
    ],
  },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ['.env', '.env.local', 'node_modules'];

// ---------------------------------------------------------------------------
// DinD sidecar — one privileged docker:dind container per issue sandbox.
//
// Sandcastle's docker() provider doesn't expose --privileged, so we can't run
// dockerd inside the sandbox itself. Instead we start a sidecar dind container
// and have the sandbox join its network namespace (--network container:<id>).
// The sandbox then sees the sidecar's loopback as 127.0.0.1, so:
//   - DOCKER_HOST=tcp://127.0.0.1:2375 in the sandbox talks to the sidecar's
//     dockerd.
//   - `supabase start` spawns Postgres/Kong/etc. inside the sidecar; the ports
//     they expose (55321/55322) are reachable from vitest at 127.0.0.1.
// Each sandbox gets its own sidecar, so parallel agents don't collide.
// ---------------------------------------------------------------------------

interface SidecarHandle {
  readonly name: string;
  stop(): void;
}

function startDindSidecar(issueId: string): SidecarHandle {
  const name = `sandcastle-dind-${issueId}-${Date.now()}`;
  // Per-issue named volume for /var/lib/docker so a revision or retry of
  // the SAME issue reuses the layer cache it pulled the first time
  // (saves ~3GB of supabase image re-downloads on every retry). Issues
  // are sequenced (no two sandboxes share an issue ID concurrently), so
  // the volume only ever has one writer at a time — safe.
  //
  // Cross-issue caching needs a docker registry pull-through mirror;
  // mounting a single shared /var/lib/docker into parallel dind
  // sidecars corrupts dockerd's boltdb lock. NOT done here.
  const cacheVolume = `sandcastle-dind-cache-${issueId}`;
  // dind exposes its daemon on tcp://127.0.0.1:2375 with TLS disabled.
  // DOCKER_TLS_CERTDIR="" suppresses dind's auto-TLS bootstrap.
  execFileSync(
    'docker',
    [
      'run',
      '-d',
      '--rm',
      '--privileged',
      '--name',
      name,
      '-e',
      'DOCKER_TLS_CERTDIR=',
      '-v',
      `${cacheVolume}:/var/lib/docker`,
      'docker:27-dind',
    ],
    { stdio: 'pipe' },
  );

  // Wait for dockerd inside the sidecar to be ready — supabase start will
  // fail fast otherwise. Try `docker info` over TCP for up to ~30s.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      execFileSync(
        'docker',
        ['exec', name, 'docker', '-H', 'tcp://127.0.0.1:2375', 'info'],
        { stdio: 'ignore' },
      );
      return {
        name,
        stop() {
          try {
            execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
          } catch {
            /* best-effort cleanup */
          }
        },
      };
    } catch {
      // dockerd not ready yet
    }
  }
  try {
    execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  } catch {
    /* best-effort */
  }
  throw new Error(`DinD sidecar ${name} failed to become ready within 30s`);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // Heartbeat: block until at least one matching task is in the backlog.
  // Cheap REST poll — does NOT spend tokens on the planner agent.
  // Set HEARTBEAT_INTERVAL_SECONDS=0 to disable: the loop exits if empty.
  if (!(await waitForBacklog())) break;

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — we parse that to drive Phase 2.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks: planHooks,
    sandbox: docker({
      // Tell gstack skills they're spawned (non-interactive). The planner
      // doesn't currently invoke skills, but the symlink hook is shared
      // with issue sandboxes — this is cheap insurance against drift.
      env: { OPENCLAW_SESSION: '1' },
    }),
    // Without an explicit branchStrategy, sandcastle's docker provider
    // defaults to { type: "head" } — which BIND-MOUNTS the host repo
    // directory directly. The hooks then write to host files
    // (.mcp.json, .claude/settings.local.json) and `pnpm install` would
    // overwrite host node_modules with linux binaries. Force a temp
    // worktree so the planner stays sandboxed.
    branchStrategy: { type: 'merge-to-head' },
    name: 'planner',
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    // sandcastle defaults idleTimeoutSeconds=600 (10m). The planner
    // mostly reads + reasons, but a sandcastle-asana fetch over a slow
    // link or an opus reasoning stretch can blow past that. Bump to 15m.
    idleTimeoutSeconds: 15 * 60,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: sandcastle.claudeCode('claude-opus-4-6'),
    promptFile: './.sandcastle/plan-prompt.md',
    promptArgs: {
      MAX_PARALLEL_ISSUES: String(MAX_PARALLEL_ISSUES),
    },
  });

  // Extract the <plan>…</plan> block from the agent's stdout.
  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      'Planning agent did not produce a <plan> tag.\n\n' + plan.stdout,
    );
  }

  // The plan JSON contains an array of issues. Each issue carries
  // id/title/branch, and optionally `resumeSession` — a Claude Code
  // session ID stamped on the task by a previous run that the planner
  // detected via `sandcastle-asana get-claim`. Plumbed into the
  // implementer's `run()` so Claude continues from its prior session
  // instead of starting fresh.
  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: {
      id: string;
      title: string;
      branch: string;
      resumeSession?: string;
    }[];
  };

  if (issues.length === 0) {
    // The planner saw matching tasks but didn't claim one (race lost,
    // everything blocked, or zero unblocked). Don't burn an iteration —
    // heartbeat-wait and retry.
    console.log('Planner produced empty plan. Heartbeating before retry.');
    iteration--;
    continue;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if it produces commits, the reviewer runs in the same sandbox.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      // Privileged dind container that the sandbox will share a network
      // namespace with. Required for `supabase start` (and `docker:dev`).
      const dind = startDindSidecar(issue.id);

      let sandbox: sandcastle.Sandbox;
      try {
        sandbox = await sandcastle.createSandbox({
          branch: issue.branch,
          // Default baseBranch (HEAD) is the host's current branch — sandcastle
          // also exposes it to prompts as the {{TARGET_BRANCH}} built-in. The
          // implementer fetches and rebases against origin/<that branch> as
          // the first step, so we always pick up the latest.
          sandbox: docker({
            // Share the dind sidecar's network namespace: the sandbox's
            // 127.0.0.1 is now the sidecar's loopback, where supabase ports
            // will be exposed.
            network: `container:${dind.name}`,
            env: {
              // The Supabase CLI (and any docker invocation inside the
              // sandbox) hits the sidecar dockerd over TCP.
              DOCKER_HOST: 'tcp://127.0.0.1:2375',
              // Tell gstack skills they're running in a spawned (non-
              // interactive) session so they auto-pick recommended options
              // instead of deadlocking on AskUserQuestion gates.
              OPENCLAW_SESSION: '1',
              // Forward the OpenRouter key (named OPENAI_API_KEY for
              // compatibility) so the reviewer's adversarial codex pass
              // (gstack /review Step 5.7) can authenticate. The
              // configureCodex hook reads this env var and writes
              // ~/.codex/config.toml so codex CLI hits OpenRouter rather
              // than OpenAI. OPENROUTER_CODEX_MODEL optionally overrides
              // the default model. If unset, the codex pass degrades
              // gracefully and /review continues with the Claude-only
              // adversarial subagent.
              ...(process.env.OPENAI_API_KEY
                ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
                : {}),
              ...(process.env.OPENROUTER_CODEX_MODEL
                ? { OPENROUTER_CODEX_MODEL: process.env.OPENROUTER_CODEX_MODEL }
                : {}),
            },
          }),
          hooks: issueHooks,
          copyToWorktree,
        });
      } catch (err) {
        dind.stop();
        throw err;
      }

      try {
        // Resolve `resumeSession` carefully. Sandcastle requires both
        // (a) the session JSONL to exist on the host, and (b)
        // `maxIterations === 1` when resuming (run.js:124). We honor (a)
        // by checking the file via hostSessionStore — if the task was
        // worked on a different host, the file is missing and we silently
        // fall back to a fresh run rather than throwing. We honor (b)
        // by setting maxIterations: 1 ONLY in the resume branch; fresh
        // runs keep the 100-iteration ceiling.
        let resumeSession: string | undefined;
        if (issue.resumeSession) {
          const sessionPath = hostSessionStore(process.cwd()).sessionFilePath(
            issue.resumeSession,
          );
          if (existsSync(sessionPath)) {
            resumeSession = issue.resumeSession;
            console.log(
              `  ↻ ${issue.id}: resuming session ${issue.resumeSession}`,
            );
          } else {
            console.warn(
              `  ! ${issue.id}: session ${issue.resumeSession} not found on host (${sessionPath}); starting fresh`,
            );
          }
        }

        // Run the implementer
        const implement = await sandbox.run({
          name: 'implementer',
          // Resume runs are single-iteration (sandcastle constraint —
          // multi-iteration resume semantics aren't supported); fresh
          // runs keep the 100-iteration RGR loop.
          maxIterations: resumeSession ? 1 : 100,
          // Default idleTimeoutSeconds is 600s. The implementer routinely
          // goes silent for longer than that during legitimate work:
          // writing large translation dictionaries (1k+ lines via Write),
          // `pnpm install --force` on a cold pnpm-store, `pnpm e2e`
          // (playwright + supabase stack), `/investigate` and `/autoplan`
          // skill runs that spawn their own subagents. A 10-minute idle
          // bound silently kills these mid-flight (see
          // .sandcastle/logs/issue-add-somali-translation-implementer.log
          // for the canonical case — agent timed out writing the Somali
          // dictionary). 30m gives every legitimate long-op room to
          // finish while still catching genuinely-stuck agents.
          idleTimeoutSeconds: 30 * 60,
          agent: sandcastle.claudeCode('claude-opus-4-6'),
          promptFile: './.sandcastle/implement-prompt.md',
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
          ...(resumeSession ? { resumeSession } : {}),
        });

        // Stamp the most-recent iteration's session ID onto the task
        // notes so a later pickup can resume. The orchestrator captures
        // session IDs per-iteration; we want the last successful one
        // (most recent agent context). Skipped on fresh-but-zero-iter
        // runs and in non-Claude providers (sessionId would be undefined).
        const lastSessionId = [...implement.iterations]
          .reverse()
          .find((it) => it.sessionId !== undefined)?.sessionId;
        if (lastSessionId) {
          await stampSessionClaim(issue.id, lastSessionId);
        }

        // Nothing to review or ship if the implementer made no commits.
        if (implement.commits.length === 0) {
          return implement;
        }

        // Reviewer: refines the implementer's work in-place.
        const review = await sandbox.run({
          name: 'reviewer',
          maxIterations: 1,
          // Same reasoning as implementer above — re-runs the full gate
          // suite (typecheck, test, e2e, fallow audit), spawns a
          // code-reviewer Task subagent (silent for minutes), runs /qa,
          // /cso, /review (which itself spawns adversarial subagents +
          // codex). 30m matches the implementer.
          idleTimeoutSeconds: 30 * 60,
          agent: sandcastle.claudeCode('claude-opus-4-6'),
          promptFile: './.sandcastle/review-prompt.md',
          promptArgs: {
            BRANCH: issue.branch,
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
          },
        });

        // Ship: pushes the branch, opens a PR, and closes the Asana task.
        const ship = await sandbox.run({
          name: 'ship',
          maxIterations: 1,
          // Ship is short (push + gh pr create + asana update) but the
          // /ship gstack skill can wait on CI checks. 15m is comfortable.
          idleTimeoutSeconds: 15 * 60,
          agent: sandcastle.claudeCode('claude-opus-4-6'),
          promptFile: './.sandcastle/ship-prompt.md',
          promptArgs: {
            BRANCH: issue.branch,
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
          },
        });

        // Merge commits from all runs so the merge phase sees the full set.
        // Each sandbox.run() only returns commits from its own run.
        return {
          ...ship,
          commits: [...implement.commits, ...review.commits, ...ship.commits],
        };
      } finally {
        await sandbox.close();
        // Tear down the privileged dind sidecar AFTER the sandbox is gone —
        // otherwise the sandbox's `--network container:<dind>` reference
        // breaks mid-shutdown.
        dind.stop();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.) and
  // move the task back to Backlog so the next planner iteration can
  // re-pick it. Without the requeue, AgentIdleTimeoutError or any other
  // mid-flight failure strands the task in In-Progress forever — the
  // planner only queries the Backlog section.
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      const reasonStr =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${reasonStr}`,
      );
      await requeueTaskToBacklog(issues[i]!.id, reasonStr.slice(0, 200));
    }
  }

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === 'fulfilled' &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    // All agents ran but none made commits — nothing to merge this cycle.
    console.log('No commits produced. Nothing to merge.');
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent merges all completed branches into the current branch,
  // resolving any conflicts and running tests to confirm everything works.
  //
  // The {{BRANCHES}} and {{ISSUES}} prompt arguments are lists that the agent
  // uses to know which branches to merge and which issues to close.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    // Merger runs `pnpm test` after merging, so it also needs the test
    // Supabase stack — but no DinD sidecar (no privileged containers needed
    // because the merger doesn't run docker itself; the test-supabase hook
    // would need one). Use planHooks for now and revisit if the merger
    // grows DB-touching test requirements.
    hooks: planHooks,
    sandbox: docker({
      env: { OPENCLAW_SESSION: '1' },
    }),
    // Same reason as the planner above — force a temp worktree so hooks
    // can't write to the host filesystem.
    branchStrategy: { type: 'merge-to-head' },
    name: 'merger',
    maxIterations: 1,
    // Merger runs `pnpm test` post-merge and may resolve conflicts
    // across multiple branches. 20m covers the test run plus moderate
    // conflict resolution.
    idleTimeoutSeconds: 20 * 60,
    agent: sandcastle.claudeCode('claude-opus-4-6'),
    promptFile: './.sandcastle/merge-prompt.md',
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join('\n'),
      // A markdown list of issue IDs and titles, one per line.
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join('\n'),
    },
  });

  console.log('\nBranches merged.');
}

console.log('\nAll done.');
