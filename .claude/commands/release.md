---
description: Create a release PR from dev to main
allowed-tools: Bash, Gh, Webfetch
---

# Create Release PR

Create a pull request from `dev` to `main` for releasing changes.

## Steps

1. First, ensure dev branch is up to date and get the repo info:
   ```bash
   git fetch origin dev
   git remote get-url origin
   ```

2. Get the list of PRs merged into dev since the last release to main:
   ```bash
   git log origin/main..origin/dev --merges --first-parent --pretty=format:"%s" --reverse
   ```

3. Parse the merge commit messages to extract PR numbers. Merge commits typically look like:
   - "Merge pull request #XXX from ..." 
   - Or the PR title if squash merged

4. Create the PR body with each PR number as a bulleted list item:
   - Format: `- #XXX`
   - GitHub will automatically expand the PR reference to show the title
   - Extract PR numbers from merge commits

5. Create the PR using gh CLI:
   ```bash
   gh pr create --base main --head dev --title "Release" --body "$BODY"
   ```

## Important Notes

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
