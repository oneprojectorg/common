# TASK

Review the code changes on branch `{{BRANCH}}` for issue {{TASK_ID}}: {{ISSUE_TITLE}}.

You have two responsibilities, in this order:

1. **QA**: independently verify the change satisfies the task's verification criteria.
2. **Refine**: improve code clarity, consistency, and maintainability while preserving exact functionality.

If QA fails, fix it or escalate via an Asana comment — do NOT proceed to the refine pass and do NOT emit `<promise>COMPLETE</promise>`.

# CONTEXT

## Branch diff

!`git diff {{SOURCE_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{SOURCE_BRANCH}}..{{BRANCH}} --oneline`

# VERIFICATION

Before refining the code, confirm the change actually does what the task
asked for. The implementer self-checked these — your job is to verify
independently. Don't accept the implementer's word; re-run everything.

1. Pull the task (and any parent PRD) for the verification criteria:

   `sandcastle-asana view {{TASK_ID}}`

2. Re-run the standard gates from scratch:

   - `pnpm typecheck`
   - `pnpm test`
   - `npx fallow audit --format json` (verdict must be `pass`)

3. Walk through every task-specific verification step named in the task's
   description and comments. For each step, execute it (open the URL,
   walk the flow, query the data, diff the output) and confirm the
   observed behavior matches what's expected.

4. Run `/qa` to drive the changed feature in a real headless browser and
   verify the task's acceptance criteria. The skill produces before/after
   health scores and screenshots — review them and treat any regression
   as a failing gate.

5. Run `/cso` to audit the diff for secrets, OWASP issues, and dependency
   risks. Reviewer-time security gate; any high-severity finding is a
   failing gate.

6. If any check fails:

   - If you can fix it on this branch, do so and commit the fix.
   - If you can't (out of scope, unclear, blocked), post a comment on the
     Asana task via `sandcastle-asana comment {{TASK_ID}} ...` describing
     what failed, and stop. Do NOT output `<promise>COMPLETE</promise>`
     in that case — ship must not run on a broken change.

Only continue to the code-cleanup pass below once every gate is green.

# REVIEW PROCESS

1. Run `/review` to analyze the diff against the base branch. The skill
   covers SQL safety, LLM trust boundaries, conditional side effects,
   naming, nesting, dead code, and structural smell, AND runs a built-in
   adversarial pass (Claude adversarial subagent + Codex adversarial
   challenge when `OPENAI_API_KEY` is set). Apply structural fixes it
   surfaces; commit them on this branch.

2. The clarity / readability cleanup the prior prompt described is
   subsumed by `/review`. Only do additional manual cleanup if `/review`
   flagged none and the diff still has obvious smell (over-deep nesting,
   misleading names, copy-paste blocks).

3. Apply project standards from @.sandcastle/CODING_STANDARDS.md.

4. **Preserve functionality**: Never change what the code does — only how
   it does it. All original features, outputs, and behaviours must remain
   intact.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run tests and type checking to ensure nothing is broken
3. Commit describing the refinements

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
