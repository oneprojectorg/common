---
description: Review tests on the current branch for quality and correctness
allowed-tools: Task, Bash, Read, Grep, Glob
---

Can you review the tests on this branch? Make sure they are testing the things they say they are testing and that there are no redundant tests. Also make sure that if we check for errors that we check for the error code or name more specifically. They should be properly isolated and able to run concurrently. See `packages/common/testing/README.md` for how tests are set up here.
