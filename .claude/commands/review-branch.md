---
description: Do a thorough code review of the current branch (or a GitHub PR)
argument-hint: [optional: github-pr-url]
allowed-tools: Task, Bash, Gh
---

Do a thorough code review of this branch. If an argument is passed and it is a github pull request, use `gh pr` to retrieve the pull request and review the pull request.
If there is no argument, you should review the current changes on this branch (you can diff against the dev branch).
Always do this in planning mode and present the review at the end.

Arguments: $ARGUMENTS
