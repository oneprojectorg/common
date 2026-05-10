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

2. **Purpose-fit review.** Dispatch a fresh `code-reviewer` subagent
   via the `Task` tool. Pass it: the full Asana task body from step 1
   (or a tight summary of the reported symptom + acceptance criteria),
   the branch diff (`git diff {{SOURCE_BRANCH}}...{{BRANCH}}`), and the
   commit log (`git log {{SOURCE_BRANCH}}..{{BRANCH}} --oneline`). Ask
   it to answer three questions, in order:

   - **Symptom fit.** For each hunk in the diff, does it tie to the
     reported symptom? Flag any hunk that doesn't — even if the change
     looks like a reasonable improvement on its own (scope creep gets
     this PR rejected).
   - **Regression risk per callsite.** For each function, component,
     exported symbol, or render branch the diff modifies or removes,
     enumerate the callers/consumers and assess whether the change
     still serves them. Pay special attention to error paths and
     fallbacks: a fallback that handled multiple distinct conditions
     pre-change must be replaced with logic that handles each
     condition correctly, not collapsed to a single "no-op".
   - **Reproduce-and-fix proof.** Walk the bug scenario described in
     the task against the post-change code and confirm the symptom is
     gone. If the task is a feature/refactor instead of a bug, walk
     the acceptance criteria.

   The subagent has fresh context — no bias from the rest of this
   prompt. Treat its findings as a blocking peer review: anything it
   rates Important or Critical must be reconciled before continuing.
   If the subagent concludes the diff doesn't address the reported
   symptom, stop and escalate via Asana comment — don't proceed to the
   standard gates below.

3. Re-run the standard gates from scratch. Each must produce real
   output and a successful exit code — a missing or hand-waved gate
   is a hard fail (see step 8 below).

   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm e2e` — playwright e2e suite. `pnpm test` does NOT cover
     this. Run it independently of whether the implementer claims to
     have run it; an implementer-skipped or stale e2e pass is the
     single most common regression vector.
   - `npx fallow audit --format json` (verdict must be `pass`)

   If any of these fail with a "turbo binary issue", "tsgo not
   available", "Cannot find module" / TS2307 cascade, or similar
   platform-binary symptom, run `pnpm install --force` (which
   reinstalls platform-specific deps for the linux container) and
   re-run the gate. The sandbox already runs that on startup; if the
   binaries are still wrong it likely failed mid-flight. Do NOT
   accept "infrastructure limitation" as a reason to skip a gate.

4. **Existing-test sweep.** Read the diff
   (`git diff {{SOURCE_BRANCH}}...{{BRANCH}}`) and identify every
   removed UI string, deleted render branch, modified error path,
   or renamed/removed exported symbol. For each, grep the test
   suite (`tests/`, `**/*.spec.ts`, `**/*.test.ts`) for assertions
   that reference it. Any test that exercised the pre-change
   behavior must either still pass or be updated in this PR with a
   commit-message justification. A previously-passing e2e test
   that is now red (or worse, silently passing because the
   assertion no longer matches anything) is a blocker — fix the
   code or fix the test, don't proceed without reconciliation.

5. Walk through every task-specific verification step named in the task's
   description and comments. For each step, execute it (open the URL,
   walk the flow, query the data, diff the output) and confirm the
   observed behavior matches what's expected. If the task has no
   task-specific verification steps, or its notes explicitly say to skip
   verification, skip this step and rely on the standard gates above.

6. Run `/qa` to drive the changed feature in a real headless browser and
   verify the task's acceptance criteria. The skill produces before/after
   health scores and screenshots — review them and treat any regression
   as a failing gate.

7. Run `/cso` to audit the diff for secrets, OWASP issues, and dependency
   risks. Reviewer-time security gate; any high-severity finding is a
   failing gate.

8. If any check fails — including failures attributed to
   "infrastructure", "environment", "platform binaries", "pre-existing
   errors", or any variant of "I'll let CI verify":

   - If you can fix it on this branch, do so and commit the fix. Run
     `pnpm install --force` first if the failure smells like a
     platform-binary mismatch.
   - If you can't (out of scope, unclear, blocked), post a comment on
     the Asana task via `sandcastle-asana comment {{TASK_ID}} ...`
     describing what failed, and stop. Do NOT output
     `<promise>COMPLETE</promise>` in that case — ship must not run
     on a broken change.

   Specifically: do NOT emit `<promise>COMPLETE</promise>` while any
   gate is in an unknown state. The downstream ship phase opens / merges
   the PR; a green review on a red gate is the most expensive failure
   mode in this pipeline.

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
