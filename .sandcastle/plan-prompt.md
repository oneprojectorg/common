# ISSUES

Here are the open issues in the repo:

<issues-json>

!`sandcastle-asana list --section "$ASANA_BACKLOG_SECTION_ID" --type Agent --assignee me --include-comments`

</issues-json>

# VERIFICATION

Look at each issue's `notes` (description) and `comments` for explicit
verification steps: manual QA flows, specific URLs/screens to check,
behaviors to observe, data to inspect, etc. The verification doesn't
need a specific format — a heading like `## Verification`, a comment
starting with "Verify by:", an "Acceptance criteria" list, or any
clearly demarcated set of concrete steps all qualify.

An issue is eligible to proceed if **any** of these is true:

- It has acceptable verification steps.
- It has no verification steps at all.
- The verification notes explicitly say to skip verification (e.g.
  "skip verification", "no verification needed").

In other words: do NOT gate on missing verification anymore. The
implementer and reviewer fall back to the standard checks
(`pnpm typecheck`, `pnpm test`, `npx fallow audit`) when task-specific
verification is absent or marked to skip.

# TASK

Analyze the remaining issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name using the format
`issue-{slug}` (no Asana ID — it pushes Vercel preview hostnames past
the 63-char DNS label limit, and the implementer/reviewer/ship phases
receive the task ID as a separate prompt arg, so the branch doesn't
need to encode it).

The `{slug}` is a tight kebab-case summary of the task — **do NOT
just slugify the title.** Distill the task down to its essence first,
then pick the words. Hard rules:

- **Exactly 3 words** in the slug, in normal cases. Two is fine if
  the task is genuinely that simple; never more than three. Pick the
  highest-signal nouns/verbs and drop everything else (articles,
  prepositions, qualifiers, adjectives that don't disambiguate).
- Lowercase ASCII letters, digits, and hyphens only. No trailing
  periods.
- Examples (note how each strips the title down to three load-bearing
  words):
  - "Fix 'Content could not be loaded' flash across proposal flows" → `proposal-content-flash`
  - "Add rate limiting to public API endpoints" → `rate-limit-api`
  - "Refactor user-profile page to use suspense queries" → `profile-suspense-queries`
  - "Update the onboarding checklist to include SSO setup" → `onboarding-sso-checklist`
- If two open issues collapse to the same 3-word slug, swap one of
  the words for a disambiguator (e.g. `-edit` vs `-view`) — never
  append the Asana ID.

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

1. **Check for a resumable session.** If a previous run already worked
   on this task and was requeued (timeout, sandbox crash, reviewer
   failure, etc.), it leaves a session marker on the task notes. Read
   it:

   ```
   PRIOR=$(sandcastle-asana get-claim <id>)
   ```

   If `$PRIOR` is non-empty AND starts with the literal prefix
   `session:`, capture the trailing session ID for the JSON output
   below — the orchestrator will pass it to the implementer as a
   resume handle. Example: `session:0a3f-...` → resume id is
   `0a3f-...`. If `$PRIOR` is empty or does not start with
   `session:`, this task has no resumable session.

2. Generate a fresh UUID for this issue (race-protection token —
   the implementer overwrites this post-run with the real session
   ID, but during the planner's claim+move window we need a token
   so two parallel planners can't both stamp the same task):

   ```
   AGENT_ID=$(cat /proc/sys/kernel/random/uuid)
   ```

3. Stamp the claim onto the task description, then immediately move it
   into the In-Progress section:

   ```
   sandcastle-asana claim <id> --agent-id "$AGENT_ID"
   sandcastle-asana move <id> --section "$ASANA_IN_PROGRESS_SECTION_ID"
   ```

4. Verify our claim still holds after the move:

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
claim+move+verify steps. Include `resumeSession` ONLY when step 1
captured a `session:<id>` marker; omit the field otherwise:

<plan>
{"issues": [
  {"id": "42", "title": "Fix auth bug", "branch": "issue-auth-bug"},
  {"id": "43", "title": "Resume translation", "branch": "issue-somali-dict", "resumeSession": "0a3f-..."}
]}
</plan>

If every verify step failed (or no issues qualified), emit an empty plan:

<plan>
{"issues": []}
</plan>
