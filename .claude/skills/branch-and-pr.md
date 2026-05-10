---
name: branch-and-pr
description: Branching and pull-request workflow. Use whenever about to commit or push.
---

## Rules

- **Never commit directly to `main` or `dev`.** Both are protected by `.claude/hooks/`.
- All work happens on a feature branch off `dev`. Naming: `<short-slug>`.
- Open a pull request targeting `dev`. Releases from `dev` to `main` go through `/release`.

## Workflow

1. `git checkout -b my-thing` (off `dev`).
2. Make edits, commit with a conventional message: `feat(scope): summary`, `fix(scope): summary`, `refactor(...)`.
3. Push the feature branch: `git push -u origin my-thing`.
4. Open the PR with `gh pr create --base dev`.
5. Never `git push --force` to a shared branch unless you are rebasing. If you must rewrite history, do it on your own feature branch only.

## What hooks block

The pre-tool hooks in `.claude/hooks/` will refuse:
- `git`/`gh` commands referencing `main` or `dev` as a target (this still catches `git push --force origin dev`).
- `git reset --hard`, `git clean -f`, `git branch -D`.
- Commits while currently on `main` or `dev`.

`git push --force` and `--force-with-lease` to feature branches are allowed — you'll need them after a rebase.

## The one exception: `/release`

The release command opens the dev → main PR. It works by prefixing its git/gh calls with `CLAUDE_RELEASE=1`, which the protected-branch hook reads as "allow read-only inspection of dev/main and the `gh pr create --base main --head dev` call." Pushes to `main`/`dev` are still rejected even under the marker.

Don't use `CLAUDE_RELEASE=1` outside of `/release`. If you find yourself reaching for it, you're routing around the policy.

If you hit a block, switch to a feature branch — don't try to bypass it.
