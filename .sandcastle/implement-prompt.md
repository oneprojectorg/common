# SETUP

1. Run `/caveman full` — every task starts in ultra-compressed
   communication mode.

2. Generate a per-run agent ID (UUID) and persist it for this run:

   ```
   cat /proc/sys/kernel/random/uuid > /tmp/sandcastle-agent-id
   ```

   Every later step in this run reads the agent ID from that file via
   `$(cat /tmp/sandcastle-agent-id)`. Do not regenerate it.

# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `sandcastle-asana view {{TASK_ID}}`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

# CLAIM

Optimistic-concurrency claim. Run these in order. If any step fails, stop
immediately — do not implement, commit, push, or move sections further.

1. Stamp our agent ID onto the task description:

   ```
   sandcastle-asana claim {{TASK_ID}} --agent-id "$(cat /tmp/sandcastle-agent-id)"
   ```

2. Move the task into the In-Progress section:

   ```
   sandcastle-asana move {{TASK_ID}} --section "$ASANA_IN_PROGRESS_SECTION_ID"
   ```

3. Re-fetch the description and verify our agent ID is still the last
   `Claimed by:` line. Another agent may have claimed in between:

   ```
   sandcastle-asana verify-claim {{TASK_ID}} --agent-id "$(cat /tmp/sandcastle-agent-id)"
   ```

   If `verify-claim` exits non-zero, ANOTHER AGENT HAS CLAIMED THIS TASK.
   Stop now and output `<promise>SKIPPED</promise>`. Do not roll back the
   section move — the other agent's work is already in progress there.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

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
- `npx fallow audit --format json` (verdict must be `pass`)

If any check fails, fix and re-run before continuing.

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
