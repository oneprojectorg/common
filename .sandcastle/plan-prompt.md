# ISSUES

Here are the open issues in the repo:

<issues-json>

!`sandcastle-asana list --section "$ASANA_BACKLOG_SECTION_ID" --type Agent --assignee me --include-comments`

</issues-json>

# VERIFICATION GATE

Before any further analysis, every issue MUST specify how to verify it is
complete — beyond the standard checks (`pnpm typecheck`, `pnpm test`,
`npx fallow audit`). Look in the issue's `notes` (description) and
`comments` for explicit verification steps: manual QA flows, specific
URLs/screens to check, behaviors to observe, data to inspect, etc.

The verification doesn't need a specific format — a heading like
`## Verification`, a comment starting with "Verify by:", an
"Acceptance criteria" list, or any clearly demarcated set of concrete
steps all qualify. Vague text like "make sure it works" or a bare ticket
title does NOT qualify.

For every issue WITHOUT acceptable verification steps, run:

```
sandcastle-asana move <id> --section "$ASANA_ON_HOLD_SECTION_ID" \
  --comment "Moved to On Hold: missing verification criteria. Add a section to the description (or post a comment) describing how to verify this task is complete — manual QA steps, URLs to check, behaviors to confirm, etc. Then move it back to Backlog."
```

Then **exclude that issue from the dependency graph and selection
below.** Only issues that pass this gate are eligible.

If no issues remain after the gate, emit an empty plan (see OUTPUT).

# TASK

Analyze the remaining issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name using the format `issue-{id}-{slug}`.

# SELECT

From the unblocked issues, pick **up to {{MAX_PARALLEL_ISSUES}}** of the
highest-priority ones to work on in parallel this iteration. Prefer
selections that touch disjoint files/modules so the parallel pipelines
don't conflict. If fewer unblocked issues exist than the limit, pick what's
available. If every issue is blocked, pick the single candidate with the
fewest or weakest dependencies.

# CLAIM

For each selected issue, claim it at the moment you move it to In-Progress.
The claim and the move are paired — do not perform either alone. Process
issues sequentially: fully claim+move+verify one before starting the next.

For each selected issue:

1. Generate a fresh UUID for this issue:

   ```
   AGENT_ID=$(cat /proc/sys/kernel/random/uuid)
   ```

2. Stamp the claim onto the task description, then immediately move it
   into the In-Progress section:

   ```
   sandcastle-asana claim <id> --agent-id "$AGENT_ID"
   sandcastle-asana move <id> --section "$ASANA_IN_PROGRESS_SECTION_ID"
   ```

3. Verify our claim still holds after the move:

   ```
   sandcastle-asana verify-claim <id> --agent-id "$AGENT_ID"
   ```

   If `verify-claim` exits non-zero, ANOTHER AGENT IS WORKING ON THIS
   ISSUE. **Drop it from the plan** — do not include it in the JSON
   output below. Do not roll back the section move; the other agent owns
   the task now. Continue with the other selected issue (if any).

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags. Include **at
most {{MAX_PARALLEL_ISSUES}}** issues — only those that passed the
claim+move+verify steps:

<plan>
{"issues": [
  {"id": "42", "title": "Fix auth bug", "branch": "issue-42-fix-auth-bug"},
  {"id": "43", "title": "Add rate limiting", "branch": "issue-43-add-rate-limiting"}
]}
</plan>

If every verify step failed (or no issues qualified), emit an empty plan:

<plan>
{"issues": []}
</plan>
