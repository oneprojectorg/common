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

// Symlink the vendored gstack into ~/.claude/skills/gstack so the gstack
// skills' hardcoded `~/.claude/skills/gstack/bin/...` preamble paths resolve
// inside the sandbox. The container has no host home, so this just points
// at the vendored copy on the worktree.
const linkGstack = {
  command:
    'mkdir -p ~/.claude/skills && ' +
    'ln -sfn "$PWD/.claude/skills/gstack" ~/.claude/skills/gstack',
};

// Build the gstack bun-compiled binaries (browse, design, make-pdf,
// gstack-global-discover) for linux/amd64. The host-side binaries are macOS
// arm64 and excluded from the vendored copy (see scripts/sync-gstack.sh),
// so the first sandbox start has to rebuild them. The conditional makes
// subsequent runs a no-op once the binaries are cached on the worktree.
const buildGstack = {
  command:
    'if [ ! -x .claude/skills/gstack/browse/dist/browse ]; then ' +
    '(cd .claude/skills/gstack && bun install && bun run build); ' +
    'fi',
  timeoutMs: 5 * 60 * 1000,
};

// Register the OpenAI API key with the codex CLI so gstack /review's Step 5.7
// adversarial pass can call `codex exec` non-interactively. The CLI does NOT
// auto-pickup OPENAI_API_KEY from env — it requires credentials at
// ~/.codex/auth.json, which `--with-api-key` writes from stdin. No-op when
// the key isn't forwarded; /review then reports "Codex CLI not authed" and
// continues with Claude-only adversarial coverage.
const loginCodex = {
  command:
    'if [ -n "${OPENAI_API_KEY:-}" ] && [ ! -f ~/.codex/auth.json ]; then ' +
    'printenv OPENAI_API_KEY | codex login --with-api-key; ' +
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
    onSandboxReady: [writeSettingsLocal, linkGstack],
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
      linkGstack,
      buildGstack,
      loginCodex,
      { command: 'pnpm install' },
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

  // The plan JSON contains an array of issues, each with id, title, branch.
  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
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
              // Forward the OpenAI key so the reviewer's /codex skill can
              // auth. If unset on the host, /codex degrades gracefully.
              ...(process.env.OPENAI_API_KEY
                ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
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
        // Run the implementer
        const implement = await sandbox.run({
          name: 'implementer',
          maxIterations: 100,
          agent: sandcastle.claudeCode('claude-opus-4-6'),
          promptFile: './.sandcastle/implement-prompt.md',
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Nothing to review or ship if the implementer made no commits.
        if (implement.commits.length === 0) {
          return implement;
        }

        // Reviewer: refines the implementer's work in-place.
        const review = await sandbox.run({
          name: 'reviewer',
          maxIterations: 1,
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

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
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
