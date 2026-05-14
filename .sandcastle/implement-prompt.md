# SETUP

1. Run `/caveman full` — every task starts in ultra-compressed
   communication mode.

2. Detect mode and prepare the branch.

   Fetch both the target and any pre-existing remote copy of this
   branch. The `|| true` keeps us going if `origin/{{BRANCH}}`
   doesn't exist (fresh task):

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

   - **MODE=fresh** — first time on this task. Rebase onto target
     so we start from a clean base, then proceed to TASK below:

     ```
     git rebase origin/{{TARGET_BRANCH}}
     ```

     `{{TARGET_BRANCH}}` is the only valid base — never branch off
     `main`.

   - **MODE=revision** — a previous iteration already shipped a PR
     for this branch and the task came back through Backlog
     because the reviewer/author wants changes. Sync the local
     worktree with origin (the host copy may be stale from the
     last run), then pull in the feedback context:

     ```
     git reset --hard origin/{{BRANCH}}

     gh pr view {{BRANCH}} --json title,body,comments,reviews,reviewDecision
     sandcastle-asana view {{TASK_ID}}
     git log {{TARGET_BRANCH}}..{{BRANCH}} --format='%h %ad %s' --date=short
     git diff {{TARGET_BRANCH}}...{{BRANCH}} --stat
     ```

     Treat the most-recent PR comments and Asana comments as the
     **revision request**. Make new commits on top of the existing
     branch. Do NOT reset, force-push, squash, or rebase past
     existing commits unless the feedback explicitly asks for it.

# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}} on branch {{BRANCH}}.

The task has already been claimed and moved into the In-Progress
section by the planner. Begin work directly.

# IMPLEMENT

Run the `implement-task` skill (shipped by the common-agent-toolkit
plugin; resolves via `~/.claude/skills/implement-task/SKILL.md`).
Pass `TASK_ID={{TASK_ID}}`. The skill owns:

- Reading the task body and parent PRD.
- BUG MODE (`/investigate` for bug-fix tasks).
- PLAN REVIEW (`/autoplan` for non-trivial features).
- EXPLORATION with the downstream test scan.
- RGR execution.
- The full gate suite: `pnpm typecheck`, `pnpm test`, `pnpm e2e`,
  `npx fallow audit --format json`, plus task-specific verification
  pulled from the Asana task.
- The "never ship past a failed gate" doctrine.

In revision mode, the issue scope is **the feedback** — don't
expand into unrelated changes.

# CONTAINER GATE RECOVERY

If a gate fails for "module resolution", "Cannot find module",
"turbo binary", "tsgo not available", "vitest not found", or any
other linux-x64 platform-binary symptom:

```
pnpm install --force
```

then re-run the gate. The sandbox already runs `pnpm install
--force` at startup; if it failed mid-flight, run it again
yourself.

If after `pnpm install --force` and a clean re-run the gate still
fails for reasons genuinely outside the diff, post a comment on
the Asana task and **stop without emitting `<promise>COMPLETE</promise>`**:

```
sandcastle-asana comment {{TASK_ID}} "<what failed and why the diff is correct>"
```

A human will move the task back to Backlog or unblock the
environment.

# COMMIT

Run `pnpm format`, then make a git commit. The commit message must:

1. Start with `RALPH:` prefix.
2. Include the task completed + PRD reference.
3. Key decisions made.
4. Files changed.
5. Blockers or notes for next iteration.

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the Asana task
with what was done. Do not close the task — that happens later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
