# SETUP

1. Run `/caveman full` — every task starts in ultra-compressed
   communication mode.

2. Detect mode and prepare the branch.

   Fetch both the target and any pre-existing remote copy of this
   branch. The `|| true` keeps us going if `origin/{{BRANCH}}` doesn't
   exist (fresh task):

   ```
   git fetch origin {{TARGET_BRANCH}}
   git fetch origin {{BRANCH}} 2>/dev/null || true
   ```

   Then check whether the branch already exists on origin:

   ```
   if git rev-parse --verify origin/{{BRANCH}} >/dev/null 2>&1; then
     echo MODE=revision
   else
     echo MODE=fresh
   fi
   ```

   - **MODE=fresh** — first time on this task. Rebase onto target so we
     start from a clean base, then proceed to TASK below:

     ```
     git rebase origin/{{TARGET_BRANCH}}
     ```

     `{{TARGET_BRANCH}}` is the only valid base — never branch off `main`.

   - **MODE=revision** — a previous iteration already shipped a PR for
     this branch and the task came back through Backlog because the
     reviewer/author wants changes. Sync the local worktree with what's
     on origin (the host copy may be stale from the last run), then pull
     in the feedback context:

     ```
     git reset --hard origin/{{BRANCH}}

     # PR review threads + issue-level comments + the latest review state
     gh pr view {{BRANCH}} --json title,body,comments,reviews,reviewDecision

     # Asana task — read every comment, especially anything posted since
     # the last commit on this branch. That's the feedback for this round.
     sandcastle-asana view {{TASK_ID}}

     # Existing work on this branch
     git log {{TARGET_BRANCH}}..{{BRANCH}} --format='%h %ad %s' --date=short
     git diff {{TARGET_BRANCH}}...{{BRANCH}} --stat
     ```

     Treat the most-recent PR comments and Asana comments as the
     **revision request**. Make new commits on top of the existing
     branch. Do NOT reset, force-push, squash, or rebase past existing
     commits unless the feedback explicitly asks for it — those commits
     have already been reviewed and may be referenced from PR threads.

# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

The task has already been claimed and moved into the In-Progress section
by the planner. Begin work directly.

Pull in the issue using `sandcastle-asana view {{TASK_ID}}`. If it has a parent PRD, pull that in too.

Only work on the issue specified. In revision mode, the issue scope is
**the feedback** — don't expand into unrelated changes.

Work on branch {{BRANCH}}. Make commits and run tests.

# BUG MODE

If the Asana task is a bug fix — i.e. the title or description contains
words like "bug", "regression", "broken", "error", "fails", "incorrect",
or "crash" — run `/investigate` BEFORE writing any code. The skill
produces a structured root-cause hypothesis. Use it to inform the RGR
loop in EXECUTION below; do not skip straight to a patch.

If you ran `/investigate` here, skip the next section (PLAN REVIEW) and
go straight to EXPLORATION + EXECUTION — the investigation already
captured the design context the plan review would surface.

Every code change you keep after `/investigate` must be tied to the
reported symptom. If `/investigate` flags adjacent suspicious code that
doesn't reproduce the reported bug, leave it alone — open a separate
Asana follow-up via `sandcastle-asana comment` if it's worth tracking.
Do NOT bundle speculative fixes into a bug-fix PR; scope creep gets
the PR rejected and burns a revision cycle.

For non-bug tasks (features, refactors, docs), skip this section and
continue to PLAN REVIEW.

# PLAN REVIEW

For features and non-trivial refactors, run gstack's `/autoplan` skill
against a draft plan **before** writing any code. Skip this entire
section for: bug-fix tasks (handled by BUG MODE above), trivial changes
(<3 files of obvious mechanical work), and revision-mode runs (the
revision feedback already replaces the plan-review step).

Steps:

1. Draft a short plan file at `.sandcastle/plans/{{TASK_ID}}.md` with:
   - **Problem**: 1-2 sentences naming what the task is solving.
   - **Approach**: 3-7 bullets describing the implementation strategy.
   - **Files**: which files/directories will be touched.
   - **Edge cases**: what could go wrong; what tests will cover.
   - **Out of scope**: what we're explicitly NOT changing this round.

   Keep it compact — half a page is enough. The reviewers don't need
   prose; they need scope and shape.

2. Invoke `/autoplan` and pass the path. The skill runs CEO → Design
   (skipped if no UI scope) → Eng → DX (skipped if no DX scope) reviews
   with auto-decisions, then writes a revised plan back to the same file.

3. The sandbox runs with `OPENCLAW_SESSION=1`, so `/autoplan`'s final
   approval gate auto-picks the recommended option. Read the revised
   plan file when the skill completes; treat it as the source of truth
   for EXPLORATION + EXECUTION.

4. If `/autoplan` flags scope changes that materially expand the task
   beyond what the Asana ticket describes, post a comment on the Asana
   task via `sandcastle-asana comment {{TASK_ID}} ...` summarising the
   expansion and **abort without committing code**. A human moves the
   task back to Backlog or rewrites the scope.

5. Commit the reviewed plan file in the same commit that introduces the
   first implementation change so the audit trail lands with the work.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

**Downstream test scan.** Before changing any user-visible string,
error fallback, render branch, or exported component, grep the repo
(especially `tests/` and `**/*.spec.ts`, `**/*.test.ts`) for
assertions that reference it. Examples: a literal UI string about to
be removed, a component name about to be inlined, an error message
about to change. If matches exist, your change must either keep the
assertion green or update it in this commit with a one-line note
in the commit message explaining why. Silently breaking a
previously-green assertion (especially in `tests/e2e/`) is the most
common way these PRs regress real behavior.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Follow the gates defined in @.sandcastle/CODING_STANDARDS.md.

Before each commit:

- `pnpm format`

Before signaling the task complete:

- `pnpm typecheck`
- `pnpm test`
- `pnpm e2e` — playwright e2e suite. `pnpm test` does NOT include
  this. Skip only when the diff has no UI / route / API surface
  (note the reason in the commit message); the reviewer re-runs it
  either way.
- `npx fallow audit --format json` (verdict must be `pass`)
- **Task-specific verification** — walk through every verification step
  named in the Asana task's description and comments (from the
  `sandcastle-asana view` output above). For each step, execute it (run
  the URL, walk the flow, inspect the data, etc.) and confirm the
  observed behavior matches what's expected. The reviewer will re-run
  these independently — don't sign off if any are failing. If the task
  has no task-specific verification steps, or its notes explicitly say
  to skip verification, skip this bullet and rely on the standard gates
  above.

## Gate failures are NEVER acceptable to ship past

A failing or unrun gate is a STOP signal. The reviewer's CI re-runs
every gate from a clean checkout — shipping a PR with skipped or
hand-waved gates is the single most expensive failure mode in this
pipeline.

You MUST NOT emit `<promise>COMPLETE</promise>` if any gate failed,
errored, or did not run — including failures attributed to:

- "Infrastructure", "environment", "sandbox limitation", "platform
  binary missing", "missing native binaries", "turbo binary issue",
  "tsgo not available".
- "Pre-existing errors", "errors in files I didn't touch", "module
  resolution issues unrelated to my change".
- "I'll let CI verify" or "the reviewer will re-run".

These excuses indicate a recoverable problem the agent must address
on this branch. Specifically:

- **Turbo / native binary failure** → run `pnpm install --force` to
  reinstall platform-specific deps for the linux container, then
  re-run the gate. The sandbox already runs `pnpm install --force`
  at startup; if it failed mid-flight, run it again yourself.
- **Module resolution / TS2307 / "Cannot find module"** → run
  `pnpm install --force` then re-run typecheck. If the errors
  reproduce on `dev` HEAD, comment on Asana with a repro and abort.
  Do NOT ship past it.
- **Test runner can't find vitest** → run `pnpm install --force`,
  then re-run the workspace test from its directory.

If after `pnpm install --force` and a clean re-run the gate still
fails for reasons genuinely outside the diff, post a comment on the
Asana task via `sandcastle-asana comment {{TASK_ID}} ...` describing
what failed and why the diff is correct, and **stop without emitting
`<promise>COMPLETE</promise>`**. A human will move the task back to
Backlog or unblock the environment.

# COMMIT

Run `pnpm format`, then make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
