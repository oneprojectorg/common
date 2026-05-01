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

2. **Open a PR** with `gh pr create`. Derive a concise title from the
   commits (under 70 chars). The body must include:
   - A short Summary section (1-3 bullets describing the change)
   - A line `Closes Asana task {{TASK_ID}}`
   - A Test plan checklist

   Use `--base {{TARGET_BRANCH}}` and `--head {{BRANCH}}`. Capture the PR
   URL printed to stdout.

3. **Move the Asana task to In Review** with the PR URL as a comment:

   ```
   sandcastle-asana move {{TASK_ID}} \
     --section "$ASANA_IN_REVIEW_SECTION_ID" \
     --comment "PR opened: <url>"
   ```

   Leave the task open — a human will close it once the PR merges.

Once all three steps succeed, output `<promise>COMPLETE</promise>`.
