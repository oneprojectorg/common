---
description: Look at an Asana task and come up with a plan to address it.
argument-hint: [optional: asana-task-url]
allowed-tools: Task, Bash, Gh
---

Fetch the Asana task via the REST API (not an MCP), then ultrathink a plan to implement it. See the `asana-api` skill for full endpoint reference.

1. If `$ARGUMENTS` is empty, list open tasks in `$ASANA_PROJECT_ID` and ask the user which to pick up:
   ```bash
   curl -s -H "Authorization: Bearer $ASANA_API_KEY" \
     "https://app.asana.com/api/1.0/projects/$ASANA_PROJECT_ID/tasks?completed_since=now&opt_fields=name,assignee.name"
   ```
2. Otherwise extract the task gid from `$ARGUMENTS` — the trailing numeric segment of the Asana URL.
3. Fetch the task:
   ```bash
   curl -s -H "Authorization: Bearer $ASANA_API_KEY" \
     "https://app.asana.com/api/1.0/tasks/<task_gid>?opt_fields=name,notes,assignee.name,memberships.section.name"
   ```
   If `$ASANA_API_KEY` or `$ASANA_PROJECT_ID` is empty, stop and ask the user to set them in `.env.local`.
4. Pull comments if context is needed:
   ```bash
   curl -s -H "Authorization: Bearer $ASANA_API_KEY" \
     "https://app.asana.com/api/1.0/tasks/<task_gid>/stories?opt_fields=text,created_by.name"
   ```
5. Read the task's `name` and `notes`. If anything is ambiguous, ask clarifying questions before planning.
6. Produce a step-by-step implementation plan grounded in this repo's conventions (see the installed agent skills).

Arguments: $ARGUMENTS
