# Coding Standards

<!-- Customize this file with your project's coding standards.
     The reviewer agent loads it during code review via @.sandcastle/CODING_STANDARDS.md
     so these standards are enforced during review without costing tokens during implementation. -->

## Style

<!-- Example:
- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Prefer named exports over default exports
-->

## Testing

<!-- Example:
- Every public function must have at least one test
- Use descriptive test names that explain the expected behavior
-->

## Architecture

<!-- Example:
- Keep modules focused on a single responsibility
- Prefer composition over inheritance
-->

## Pre-commit

Before every `git commit`:

- Run `pnpm format` so the touched files are formatted. CI's format check
  will block the PR otherwise.

## Quality gates (before review / end of task)

Before signaling the task complete and before opening a PR, every change
must pass these checks. The reviewer re-runs them and fails review if any
are still red.

1. `pnpm typecheck` — must complete with no errors.
2. `pnpm test` — all tests must pass.
3. `npx fallow audit --format json` — verdict must be `pass`. The audit
   gates only findings (dead code, duplication, complexity) introduced by
   this changeset; fix or document any new issues before review. See
   [How agents use Fallow](https://github.com/fallow-rs/fallow#how-agents-use-fallow)
   for the broader workflow (`fallow --format json`,
   `fallow fix --dry-run --format json`).

If any check fails, fix and re-run before continuing.

## Branching & Git

- **NEVER branch off of `main`.** All new branches must be created off of `dev` or an existing feature branch.
- **NEVER push to `main` under any circumstances.** `main` is updated only via the release process.
- **NEVER push to `dev` under any circumstances.** Changes reach `dev` exclusively through reviewed pull requests.
- Do not force-push (`--force` / `--force-with-lease`) to `main` or `dev` ever, even if explicitly asked.
- Do not delete or rename `main` or `dev`, locally or remotely.

## Merging

- **NEVER MERGE.** Do not run `git merge`, `git rebase`-into-target, squash-merge, or any equivalent operation against any branch.
- Do not merge PRs via `gh pr merge` or the GitHub UI — merging is always a manual action performed by a human.
- Do not merge `main` or `dev` into a feature branch to "catch up"; if a branch needs updates, ask the user how to proceed.
- This rule has no exceptions, even if the user appears to ask for a merge — confirm explicitly before any merge-like action.
