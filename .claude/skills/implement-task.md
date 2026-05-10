---
name: implement-task
description: End-to-end implementation flow for a claimed Asana task — BUG MODE (/investigate), PLAN REVIEW (/autoplan), exploration with downstream test scan, RGR execution, and the gate suite (typecheck/test/e2e/fallow + task-specific verification). Use after the task is claimed and a feature branch is checked out.
---

Drives a single Asana task from claimed → ready-for-review.

**Preconditions**: task is claimed, feature branch is checked out,
you have the task ID. Claim mechanics belong to `pickup-task` (or
the caller); branch creation and PR opening belong to `branch-and-pr`
and the caller. This skill does not commit and does not signal
iteration completion — both are the caller's responsibility.

## Step 1 — Read the task

Pull the task body and stories via `asana-api` (the skill has the
endpoint reference). Capture any verification steps from
`notes` and the most recent stories — `## Verification`,
"Verify by:", "Acceptance criteria", or any clearly-demarcated set
of concrete steps. You'll execute them in Step 6.

If `notes` references a parent PRD, pull that too.

## Step 2 — BUG MODE

If the task is a bug fix — title or description contains "bug",
"regression", "broken", "error", "fails", "incorrect", or "crash" —
run `/investigate` BEFORE writing any code. The skill produces a
structured root-cause hypothesis; use it to inform the RGR loop in
Step 5.

When you ran `/investigate`, skip Step 3 (PLAN REVIEW) — the
investigation already covers the design context.

Every code change kept after `/investigate` must be tied to the
reported symptom. If the investigation flags adjacent suspicious
code that doesn't reproduce the bug, leave it alone — open a
separate Asana follow-up if it's worth tracking. Speculative fixes
bundled into a bug-fix PR get the PR rejected.

## Step 3 — PLAN REVIEW

For features and non-trivial refactors, run `/autoplan` against a
draft plan **before** writing any code.

Skip entirely for:
- Bug fixes (Step 2 BUG MODE replaces this).
- Trivial changes (<3 files of obvious mechanical work).
- Revision-mode runs (the feedback already replaces the plan
  review).

Otherwise: draft a short plan file (`.plans/$TASK_ID.md` or your
project's conventional path) with **Problem** (1-2 sentences),
**Approach** (3-7 bullets), **Files**, **Edge cases**, **Out of
scope**. Half a page. Then invoke `/autoplan` and pass the path —
it runs CEO → Design → Eng → DX reviews and writes the revised
plan back.

If `/autoplan` flags scope changes that materially expand the task
beyond the Asana ticket, post a comment on the task summarising
the expansion and **abort without committing code**. A human will
re-scope.

Commit the reviewed plan file in the same commit as the first
implementation change.

## Step 4 — EXPLORATION

Read the relevant code; pay extra attention to test files near the
parts you're about to change.

**Downstream test scan.** Before changing any user-visible string,
error fallback, render branch, or exported component, grep
`tests/`, `**/*.spec.ts`, `**/*.test.ts` for assertions that
reference it. If matches exist, your change must either keep the
assertion green or update it in the same commit with a one-line
note explaining why. Silently breaking a previously-green
assertion (especially in `tests/e2e/`) is the most common way
these PRs regress real behavior.

## Step 5 — EXECUTION (RGR)

Red-Green-Refactor:

1. **RED**: write one test that fails for the right reason.
2. **GREEN**: write the minimum implementation to pass it.
3. **REPEAT** until the task is done.
4. **REFACTOR** once green.

For pure refactors with no behavior change, the RED step is "the
existing tests still pass after the refactor" — don't invent
synthetic tests. For docs- or config-only changes, skip RGR.

## Step 6 — FEEDBACK LOOPS

Before each commit:

```bash
pnpm format
```

Before signaling complete (run all of them; do NOT cherry-pick):

```bash
pnpm typecheck
pnpm test
pnpm e2e                          # playwright; pnpm test does NOT include this
npx fallow audit --format json    # verdict must be "pass"
```

Skip `pnpm e2e` only when the diff has no UI / route / API
surface. Note the reason in the commit message; the reviewer
re-runs it either way.

**Task-specific verification.** Walk through every verification
step from the Asana task (Step 1). Execute each — open the URL,
walk the flow, inspect the data — and confirm the observed
behavior matches what's expected. If the task has none, or its
notes say to skip, fall back to the standard gates above.

### A failing or unrun gate is a STOP signal

The reviewer re-runs every gate from a clean checkout. Shipping
with skipped or hand-waved gates is the most expensive failure
mode in this pipeline.

You MUST NOT signal completion citing any of:

- "Pre-existing errors", "errors in files I didn't touch",
  "module resolution issues unrelated to my change".
- "Infrastructure", "environment", "sandbox limitation".
- "I'll let CI verify", "the reviewer will re-run".

These are recoverable problems you must address on this branch.
Try the obvious recovery (e.g. reinstall deps for environment
issues — see the caller's prompt or runbook for project-specific
recovery steps).

If after recovery the gate still fails for reasons genuinely
outside the diff, post a comment on the Asana task describing
what failed and why the diff is correct, and **stop without
signaling completion**.

## Step 7 — Done / not done

If the task is complete: hand back to the caller, which owns the
commit, PR, and any iteration-control signal.

If NOT complete (you're stopping mid-task because of ambiguity,
scope blow-up, or an unrecoverable gate failure): leave a comment
on the Asana task describing what was done, what remains, and
what's blocking. Be specific. Do NOT close the task.

## Scope rules

- ONE task at a time. Don't pull adjacent fixes into the diff.
- In revision mode, the issue scope is **the feedback** — don't
  expand into unrelated changes.
- Stay on the feature branch. Pushing to `main` or `dev` is
  blocked by hooks (see `branch-and-pr`).
