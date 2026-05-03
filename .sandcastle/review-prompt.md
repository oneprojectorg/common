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

   For UI/web flows, bring up the dev environment with `pnpm docker:dev`
   and drive the browser with the Playwright MCP tools
   (`mcp__playwright__browser_navigate`, `browser_click`,
   `browser_snapshot`, `browser_console_messages`, etc.). Capture a
   `browser_take_screenshot` for any visual criterion so the trail is in
   the log.

4. If any check fails:

   - If you can fix it on this branch, do so and commit the fix.
   - If you can't (out of scope, unclear, blocked), post a comment on the
     Asana task via `sandcastle-asana comment {{TASK_ID}} ...` describing
     what failed, and stop. Do NOT output `<promise>COMPLETE</promise>`
     in that case — ship must not run on a broken change.

Only continue to the code-cleanup pass below once every gate is green.

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Follow the coding standards defined in @.sandcastle/CODING_STANDARDS.md

6. **Preserve functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run tests and type checking to ensure nothing is broken
3. Commit describing the refinements

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
