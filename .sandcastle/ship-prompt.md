# TASK

Ship branch `{{BRANCH}}` for Asana task `{{TASK_ID}}: {{ISSUE_TITLE}}`.

# CONTEXT

Target branch (PR base): `{{TARGET_BRANCH}}`

Commits on this branch:

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --format='%h %s'`

Diff stat:

!`git diff {{TARGET_BRANCH}}...{{BRANCH}} --stat`

# STEPS

Run these in order. If any step fails, stop, output the failure, and DO NOT
continue to subsequent steps. Do not move the Asana task on failure.

1. **Push the branch** to origin:

   ```
   git push -u origin {{BRANCH}}
   ```

2. **Open or update the PR.**

   First check whether a PR already exists for this branch:

   ```
   PR_URL=$(gh pr view {{BRANCH}} --json url -q .url 2>/dev/null || true)
   ```

   - **If `$PR_URL` is non-empty** — this branch was sent back through
     Backlog for revision and the new commits we just pushed have
     updated the existing PR. Do NOT run `gh pr create` (it would fail
     with "PR already exists"). Instead, leave a comment on the PR so
     the reviewer sees the revision landed:

     ```
     gh pr comment {{BRANCH}} --body "Revision pushed. New commits:
     $(git log <last-pr-head>..{{BRANCH}} --format='- %h %s')"
     ```

     Use the existing PR URL for step 3. Skip the rest of step 2.

   - **If `$PR_URL` is empty** — this is a first ship. Create the PR
     with `gh pr create --draft`:

     - **Always open in draft mode.** A human marks the PR ready for
       review after sanity-checking the work.
     - **Title**: Conventional Commits format (`feat:`, `fix:`, `chore:`,
       `docs:`, `refactor:`, `test:`, `perf:`, `build:`, `ci:`). Use a
       scope when it sharpens the title (e.g. `feat(reviews): ...`).
       Under 70 chars. No trailing period.
     - **Body**: keep it minimal — no background, no narrative. Exactly:
       - Summary: 1–3 bullets describing what changed.
       - `Closes Asana task {{TASK_ID}}`
       - Test plan: a short checklist, only if non-trivial steps are
         needed; otherwise omit the section entirely.

     Use `--draft --base {{TARGET_BRANCH}} --head {{BRANCH}}`. Capture
     the PR URL printed to stdout.

3. **Move the Asana task to In Review** with the PR URL as a comment.
   For a revision, this also pulls the task back out of Backlog (where
   the human moved it to request changes) so it doesn't get re-picked
   on the next planner iteration.

   ```
   sandcastle-asana move {{TASK_ID}} \
     --section "$ASANA_IN_REVIEW_SECTION_ID" \
     --comment "PR opened: <url>"
   ```

   For revisions, prefer a comment like
   `--comment "Revision pushed: <url>"` so the trail is clear.

   Leave the task open — a human will close it once the PR merges.

Once all three steps succeed, output `<promise>COMPLETE</promise>`.
