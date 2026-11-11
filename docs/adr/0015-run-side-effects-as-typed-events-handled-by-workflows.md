# 0015. Run side effects as typed events handled by workflows

Date: 2026-11-11

## Status

Accepted

## Context

An operation often triggers work the caller should not wait for and that
must survive a failure: an email, a moderation review, an export. Done
inline, it slows the request and is lost when the request dies. This records
what the code already does.

In scope: how a service starts background work. Out of scope: what each
workflow does.

## Decision

We will start background work by sending a typed event, and do the work in
an Inngest function.

Every event is declared once in `@op/events` (`services/events/src/types.ts`)
as a name and a Zod schema. The Inngest client is typed from that map, so a
send with the wrong name or payload is a compile error.

```ts
await event.send({
  name: Events.proposalExportRequested.name,
  data: { exportId, processInstanceId, userId, format: 'csv' },
});
```

A function in `services/workflows` subscribes by `Events.x.name` and parses
`event.data` with the same schema before it does anything.

An event carries ids, not content. The function reads current state itself,
so a retry or a delay never acts on a stale copy.

A service sends after its transaction commits, never inside it.

## Consequences

- The request returns before the work runs, and Inngest retries a failed
  step.
- Sender and handler share one schema, checked at compile time and again at
  run time.
- A send that fails after the commit loses the side effect unless the rows
  record that it is still owed, as invites do with `notifiedAt`.
- A function can run twice, so each step has to be safe to repeat.
- About ten sends still sit in `services/api` rather than in a service, and
  a few routers run analytics through `waitUntil`. Neither is the pattern
  for new code.
