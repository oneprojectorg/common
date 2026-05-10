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
- Pushing to `main` or `dev` (incl. `--force` / `--force-with-lease`).
- Destructive ops: `git reset --hard`, `git clean -f`, `git branch -D`, `git checkout -- <path>`.
- Switching HEAD onto `main`/`dev` (`git checkout dev`, `git switch main`).
- `gh pr create --base main` outside the `/release` flow.
- Anything else that names `main`/`dev` and isn't on the read-only/sync allowlist (`gh api .../branches/dev/...`, etc.).
- Commits while currently on `main` or `dev` (separate hook).

What's **allowed** without any marker:
- Read-only and local-sync git verbs against protected refs: `git fetch origin dev`, `git rebase origin/dev`, `git merge origin/dev`, `git pull origin dev`, `git diff origin/main..HEAD`, `git log main..feature`, `git show origin/dev:path`. The standard "keep my feature branch in sync with dev" flow just works.
- `git push --force` / `--force-with-lease` to **feature** branches — needed after a rebase.
- `gh pr create --base dev` — the normal feature → dev PR.

## The one exception: `/release`

The release command opens the dev → main PR. It works by prefixing its git/gh calls with `CLAUDE_RELEASE=1`, which the protected-branch hook reads as "allow read-only inspection of dev/main and the `gh pr create --base main --head dev` call." Pushes to `main`/`dev` are still rejected even under the marker.

Don't use `CLAUDE_RELEASE=1` outside of `/release`. If you find yourself reaching for it, you're routing around the policy.

If you hit a block, switch to a feature branch — don't try to bypass it.
