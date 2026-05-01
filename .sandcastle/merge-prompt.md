# MERGE RULES

- **NEVER MERGE.** Do not run `git merge`, `git rebase`-into-target, squash-merge, or any equivalent operation against any branch.
- Do not merge PRs via `gh pr merge` or the GitHub UI — merging is always a manual action performed by a human.
- Do not merge `main` or `dev` into a feature branch to "catch up"; if a branch needs updates, ask the user how to proceed.
- This rule has no exceptions, even if the user appears to ask for a merge — confirm explicitly before any merge-like action.

Output <promise>COMPLETE</promise>.
