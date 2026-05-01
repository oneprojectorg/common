# ISSUES

Here are the open issues in the repo:

<issues-json>

!`sandcastle-asana list --section "$ASANA_BACKLOG_SECTION_ID" --type Agent --assignee me`

</issues-json>

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name using the format `issue-{id}-{slug}`.

# SELECT

From the unblocked issues, pick the **single** highest-priority one to
work on this iteration. We only claim one task per planner run — other
unblocked issues stay in Backlog for the next run (or for another agent).

If every issue is blocked, pick the single candidate with the fewest or
weakest dependencies.

# CLAIM

Claim the selected issue at the moment you move it to In-Progress. The
claim and the move are paired — do not perform either alone.

1. Generate a fresh UUID:

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
   ISSUE. **Emit an empty plan** (no issues this run). Do not roll back
   the section move; the other agent owns the task now.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags. Include
**at most one** issue:

<plan>
{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "issue-42-fix-auth-bug"}]}
</plan>

If the verify step failed, emit an empty plan:

<plan>
{"issues": []}
</plan>
