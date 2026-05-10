---
name: asana-api
description: Talk to Asana directly via the REST API (no MCP). Use whenever you need to read or update tasks in our task project.
---

## Auth + project

- Token: `$ASANA_API_KEY` (Personal Access Token). Loaded from `.env.local`.
- Project: `$ASANA_PROJECT_ID` (gid of the team's task project). Loaded from `.env.local`.
- Header: `Authorization: Bearer $ASANA_API_KEY`.
- Base URL: `https://app.asana.com/api/1.0`.
- If either env var is empty, ask the user — do not invent a value.

## List tasks in our project

```bash
# All open tasks in the project (most useful entry point for agents picking up work)
curl -s -H "Authorization: Bearer $ASANA_API_KEY" \
  "https://app.asana.com/api/1.0/projects/$ASANA_PROJECT_ID/tasks?completed_since=now&opt_fields=name,assignee.name,due_on,notes,memberships.section.name"
```

`completed_since=now` filters out completed tasks. `opt_fields` keeps the payload small — request only the fields you need.

## Read a single task

```bash
curl -s -H "Authorization: Bearer $ASANA_API_KEY" \
  "https://app.asana.com/api/1.0/tasks/<task_gid>?opt_fields=name,notes,assignee.name,custom_fields,memberships.section.name"
```

## Read task comments / activity

```bash
curl -s -H "Authorization: Bearer $ASANA_API_KEY" \
  "https://app.asana.com/api/1.0/tasks/<task_gid>/stories?opt_fields=text,created_by.name,created_at"
```

## Update a task

```bash
# Mark complete, change assignee, etc.
curl -s -X PUT -H "Authorization: Bearer $ASANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data":{"completed":true}}' \
  "https://app.asana.com/api/1.0/tasks/<task_gid>"
```

## Add a comment

```bash
curl -s -X POST -H "Authorization: Bearer $ASANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data":{"text":"Picked up by agent — branch: feat/<slug>"}}' \
  "https://app.asana.com/api/1.0/tasks/<task_gid>/stories"
```

## Create a task in our project

```bash
curl -s -X POST -H "Authorization: Bearer $ASANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"data\":{\"name\":\"<title>\",\"notes\":\"<body>\",\"projects\":[\"$ASANA_PROJECT_ID\"]}}" \
  "https://app.asana.com/api/1.0/tasks"
```

## Parsing a task URL

Asana URLs come in two shapes:
- `https://app.asana.com/0/<project_gid>/<task_gid>`
- `https://app.asana.com/1/<workspace>/project/<project>/task/<task_gid>`

Pull the trailing `<task_gid>` and call `GET /tasks/<task_gid>`.

## Pagination + rate limits

- Pagination: `?limit=100&offset=<token>`. The `next_page.offset` field on the response is the next token.
- Rate-limit: ~150 req/min per token. On 429, back off and retry.
