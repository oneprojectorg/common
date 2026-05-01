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

// Branch new worktrees fork from, and the PR base for ship. Override with
// BASE_BRANCH. Defaults to `sandcastle` until the agent infrastructure
// (`.sandcastle/`, `.claude/hooks/`, etc.) lands on `dev`.
const BASE_BRANCH = process.env.BASE_BRANCH ?? 'sandcastle';

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
const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        command:
          'mkdir -p .claude && printf \'%s\\n\' \'{"sandbox":{"enabled":false}}\' > .claude/settings.local.json',
      },
      { command: 'pnpm install' },
    ],
  },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ['.env', '.env.local', 'node_modules'];

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
    hooks,
    sandbox: docker(),
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

  // Refresh origin/<BASE_BRANCH> so every new worktree forks off the latest.
  // baseBranch is ignored when the branch already exists, so resumed work
  // on a prior branch keeps its state.
  console.log(
    `Fetching origin/${BASE_BRANCH} so new worktrees fork off the latest...`,
  );
  execFileSync('git', ['fetch', 'origin', BASE_BRANCH], { stdio: 'inherit' });

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
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        // Always fork from the latest origin/<BASE_BRANCH> (refreshed above)
        // for new branches. Ignored if the branch already exists.
        baseBranch: `origin/${BASE_BRANCH}`,
        sandbox: docker(),
        hooks,
        copyToWorktree,
      });

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
            BASE_BRANCH,
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
            TARGET_BRANCH: BASE_BRANCH,
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
    hooks,
    sandbox: docker(),
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
