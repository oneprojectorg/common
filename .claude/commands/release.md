---
description: Create a release PR from dev to main
allowed-tools: Bash, Gh, Webfetch
---

# Create Release PR

Create a pull request from `dev` to `main` for releasing changes.

The protected-branch hook (`.claude/hooks/block-protected-branches.sh`) normally refuses any `git`/`gh` command that touches `main` or `dev`. **`/release` is the one exception**: prefixing a command with `CLAUDE_RELEASE=1` tells the hook to allow read-only inspection of those branches and the `gh pr create --base main --head dev` call. Pushes to `main`/`dev` remain blocked under the marker.

Every git/gh command in the steps below uses that prefix. Don't drop it.

## Steps

1. Make sure dev is up to date and confirm the remote:
   ```bash
   CLAUDE_RELEASE=1 git fetch origin dev
   CLAUDE_RELEASE=1 git remote get-url origin
   ```

2. Get the list of PRs merged into dev since the last release to main:
   ```bash
   CLAUDE_RELEASE=1 git log origin/main..origin/dev --merges --first-parent --pretty=format:"%s" --reverse
   ```

3. Parse the merge commit messages to extract PR numbers. Merge commits typically look like:
   - "Merge pull request #XXX from ..."
   - Or the PR title if squash merged

4. Build the PR body with each PR number as a bulleted list item:
   - Format: `- #XXX`
   - GitHub will automatically expand the PR reference to show the title
   - Extract PR numbers from merge commits

5. Create the PR using gh CLI (note the marker prefix):
   ```bash
   CLAUDE_RELEASE=1 gh pr create --base main --head dev --title "Release" --body "$BODY"
   ```

## Important notes

- The PR title must be exactly "Release"
- Each item should be a bullet point starting with `- #`
- GitHub automatically expands PR references (e.g., `#800`) to show the full PR title
- Just list the PR numbers, no need for full URLs or titles
- Example format:
  ```
  - #800
  - #805
  - #802
  ```
- The `CLAUDE_RELEASE=1` marker is **only** valid for the dev → main PR-creation flow. Do not reuse it elsewhere; the hook still blocks pushes to `main`/`dev` regardless.
